import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Real production Parts, Orders, Purchases, data-polish overrides and passive
// purchase link reconciler; disposable records and no Supabase writes.
const files=['app-23-wb-purchases.js','app-24-data-polish.js','app-29-equipment.js',
  'app-07-parts.js','app-08-orders.js'];
const source=Object.fromEntries(files.map(f=>[f,fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')]));
const controls={};
const saved=[],alerts=[],modalHTML=[],confirmations=[];
let id=1000;
const db={aircraft:{wb:{}},settings:{showCosts:true,currency:'USD'},
  projects:[],parts:[],orders:[],purchases:[],invoices:[],equipment:[],
  maintenance:[],logs:[],docs:[],checklists:[],systems:[]};
function purchase(key,pn,remaining=0){
  return {id:key,pn,description:'Ordered part '+pn,qty:5,remainingQty:remaining,unitPrice:8,
    system:'Fuel',vendor:'Amazon',shipDate:'2026-09-26',disposition:'Unknown',
    inventoryPartId:null,inventoryApplied:false,equipmentId:null,trackAsEquipment:false,
    projectId:null,invoice:'AM-TEST',notes:''};
}
db.purchases.push(purchase('p0','AS-0',0));
const doc={
  getElementById:()=>null,
  addEventListener(){},
  createElement:()=>({id:'',style:{},textContent:'',appendChild(){}}),
  head:{appendChild(){}},querySelector:()=>null,querySelectorAll:()=>[]
};
const ctx={
  window:null,db,document:doc,console,crypto:{randomUUID:()=> 'uuid-1'},
  NAV:[['aircraft','Aircraft'],['orders','Orders']],RECORD_ARRAYS:{},
  SYNC_RECORD_TYPES:new Set(),SEED:{purchases:[],equipment:[]},
  blankCloudDB:()=>({}),normalizeDB:()=>{},
  renderAircraft:()=>{},renderPurchases:()=>{},renderParts:()=>{},renderSearchPage:()=>{},
  arr:x=>Array.isArray(x)?x:[],clone:x=>structuredClone(x),num:x=>Number(x)||0,
  unique:x=>[...new Set(x)],uid:()=>++id,nextNumericId:(xs,min)=>Math.max(min-1,...xs.map(x=>Number(x.id)||0))+1,
  val:k=>String(controls[k]??''),selectedNumber:k=>controls[k]?Number(controls[k]):null,
  systemOptions:()=>'<option value="Fuel">Fuel</option>',
  partOptions:current=>'<option value="">None</option>'+db.parts.map(x=>
    '<option value="'+x.id+'"'+(Number(current)===Number(x.id)?' selected':'')+'>'+x.name+'</option>').join(''),
  projectOptions:()=>'',trackerSystemFilterOptions:()=>'',trackerRecordMatchesSystem:()=>true,
  field:(label,fieldId,value)=>'<input id="'+fieldId+'" value="'+String(value??'')+'">',
  textareaField:(label,fieldId,value)=>'<textarea id="'+fieldId+'">'+String(value??'')+'</textarea>',
  modalHeader:title=>'<h2>'+title+'</h2>',
  esc:x=>String(x??''),pill:x=>String(x||''),fmtMoney:v=>'$'+Number(v||0).toFixed(2),
  partById:x=>db.parts.find(p=>Number(p.id)===Number(x)),
  projectById:x=>db.projects.find(p=>Number(p.id)===Number(x)),
  orderById:x=>db.orders.find(o=>Number(o.id)===Number(x)),
  partName:x=>db.parts.find(p=>Number(p.id)===Number(x))?.name||'Unlinked',
  partConsumedQty:()=>0,partAvailable:p=>p.stockQty===''?null:Number(p.stockQty),
  currentDetail:null,renderAttachments:()=>{},openPurchaseModal:()=>{},
  openModal:html=>{modalHTML.push(html)},closeModal:()=>{},
  saveDB:msg=>{saved.push(msg);ctx.normalizeDB()},
  savePurchase:()=>{},toast:()=>{},alert:msg=>alerts.push(String(msg)),
  confirm:msg=>{confirmations.push(String(msg));return true},
  today:()=> '2026-09-26',setTimeout:()=>{},windowOpen:()=>{},
  renderNav:()=>{},isURL:()=>false,cryptoRandomUUID:()=> 'uuid-1'
};
ctx.window=ctx;
vm.createContext(ctx);
for(const f of files)vm.runInContext(source[f],ctx,{filename:f});

// A new inventory Part defaults to genuine zero rather than blank/unknown.
ctx.openPartModal();
assert.match(modalHTML.at(-1),/ptStock" value="0"/);
assert.match(modalHTML.at(-1),/Zero is valid/);
Object.assign(controls,{ptName:'TEST ZERO PART',ptPN:'AS-0',ptSystem:'Fuel',ptUnit:'ea',
  ptStock:'0',ptMin:'',ptStatus:'Order',ptVendor:'Amazon',ptCost:'8',ptPurchase:'',ptLocation:'',
  ptUrl:'',ptNotes:'Disposable test'});
ctx.savePart(null);
const initial=db.parts[0];assert.equal(initial.stockQty,0);

// A purchase can link to an existing 0-on-hand Part with remainingQty=0.
// Linkage is idempotent and must not imply a stock receipt.
const p=db.purchases[0];
ctx.openPurchaseDetail('p0');
assert.match(modalHTML.at(-1),/Link Part \(0 OK\)/);
assert.match(modalHTML.at(-1),/Record Stock Received/);
ctx.openPurchaseInventoryLinkModal('p0');
assert.match(modalHTML.at(-1),/zero on hand is valid/i);
assert.match(modalHTML.at(-1),/TEST ZERO PART/);
controls.pilPart=initial.id;
ctx.savePurchaseInventoryPartLink('p0');
assert.equal(p.inventoryPartId,initial.id);
assert.equal(p.inventoryApplied,false);
assert.equal(initial.stockQty,0);
ctx.savePurchaseInventoryPartLink('p0');
assert.equal(initial.purchaseIds.filter(x=>x==='p0').length,1);
assert.equal(initial.stockQty,0);

// Zero remaining is not a reason to reject the link-only action.
ctx.applyPurchaseToInventory('p0');
assert.match(modalHTML.at(-1),/Link Purchase to Inventory/);
assert.equal(initial.stockQty,0);
assert.equal(alerts.some(x=>/positive remaining/i.test(x)),false);

// An Order can link that same 0-stock Part and show on-order quantity
// separately. A partial receipt is the first and ONLY inventory credit.
const order={id:100,item:'TEST ZERO PART',partId:null,projectId:null,qty:4,unit:'ea',
  vendor:'Amazon',status:'Ordered',updates:[],receivedQty:0,inventoryApplied:false};
db.orders.push(order);
ctx.openOrderPartLinkModal(100);
assert.match(modalHTML.at(-1),/0 on hand/i);
controls.olPart=initial.id;ctx.saveOrderPartLink(100);
assert.equal(order.partId,initial.id);
assert.equal(initial.stockQty,0);
assert.equal(ctx.partOnOrderQty(initial.id),4);
const tx={read:(type,recordId)=>ctx.orderById(recordId),
  update:(type,recordId,fn)=>fn(type==='part'?ctx.partById(recordId):ctx.orderById(recordId))};
ctx.applyOrderReceipt(tx,100,2,'2026-09-26');
assert.equal(initial.stockQty,2);
assert.equal(order.receivedQty,2);
assert.equal(ctx.partOnOrderQty(initial.id),2);

// The already-supported Order -> Create Part workflow also starts at zero.
const newOrder={id:101,item:'AN-5 test adapter',partId:null,projectId:null,qty:3,
  unit:'ea',vendor:'Aircraft Spruce',status:'Ordered',updates:[],inventoryApplied:false};
db.orders.push(newOrder);
Object.assign(controls,{opName:'AN-5 test adapter',opPN:'NEW-0',opSystem:'Fuel',
  opUnit:'ea',opStatus:'Order',opVendor:'Aircraft Spruce',opCost:'2',opUrl:'',opLocation:'',opNotes:''});
ctx.savePartFromOrder(101);
const orderPart=ctx.partById(newOrder.partId);
assert.equal(orderPart.stockQty,0);
assert.equal(ctx.partOnOrderQty(orderPart.id),3);

// Separate explicit Purchase -> create 0 Part; no duplicate stock from
// purchase-linking, later direct receipt increases stock exactly once.
const p2=purchase('p2','UNIQUE-ZERO',0);db.purchases.push(p2);
Object.assign(controls,{plName:'Unique zero-stock part',plPN:'UNIQUE-ZERO',
  plSystem:'Fuel',plUnit:'ea',plVendor:'Amazon',plCost:'8',plNotes:'Waiting for delivery'});
ctx.openCreateZeroStockPartFromPurchase('p2');
assert.match(modalHTML.at(-1),/Starting on hand: <b>0<\/b>/);
ctx.saveZeroStockPartForPurchase('p2');
const newPart=ctx.partById(p2.inventoryPartId);
assert.equal(newPart.stockQty,0);
assert.equal(newPart.status,'Order');
assert.equal(p2.inventoryApplied,false);
assert.deepEqual(newPart.purchaseIds,['p2']);
// Repeated historical invoices with the same PN should link rather than create duplicates.
const p3=purchase('p3','UNIQUE-ZERO',0);db.purchases.push(p3);
const count=db.parts.length;
ctx.saveZeroStockPartForPurchase('p3');
assert.equal(db.parts.length,count);
assert.ok(alerts.some(x=>/already exists/i.test(x)));

// Only the explicit receive action with positive quantity adds physical stock.
p2.remainingQty=3;
ctx.applyPurchaseToInventory('p2');
assert.equal(newPart.stockQty,3);
assert.equal(p2.inventoryApplied,true);
assert.equal(p2.disposition,'On Hand');
ctx.applyPurchaseToInventory('p2');
assert.equal(newPart.stockQty,3,'Repeated receive must not double-credit a purchase');

// Zero in Purchase Reconcile routes to link-only rather than inventing stock.
const p4=purchase('p4','ZERO-RECON',0);db.purchases.push(p4);
controls.reconcileRemaining='0';
ctx.setPurchaseDisposition('p4','On Hand');
assert.equal(p4.remainingQty,0);
assert.equal(p4.inventoryApplied,false);
assert.match(modalHTML.at(-1),/Link Purchase to Inventory/);

// No cloud calls exist in the disposable harness.
console.log('PASS: real Parts/Orders/Purchases allow zero stock; link-only paths never credit; partial receipts and explicit stock receipt credit correctly, duplicates prevented.');
