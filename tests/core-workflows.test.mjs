import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const dataStoreSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const equipmentSource=fs.readFileSync(new URL('../app-29-equipment.js',import.meta.url),'utf8');
const inventorySource=fs.readFileSync(new URL('../app-42-inventory-workflow.js',import.meta.url),'utf8');
const smartSource=fs.readFileSync(new URL('../app-38-smart-workflow.js',import.meta.url),'utf8');
const smartMovementStart=smartSource.indexOf('function partMovementRows(part){');
const smartMovementEnd=smartSource.indexOf('const smartOpenPartDetailBase=openPartDetail;',smartMovementStart);
assert.ok(smartMovementStart>=0&&smartMovementEnd>smartMovementStart,'production inventory movement functions missing');
const smartMovementSource=smartSource.slice(smartMovementStart,smartMovementEnd);
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
function inventoryHarness(db,values={},includeSmartMovement=false){
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
  if(includeSmartMovement){
    h.partReservationProjects=()=>[];
    load(smartMovementSource,h,'app-38-smart-workflow.js (movement UI)');
  }
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

// 7) Reproduce the actual RED RING T... discrepancy from the user screenshot:
// original purchase +4, manual adjustment -1, tracked order receipt +1,
// resulting in 4 on hand. An older order update has no structured Part event.
{
  const part={
    id:10,name:'RED RING T...',partNo:'M1292',stockQty:5,unit:'ea',
    purchaseIds:['purchase-4'],linkedProjectIds:[],
    inventoryAdjustments:[{id:501,date:'2026-09-18',delta:-1,reason:'Count correction'}]
  };
  const purchase={
    id:'purchase-4',inventoryPartId:10,qty:4,remainingQty:4,
    vendor:'Advanced Powerplant Solutions',order:'0065504',
    invoice:'0070652',shipDate:'2025-01-29',disposition:'On Hand'
  };
  const order={
    id:900,partId:10,item:'RED RING T...',qty:1,receivedQty:1,
    vendor:'Advanced Powerplant Solutions',status:'Received',
    updates:[{id:701,date:'2026-09-23',text:'Received 1 ea (line complete).'}]
  };
  const db={parts:[part],orders:[order],purchases:[purchase],projects:[],logs:[],equipment:[],invoices:[],maintenance:[],settings:{}};
  const h=inventoryHarness(db,{},true);
  assert.equal(h.partAvailable(part),4,'received order quantity not included in physical on-hand');
  const entries=h.partMovementRows(part);
  assert.equal(entries.find(x=>x.kind==='IN')?.qty,4);
  assert.equal(entries.find(x=>x.kind==='ADJUST')?.qty,-1);
  assert.equal(entries.find(x=>x.kind==='RECEIPT')?.qty,1,'existing order receipt missing from history');
  assert.match(entries.find(x=>x.kind==='RECEIPT').desc,/Historical part link inferred/);
  assert.equal(entries[0].kind,'RECEIPT','latest receipt should appear first');
  assert.equal(entries.filter(x=>['IN','ADJUST','RECEIPT'].includes(x.kind))
    .reduce((sum,x)=>sum+x.qty,0),4,'receipt history does not reconcile to on-hand');

  // Verify the real injected Part details UI displays a green positive receipt
  // rather than hiding the movement or showing an unsigned increment.
  const left={html:'',insertAdjacentHTML(_position,html){this.html=html}};
  const box={querySelector(sel){
    if(sel==='#smartPartInventory')return null;
    if(sel==='.detail-grid > div:first-child')return left;
    return null;
  }};
  h.document.getElementById=id=>id==='modalBox'?box:null;
  h.partPhysicalOnHand=p=>h.partAvailable(p);
  h.partReservedQty=()=>0;
  h.partReservationProjects=()=>[];
  h.injectPartSmartCards(10);
  assert.match(left.html,/RECEIPT<\/span>/,'receipt missing from Part history HTML');
  assert.match(left.html,/movement-in[^"]*"[^>]*>RECEIPT<\/span>/,'receipt missing green inflow style');
  assert.match(left.html,/\+1 ea/,'receipt missing positive quantity');

  // Structured events, introduced by this release, take precedence over
  // matching older Order Updates and survive deleting the Order.
  part.receiptHistory=[{
    id:701,orderUpdateId:701,orderId:900,date:'2026-09-23',qty:1,
    item:order.item,vendor:order.vendor,unit:'ea'
  }];
  assert.equal(h.partMovementRows(part).filter(x=>x.kind==='RECEIPT').length,1,
    'structured event and Order Update double-counted one receipt');
  db.orders=[];
  assert.equal(h.partMovementRows(part).filter(x=>x.kind==='RECEIPT').length,1,
    'deleting the Order erased the immutable Part receipt');
  const otherPart={id:11,name:'Unrelated terminal',stockQty:0,unit:'ea',inventoryAdjustments:[]};
  db.parts.push(otherPart);
  order.partId=11;db.orders.push(order);
  assert.equal(h.partMovementRows(otherPart).filter(x=>x.kind==='RECEIPT').length,0,
    're-linking the Order displayed the old receipt on a second Part');
  assert.equal(h.partMovementRows(part).filter(x=>x.kind==='RECEIPT').length,1);
}

// 8) New Parts often have no purchase provenance. Their whole stockQty
// formerly rendered as BASE even after recorded receipts; do not display
// the same +4 as BASE +4 and RECEIPT +4.
{
  const part={
    id:77,name:'Test part — opening zero',stockQty:4,unit:'ea',
    inventoryAdjustments:[],receiptHistory:[
      {id:1,orderUpdateId:1,orderId:100,date:'2026-09-22',qty:2,item:'Test part',unit:'ea'},
      {id:2,orderUpdateId:2,orderId:100,date:'2026-09-23',qty:2,item:'Test part',unit:'ea'}
    ]
  };
  const db={parts:[part],orders:[],purchases:[],projects:[],logs:[],equipment:[],invoices:[],maintenance:[],settings:{}};
  const h=inventoryHarness(db,{},true);
  let entries=h.partMovementRows(part);
  assert.equal(entries.filter(x=>x.kind==='RECEIPT').length,2);
  assert.equal(entries.filter(x=>x.kind==='BASE').length,0,
    'a new zero-opening Part displayed its receipts a second time as BASE');
  assert.equal(entries.filter(x=>x.kind==='RECEIPT').reduce((s,x)=>s+x.qty,0),4);
  assert.equal(h.partAvailable(part),4);

  // Existing opening stock still has an explicit residual baseline.
  part.stockQty=7; // 3 opening plus two receipts of 2.
  entries=h.partMovementRows(part);
  assert.equal(entries.find(x=>x.kind==='BASE')?.qty,3);
  assert.equal(entries.filter(x=>['BASE','RECEIPT'].includes(x.kind))
    .reduce((s,x)=>s+x.qty,0),7);
}

console.log('core workflow regression tests passed');
