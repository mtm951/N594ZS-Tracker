import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const dataStoreSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const equipmentSource=fs.readFileSync(new URL('../app-29-equipment.js',import.meta.url),'utf8');
const inventorySource=fs.readFileSync(new URL('../app-42-inventory-workflow.js',import.meta.url),'utf8');
const purchaseDeleteSource=fs.readFileSync(new URL('../app-32-purchase-delete.js',import.meta.url),'utf8');

function fakeElement(){
  return {
    id:'',textContent:'',innerHTML:'',className:'',dataset:{},style:{},
    appendChild(){},remove(){},addEventListener(){},insertBefore(){},insertAdjacentHTML(){},
    setAttribute(){},querySelector(){return null},querySelectorAll(){return []},
    classList:{add(){},remove(){},toggle(){}}
  };
}
function fakeDocument(){
  return {
    head:{appendChild(){}},
    body:{appendChild(){}},
    createElement:()=>fakeElement(),
    getElementById:()=>null,
    querySelector:()=>null,
    querySelectorAll:()=>[]
  };
}
function storage(){
  const m=new Map();
  return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
}
function commonContext(db){
  let nextUid=1000;
  const context={
    console,JSON,Date,Map,Set,Object,Array,Number,String,Boolean,Math,Promise,Error,
    structuredClone,setTimeout,clearTimeout,
    document:fakeDocument(),
    localStorage:storage(),
    sessionStorage:storage(),
    NAV:[['aircraft','Aircraft']],
    RECORD_ARRAYS:{},
    SYNC_RECORD_TYPES:new Set(),
    SEED:{equipment:[]},
    db,
    arr:v=>Array.isArray(v)?v:[],
    num:v=>Number(v)||0,
    uid:()=>++nextUid,
    nextNumericId:(rows,start=1)=>Math.max(start-1,...rows.map(x=>Number(x.id)||0))+1,
    blankCloudDB:()=>({}),
    normalizeDB:()=>{},
    partById:id=>db.parts.find(x=>Number(x.id)===Number(id)),
    projectById:id=>db.projects.find(x=>Number(x.id)===Number(id)),
    logById:id=>db.logs.find(x=>Number(x.id)===Number(id)),
    saveDB:()=>{},
    queueCloudSave:()=>{},
    persistBrowserData:async()=>{},
    openPurchaseDetail:()=>{},
    openPurchaseModal:()=>{},
    openPartDetail:()=>{},
    openProjectDetail:()=>{},
    openLogDetail:()=>{},
    openModal:()=>{},
    closeModal:()=>{},
    renderPurchases:()=>{},
    renderAttachments:()=>{},
    chooseAttachments:()=>{},
    handleEntityDrop:()=>{},
    field:()=>'',textareaField:()=>'',modalHeader:()=>'',systemOptions:()=>'',selectOptions:()=>'',partOptions:()=>'',pill:x=>String(x??''),
    esc:x=>String(x??''),fmtMoney:x=>String(x??''),val:()=>'',today:()=> '2026-09-21',
    confirm:()=>true,alert:()=>{},
    maintenanceDueInfo:()=>({status:'OK'}),
    renderNav:()=>{},reopenDetail:()=>{},
    currentDetail:null,currentPage:'dashboard',
    DB_KEY:'test-db'
  };
  context.window=context;
  return context;
}

function load(source,context,name){
  if(!vm.isContext(context))vm.createContext(context);
  vm.runInContext(source,context,{filename:name});
  return context;
}
function loadEquipment(context){
  load(dataStoreSource,context,'app-17a-data-store.js');
  return load(equipmentSource,context,'app-29-equipment.js');
}

// 1) Passive relationship reconciliation must NEVER invent Part/Equipment IDs.
// This guards the exact class of bug that once produced a giant multi-device conflict.
{
  const purchase={
    id:'p-passive',description:'Test fuel fitting',pn:'ABC-1',qty:1,remainingQty:1,unitPrice:12,
    disposition:'On Hand',system:'Fuel',vendor:'Test Vendor',projectId:null,
    inventoryPartId:null,inventoryApplied:false,equipmentId:null,trackAsEquipment:false
  };
  const db={equipment:[],parts:[],purchases:[purchase],invoices:[],projects:[],maintenance:[],settings:{showCosts:true}};
  const h=loadEquipment(commonContext(db));

  const changed=h.reconcileTrackerRecordLinks();
  assert.equal(db.parts.length,0,'passive reconciliation created an inventory part');
  assert.equal(db.equipment.length,0,'passive reconciliation created equipment');
  assert.equal(purchase.inventoryPartId,null);
  assert.equal(purchase.equipmentId,null);
  assert.equal(changed,false);
}

