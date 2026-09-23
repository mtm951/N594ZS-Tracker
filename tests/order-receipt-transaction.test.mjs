import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the REAL receipt entry points, not a hypothetical receipt staged
// directly through trackerStore. All records are fixtures: never hit Supabase.
const storeSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const ordersSource=fs.readFileSync(new URL('../app-08-orders.js',import.meta.url),'utf8');

function harness({inputs={},saveMode='ok',failingPartId=null,missingPartId=null,confirmResult=true}={}){
  const saves=[],snapshots=[],alerts=[],errors=[];
  const ui={close:0,render:0,confirm:0};
  let nextId=200;
  const db={
    aircraft:{tail:'N594ZS'},settings:{showCosts:true},
    orders:[
      {id:501,item:'AN-5 fitting',partId:206,projectId:109,
        qty:5,receivedQty:2,inventoryAppliedQty:2,inventoryApplied:false,
        status:'Ordered',receivedDate:'',tracking:'GROUP-1',vendor:'Test Vendor',unit:'ea',
        updates:[{id:99,date:'2026-09-20',text:'Earlier receipt'}],otherField:'preserve'},
      {id:502,item:'DG17 clamp',partId:300,projectId:109,
        qty:4,receivedQty:0,inventoryAppliedQty:0,inventoryApplied:false,
        status:'Ordered',receivedDate:'',tracking:'GROUP-1',vendor:'Test Vendor',unit:'ea',updates:[]}
    ],
    parts:[
      {id:206,name:'AN-5 fitting',stockQty:2,status:'Order',otherField:'preserve'},
      {id:300,name:'DG17 clamp',stockQty:0,status:'Order'}
    ],
    projects:[{id:109,title:'Fuel closeout',steps:[{id:1,done:false}]}],
    logs:[],docs:[],checklists:[]
  };
  if(missingPartId!==null)db.parts=db.parts.filter(p=>p.id!==missingPartId);
  const ctx={
    console:{...console,error:(...args)=>errors.push(args)},
    structuredClone,JSON,Object,Array,String,Number,Boolean,Math,Promise,Error,Date,Map,Set,
    db,RECORD_ARRAYS:{order:'orders',part:'parts'},
    arr:v=>Array.isArray(v)?v:[],num:v=>Number(v)||0,
    uid:()=>++nextId,today:()=> '2026-09-22',
    val:key=>String(inputs[key]??''),
    document:{getElementById:id=>Object.prototype.hasOwnProperty.call(inputs,id)?{value:String(inputs[id])}:null,addEventListener:()=>{}},
    saveDB:message=>{
      saves.push(message);
      if(saveMode==='before')throw new Error('save failed before effects');
      snapshots.push(structuredClone(db));
      if(saveMode==='after')throw new Error('save failed after effects');
    },
    alert:msg=>alerts.push(String(msg)),
    confirm:()=>{ui.confirm++;return confirmResult},
    closeModal:()=>{ui.close++},setTimeout:()=>0,
    renderOrders:()=>{ui.render++},
    orderById:id=>db.orders.find(o=>String(o.id)===String(id)),
    partById:id=>{
      if(Number(id)===failingPartId)throw new Error('simulated part lookup failure');
      return db.parts.find(p=>Number(p.id)===Number(id));
    },
    projectById:id=>db.projects.find(p=>Number(p.id)===Number(id)),
    isClosedOrder:o=>['Received','Cancelled'].includes(o.status),
    // Uncalled UI dependencies are supplied so the real file can load.
    openModal:html=>{ui.lastModal=html},modalHeader:()=>'',field:(_label,id,_value,type='text',extra='')=>`<input id="${id}" type="${type}" ${extra}>`,textareaField:()=>'',projectOptions:()=>'',partOptions:()=>'',systemOptions:()=>'',esc:x=>String(x??''),
    selectedNumber:()=>null,partName:()=>'',pill:()=>'',fmtMoney:()=>'',orderTotal:()=>0,
    isURL:()=>false,chooseAttachments:()=>{},handleEntityDrop:()=>{},renderAttachments:()=>Promise.resolve(),
    addEntityUpdate:()=>{},openProjectDetail:()=>{},openPartDetail:()=>{},currentDetail:null
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(storeSource,ctx,{filename:'app-17a-data-store.js'});
  vm.runInContext(ordersSource,ctx,{filename:'app-08-orders.js'});
  return {ctx,db,saves,snapshots,alerts,errors,ui};
}

// Both receipt UI variants must carry the guarded-editor marker so mobile
// keyboard/backdrop events cannot dismiss a quantity that hasn't been saved.
{
  const h=harness();
  h.ctx.openReceiveOrderModal(502);
  assert.match(h.ui.lastModal,/data-receipt-editor="single"/);
  assert.match(h.ui.lastModal,/id="orReceiveQty"[^>]*inputmode="decimal"/);
  h.ctx.openReceiveOrderGroupModal(501);
  assert.match(h.ui.lastModal,/data-receipt-editor="group"/);
  assert.match(h.ui.lastModal,/id="ogr-501"[^>]*type="number"/);
}

// A partial receipt updates the real order and its linked physical inventory
// together, preserves unrelated metadata, and saves their final state once.
{
  const h=harness({inputs:{orReceiveQty:'2',orReceiveDate:'2026-09-22'}});
  const priorOrder=h.db.orders[0],priorPart=h.db.parts[0];
  h.ctx.savePartialOrderReceipt(501);
  assert.equal(priorOrder.receivedQty,2,'receipt unexpectedly mutated a captured live order');
  assert.equal(priorPart.stockQty,2,'receipt unexpectedly mutated a captured live part');
  assert.notEqual(h.db.orders[0],priorOrder,'receipt did not replace the order via the store');
  assert.notEqual(h.db.parts[0],priorPart,'receipt did not replace the part via the store');
  assert.equal(h.db.orders[0].receivedQty,4);
  assert.equal(h.db.orders[0].inventoryAppliedQty,4);
  assert.equal(h.db.orders[0].status,'Ordered');
  assert.equal(h.db.parts[0].stockQty,4);
  assert.equal(h.db.parts[0].receiptHistory.length,1,'receipt not recorded on Part');
  assert.equal(h.db.parts[0].receiptHistory[0].qty,2);
  assert.equal(h.db.parts[0].receiptHistory[0].date,'2026-09-22');
  assert.equal(h.db.parts[0].receiptHistory[0].orderId,501);
  assert.equal(h.db.parts[0].receiptHistory[0].orderUpdateId,h.db.orders[0].updates.at(-1).id);
  assert.equal(h.db.orders[0].receivedDate,'2026-09-22');
  assert.equal(h.db.orders[0].otherField,'preserve');
  assert.equal(h.db.orders[0].updates.length,2);
  assert.equal(h.db.projects[0].steps[0].done,false);
  assert.equal(h.saves.length,1);
  assert.deepEqual(h.snapshots,[structuredClone(h.db)],'receipt persisted an intermediate state');
  assert.equal(h.ui.close,1);
}

// The last 3 units complete the order, increase inventory once, and remain
// idempotent when the same submitted quantity is attempted again.
{
  const h=harness({inputs:{orReceiveQty:'3',orReceiveDate:'2026-09-22'}});
  h.ctx.savePartialOrderReceipt(501);
  assert.equal(h.db.orders[0].receivedQty,5);
  assert.equal(h.db.orders[0].inventoryAppliedQty,5);
  assert.equal(h.db.orders[0].inventoryApplied,true);
  assert.equal(h.db.orders[0].status,'Received');
  assert.equal(h.db.parts[0].stockQty,5);
  assert.equal(h.db.parts[0].status,'On Hand');
  h.ctx.savePartialOrderReceipt(501);
  assert.equal(h.db.parts[0].stockQty,5,'duplicate receipt credited stock twice');
  assert.equal(h.db.parts[0].receiptHistory.length,1,'duplicate receipt added a second audit entry');
  assert.equal(h.saves.length,1);
  assert.ok(h.alerts.some(x=>x.includes('Enter a quantity')));
}

// A group receipt can update TWO distinct orders and parts with exactly one
// call to saveDB. Repeated submission must not double-credit stock.
{
  const h=harness();
  h.ctx.receiveOrderGroup('ref:group-1');
  assert.equal(h.db.orders[0].receivedQty,5);
  assert.equal(h.db.orders[1].receivedQty,4);
  assert.equal(h.db.parts[0].stockQty,5);
  assert.equal(h.db.parts[1].stockQty,4);
  assert.equal(h.db.parts[0].receiptHistory.length,1);
  assert.equal(h.db.parts[1].receiptHistory.length,1);
  assert.equal(h.db.parts[0].receiptHistory[0].qty,3);
  assert.equal(h.db.parts[1].receiptHistory[0].qty,4);
  assert.equal(h.db.orders[0].status,'Received');
  assert.equal(h.db.orders[1].status,'Received');
  assert.equal(h.saves.length,1);
  assert.match(h.saves[0],/7 total units/,'group receipt message reported zero after mutation');
  assert.deepEqual(h.snapshots,[structuredClone(h.db)]);
  assert.equal(h.ui.render,1);
  h.ctx.receiveOrderGroup('ref:group-1');
  assert.equal(h.saves.length,1);
  assert.equal(h.db.parts[0].stockQty,5);
  assert.equal(h.db.parts[1].stockQty,4);
}

// Selected line quantities remain partial and persist one consistent snapshot.
{
  const h=harness({inputs:{'ogr-501':'2','ogr-502':'1',ogrDate:'2026-09-22'}});
  h.ctx.saveOrderGroupReceipt(501);
  assert.equal(h.db.orders[0].receivedQty,4);
  assert.equal(h.db.orders[1].receivedQty,1);
  assert.equal(h.db.parts[0].stockQty,4);
  assert.equal(h.db.parts[1].stockQty,1);
  assert.equal(h.db.parts[0].receiptHistory[0].qty,2);
  assert.equal(h.db.parts[1].receiptHistory[0].qty,1);
  assert.equal(h.db.orders[0].status,'Ordered');
  assert.equal(h.db.orders[1].status,'Ordered');
  assert.equal(h.saves.length,1);
  assert.deepEqual(h.snapshots,[structuredClone(h.db)]);
}

// A bad SECOND line must not modify the first one, even transiently.
{
  const h=harness({inputs:{'ogr-501':'2','ogr-502':'-1'}});
  const before=structuredClone(h.db);
  h.ctx.saveOrderGroupReceipt(501);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  assert.equal(h.ui.close,0);
  assert.equal(h.alerts.length,1);
}
{
  const h=harness({inputs:{'ogr-501':'2','ogr-502':'not a number'}});
  const before=structuredClone(h.db);
  h.ctx.saveOrderGroupReceipt(501);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  assert.equal(h.alerts.length,1);
}

// Fault injected when resolving the second linked part after the first line
// was already staged: the real batch restores all order and inventory rows.
{
  const h=harness({failingPartId:300});
  const before=structuredClone(h.db);
  h.ctx.receiveOrderGroup('ref:group-1');
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  assert.equal(h.ui.render,0);
  assert.ok(h.alerts.some(x=>/review the order and cloud sync status/i.test(x)));
}

// A dangling inventory link must NOT acknowledge a shipment while silently
// omitting its inventory credit.
{
  const h=harness({missingPartId:300});
  const before=structuredClone(h.db);
  h.ctx.receiveOrderGroup('ref:group-1');
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  assert.ok(h.alerts.some(x=>/inventory part is missing/i.test(x)));
}

// Cancel and invalid single-item quantities must never cause a local mutation.
{
  const h=harness({confirmResult:false});
  const before=structuredClone(h.db);
  h.ctx.receiveOrderGroup('ref:group-1');
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
}
{
  const h=harness({inputs:{orReceiveQty:'0'}});
  const before=structuredClone(h.db);
  h.ctx.savePartialOrderReceipt(501);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
}

// saveDB may throw AFTER it persisted/queued side effects. A correct error
// must surface; do not falsely promise rollback or blindly resubmit inventory.
{
  const h=harness({inputs:{orReceiveQty:'1'},saveMode:'after'});
  h.ctx.savePartialOrderReceipt(501);
  assert.equal(h.db.orders[0].receivedQty,3);
  assert.equal(h.db.parts[0].stockQty,3);
  assert.equal(h.db.parts[0].receiptHistory[0].qty,1,'saveDB error lost staged receipt history');
  assert.equal(h.saves.length,1);
  assert.equal(h.ui.close,0);
  assert.ok(h.alerts.some(x=>/review the order and cloud sync status/i.test(x)));
  assert.deepEqual(h.snapshots,[structuredClone(h.db)]);
}

// The production receipt entry point hands the SAME mutation callback to the
// opt-in durable journal when enabled. This test doesn't touch the network.
{
  const h=harness({inputs:{orReceiveQty:'2',orReceiveDate:'2026-09-23'}});
  const calls=[];
  h.ctx.atomicReceiptOutbox={
    shouldHandle:()=>true,
    stage:(work,message)=>{
      calls.push(message);
      return h.ctx.trackerStore.batch(work,{message});
    }
  };
  h.ctx.savePartialOrderReceipt(501);
  assert.equal(calls.length,1,'actual receipt bypassed the opted-in atomic queue');
  assert.equal(h.db.parts[0].stockQty,4);
  assert.equal(h.db.orders[0].receivedQty,4);
  assert.equal(h.db.parts[0].receiptHistory[0].qty,2);
  assert.equal(h.saves.length,1);
}

console.log('real order-receiving rollback and idempotency regression tests passed');