// 2) An EXPLICIT workflow is allowed to create the records, and repeating it must be idempotent.
{
  const purchase={
    id:'p-explicit',description:'EarthX-style test component',pn:'TEST-5MM',qty:1,remainingQty:1,unitPrice:30,
    disposition:'On Hand',system:'Electrical',vendor:'Aircraft Spruce',projectId:44,invoice:'INV-44',
    shipDate:'2026-09-21',location:'Shelf',inventoryPartId:null,inventoryApplied:false,equipmentId:null,trackAsEquipment:false
  };
  const invoice={id:'INV-44',invoice:'INV-44',purchaseIds:[]};
  const db={equipment:[],parts:[],purchases:[purchase],invoices:[invoice],projects:[{id:44,title:'Install test component'}],maintenance:[],settings:{showCosts:true}};
  const h=loadEquipment(commonContext(db));

  const first=h.reconcilePurchaseLinks(purchase,{createPart:true,createEquipment:true});
  assert.equal(first.changed,true);
  assert.equal(db.parts.length,1);
  assert.equal(db.equipment.length,1);
  const part=db.parts[0],equipment=db.equipment[0];
  assert.equal(String(purchase.inventoryPartId),String(part.id));
  assert.equal(String(purchase.equipmentId),String(equipment.id));
  assert.ok(part.purchaseIds.includes('p-explicit'));
  assert.ok(part.linkedProjectIds.includes(44));
  assert.equal(String(part.equipmentId),String(equipment.id));
  assert.equal(String(equipment.purchaseId),'p-explicit');
  assert.equal(String(equipment.inventoryPartId),String(part.id));
  assert.ok(equipment.linkedProjectIds.includes(44));
  assert.ok(invoice.purchaseIds.includes('p-explicit'));
  assert.equal(part.stockQty,1);

  h.reconcilePurchaseLinks(purchase,{createPart:true,createEquipment:true});
  assert.equal(db.parts.length,1,'reconcile duplicated the Part record');
  assert.equal(db.equipment.length,1,'reconcile duplicated the Equipment record');
  assert.equal(part.stockQty,1,'reconcile double-counted inventory');
}

// 3) The first migrated workflow uses the store boundary without changing equipment-history behavior.
{
  const equipment={id:901,name:'EarthX ETX680',system:'Electrical',history:[],linkedProjectIds:[]};
  const db={equipment:[equipment],parts:[],purchases:[],invoices:[],projects:[],maintenance:[],logs:[],settings:{showCosts:true}};
  const h=commonContext(db),saves=[];
  const values={eqHistDate:'2026-09-21',eqHistAction:'Installed',eqHistHours:'1930.7',eqHistNotes:'Regression test'};
  h.val=id=>values[id]??'';
  h.saveDB=message=>saves.push(message);
  h.setTimeout=()=>0;
  loadEquipment(h);

  h.saveEquipmentHistory(901);
  assert.equal(db.equipment[0].history.length,1);
  assert.equal(db.equipment[0].history[0].action,'Installed');
  assert.equal(db.equipment[0].history[0].hours,'1930.7');
  assert.equal(db.equipment[0].history[0].notes,'Regression test');
  assert.deepEqual(saves,['Equipment history updated.']);
}

// 4) Deleting a purchase unlinks provenance without deleting the physical part/equipment or changing stock.
{
  const purchase={id:'p-delete',description:'Prop bolt',vendor:'Aircraft Spruce',invoice:'INV-D',inventoryPartId:10};
  const part={id:10,name:'Prop bolt',stockQty:6,purchaseIds:['p-delete'],linkedProjectIds:[]};
  const equipment={id:901,name:'Prop hardware',purchaseId:'p-delete'};
  const invoice={id:'INV-D',invoice:'INV-D',purchaseIds:['p-delete']};
  const db={equipment:[equipment],parts:[part],purchases:[purchase],invoices:[invoice],projects:[],maintenance:[],logs:[],settings:{showCosts:true}};
  const h=commonContext(db);
  h.invoiceRecord=id=>db.invoices.find(x=>String(x.invoice)===String(id));
  load(purchaseDeleteSource,h,'app-32-purchase-delete.js');

  h.deletePurchaseRecord('p-delete');
  assert.equal(db.purchases.length,0);
  assert.equal(db.parts.length,1,'purchase delete removed physical part');
  assert.equal(db.equipment.length,1,'purchase delete removed equipment');
  assert.equal(part.stockQty,6,'purchase delete changed inventory quantity');
  assert.deepEqual(part.purchaseIds,[]);
  assert.equal(equipment.purchaseId,'');
  assert.deepEqual(invoice.purchaseIds,[]);
}

// Inventory workflow harness. It runs the real app-42 code but replaces the browser UI with tiny stubs.
function inventoryHarness(db,values={}){
  const h=commonContext(db);
  h.partConsumedQty=partId=>db.logs.reduce((sum,l)=>sum+(l.consumedParts||[])
    .filter(x=>Number(x.partId)===Number(partId))
    .reduce((s,x)=>s+(Number(x.qty)||0),0),0);
  h.partMovementRows=()=>[];
  h.partFreeQty=part=>{
    const reserved=db.projects.filter(p=>p.status!=='Done').reduce((sum,p)=>sum+(p.plannedParts||[])
      .filter(x=>Number(x.partId)===Number(part.id))
      .reduce((s,x)=>s+(Number(x.qty)||0),0),0);
    return h.partAvailable(part)-reserved;
  };
  h.val=id=>String(values[id]??'');
  h.selectedNumber=id=>{
    const n=Number(values[id]);return Number.isFinite(n)?n:null;
  };
  h.openReservePartModal=()=>{};
  h.removeReservedPart=()=>{};
  h.addProjectPart=()=>{};
  h.openSquawkModal=()=>{};
  h.openRunModal=()=>{};
  h.openPurchaseModal=()=>{};
  h.openProjectModal=()=>{};
  h.navTo=()=>{};
  h.chooseAttachments=()=>{};
  h.searchablePartPicker=undefined;
  h.partPickerId=undefined;
  load(inventorySource,h,'app-42-inventory-workflow.js');
  return h;
}

// 5) Reservation is NOT consumption; Reserve -> Use creates one work-log outflow and releases reservation.
{
  const part={id:10,name:'AN bolt',partNo:'AN3',system:'Hardware',unit:'ea',stockQty:6,unitCost:2,linkedProjectIds:[1],inventoryAdjustments:[]};
  const project={id:1,title:'Test project',system:'Hardware',status:'In Progress',nextStep:'',plannedParts:[{id:301,partId:10,name:'AN bolt',qty:2,unit:'ea',notes:''}],partsUsed:[]};
  const db={parts:[part],projects:[project],purchases:[],logs:[],equipment:[],invoices:[],maintenance:[],settings:{}};
  const h=inventoryHarness(db,{urQty:2,urDate:'2026-09-21',urWork:'Installed two bolts',urNotes:'Torqued'});
  assert.equal(h.partAvailable(part),6,'reservation changed physical on-hand before use');
  assert.equal(h.partFreeQty(part),4,'reservation did not reduce free inventory');

  h.saveReservedPartUse(1,301);
  assert.equal(part.stockQty,6,'use mutated the received/opening stock baseline');
  assert.equal(db.logs.length,1);
  assert.equal(db.logs[0].consumedParts.length,1);
  assert.equal(db.logs[0].consumedParts[0].qty,2);
  assert.equal(h.partAvailable(part),4,'work-log consumption did not reduce physical on-hand exactly once');
  assert.equal(project.plannedParts.length,0,'used reservation was not released');
  assert.equal(project.partsUsed.length,1);
  assert.equal(project.partsUsed[0].qty,2);
  assert.equal(project.partsUsed[0].logId,db.logs[0].id);
}

// 6) Installed-purchase provenance can be materialized before use so historical installs do not make inventory negative.
{
  const part={id:20,name:'Installed component',partNo:'COMP-1',unit:'ea',stockQty:0,linkedProjectIds:[2],purchaseIds:['p-installed'],inventoryAdjustments:[]};
  const purchase={id:'p-installed',pn:'COMP-1',qty:2,disposition:'Installed',inventoryPartId:20,inventoryApplied:true,inventoryReceiptMaterializedQty:0};
  const db={parts:[part],projects:[],purchases:[purchase],logs:[],equipment:[],invoices:[],maintenance:[],settings:{}};
  const h=inventoryHarness(db);
  assert.equal(h.partAvailable(part),0);

  const prep=h.preparePartForPhysicalUse(part,2);
  assert.equal(prep.credited,2);
  assert.equal(part.stockQty,2);
  assert.equal(purchase.inventoryReceiptMaterializedQty,2);
  assert.equal(purchase.inventoryReceiptMaterialized,true);

  db.logs.push({id:9000,consumedParts:[{partId:20,qty:2}]});
  assert.equal(h.partAvailable(part),0,'installed purchase + matching use should net to zero on-hand');
  const second=h.preparePartForPhysicalUse(part,1);
  assert.equal(second.credited,0,'installed purchase provenance was materialized twice');
}

console.log('core workflow regression tests passed');
