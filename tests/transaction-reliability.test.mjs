import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// This is a contract test of the synchronous store batch. It deliberately
// simulates a multi-record receipt rather than calling the production receipt
// engine, which still has its own implementation and separate tests.
const source=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');

function harness(saveMode='ok'){
  const saves=[],snapshots=[];
  const db={
    aircraft:{id:'singleton',registration:'N594ZS'},
    settings:{currency:'USD'},
    projects:[{id:31,title:'Fuel closeout',steps:[{id:1,done:false}],updates:[]}],
    parts:[{id:21,name:'AN fitting',stockQty:1,linkedProjectIds:[31],receipts:[]}],
    orders:[{id:11,item:'AN fitting',partId:21,projectId:31,qty:5,receivedQty:1,
      inventoryAppliedQty:1,inventoryApplied:false,status:'Ordered',updates:[]}],
    logs:[{id:41,work:'Earlier inspection',consumedParts:[]}]
  };
  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,Promise,structuredClone,
    RECORD_ARRAYS:{project:'projects',part:'parts',order:'orders',log:'logs'},
    db,
    saveDB:message=>{
      saves.push(message);
      if(saveMode==='fail-before')throw new Error('simulated save failure before effects');
      snapshots.push(structuredClone(db));
      if(saveMode==='fail-after')throw new Error('simulated save failure after effects');
    }
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'app-17a-data-store.js'});
  return {context,store:context.trackerStore,db,saves,snapshots};
}

function stageReceipt(tx,quantity){
  const order=tx.read('order',11);
  if(!order)throw new Error('missing order');
  const remaining=order.qty-order.receivedQty;
  if(quantity<=0||quantity>remaining)throw new Error('invalid receipt quantity');
  tx.update('order',11,draft=>{
    draft.receivedQty+=quantity;
    draft.inventoryAppliedQty+=quantity;
    draft.inventoryApplied=draft.receivedQty===draft.qty;
    draft.status=draft.inventoryApplied?'Received':'Ordered';
    draft.updates.push({id:51,text:'Receipt '+quantity});
  });
  tx.update('part',order.partId,draft=>{
    draft.stockQty+=quantity;
    draft.receipts.push({orderId:11,qty:quantity});
  });
  tx.update('project',order.projectId,draft=>{
    draft.updates.push({id:52,text:'Ordered part received'});
  });
  tx.write('log',42,{id:42,work:'Receipt audit entry',consumedParts:[],orderId:11});
}

// One sync batch commits once, and the saved snapshot includes ALL four records.
{
  const h=harness();
  const result=h.store.batch(tx=>{stageReceipt(tx,4);return 'receipt staged'}, {message:'Four records updated.'});
  assert.equal(result,'receipt staged');
  assert.equal(h.db.orders[0].receivedQty,5);
  assert.equal(h.db.orders[0].inventoryAppliedQty,5);
  assert.equal(h.db.orders[0].inventoryApplied,true);
  assert.equal(h.db.parts[0].stockQty,5);
  assert.equal(h.db.parts[0].receipts.length,1);
  assert.equal(h.db.projects[0].updates.length,1);
  assert.equal(h.db.projects[0].steps[0].done,false,'unrelated project state changed');
  assert.equal(h.db.logs.length,2);
  assert.deepEqual(h.saves,['Four records updated.']);
  assert.deepEqual(h.snapshots,[structuredClone(h.db)],'save captured partial transaction state');
}

// If the third step fails, no order/part/project/log change survives or saves.
{
  const h=harness(),before=structuredClone(h.db);
  assert.throws(()=>h.store.batch(tx=>{
    tx.update('order',11,draft=>{draft.receivedQty+=2});
    tx.update('part',21,draft=>{draft.stockQty+=2});
    throw new Error('project lookup failed');
  },{message:'Must not save'}),/project lookup failed/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  // Failed batches must release their guard so a later legitimate save works.
  h.store.batch(tx=>tx.update('project',31,d=>{d.title='Recovered'}),{message:'Recovery'});
  assert.equal(h.db.projects[0].title,'Recovered');
  assert.deepEqual(h.saves,['Recovery']);
}

// Create, delete, and singleton changes must also roll back together.
{
  const h=harness(),before=structuredClone(h.db);
  assert.throws(()=>h.store.batch(tx=>{
    tx.remove('log',41);
    tx.write('project',32,{id:32,title:'New project',steps:[]});
    tx.write('settings','singleton',{currency:'CAD'});
    throw new Error('stop before commit');
  }),/stop before commit/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
}

// If an updater rejects the change, it cannot leave an invalid partial state.
{
  const h=harness(),before=structuredClone(h.db);
  assert.throws(()=>h.store.batch(tx=>{
    tx.update('part',21,d=>{d.stockQty=10});
    tx.update('project',999,d=>{d.title='Missing'});
  }),/Record not found/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
}

// Invalid or changed identities cannot create mismatched record keys in sync.
{
  const h=harness(),before=structuredClone(h.db);
  assert.throws(()=>h.store.batch(tx=>{
    tx.update('order',11,d=>{d.receivedQty=4});
    tx.write('part',22,{id:21,name:'Wrong id'});
  }),/Record id mismatch for part/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
  assert.throws(()=>h.store.update('part',21,d=>{d.id=22}),/Record id mismatch for part/);
  assert.deepEqual(h.db,before);
}

// A returned async mutator is rejected. Its scoped API is immediately revoked,
// preventing it from mutating after an await resumes.
{
  const h=harness(),before=structuredClone(h.db);
  let lateError;
  let markDone;
  const settled=new Promise(resolve=>{markDone=resolve});
  assert.throws(()=>h.store.batch(async tx=>{
    tx.update('part',21,d=>{d.stockQty=99});
    await Promise.resolve();
    try{tx.write('log',99,{id:99,work:'Late write'})}
    catch(error){lateError=error}
    markDone();
  }),/Async trackerStore batches are not supported yet/);
  await settled;
  assert.match(lateError?.message||'',/batch has already ended/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves.length,0);
}

// A scoped transaction cannot be reused after successful completion.
{
  const h=harness();
  let oldTx;
  h.store.batch(tx=>{oldTx=tx;tx.update('part',21,d=>{d.stockQty=2})});
  assert.throws(()=>oldTx.update('part',21,d=>{d.stockQty=999}),/batch has already ended/);
  assert.equal(h.db.parts[0].stockQty,2);
  assert.equal(h.saves.length,1);
}

// A requested staged batch can be committed later exactly once.
{
  const h=harness();
  h.store.batch(tx=>stageReceipt(tx,2),{persist:false});
  assert.equal(h.db.orders[0].receivedQty,3);
  assert.equal(h.saves.length,0);
  h.store.commit('Explicit staged commit');
  assert.deepEqual(h.saves,['Explicit staged commit']);
}

// A synchronous saveDB error AFTER a side effect is not a safe rollback.
// Keep staged memory rather than inventing a different state from the snapshot
// the browser may have already persisted. This does NOT establish cloud atomicity.
{
  const h=harness('fail-after');
  assert.throws(()=>h.store.batch(tx=>{
    tx.update('part',21,d=>{d.stockQty=7});
    tx.update('order',11,d=>{d.receivedQty=3});
  },{message:'Attempted save'}),/simulated save failure after effects/);
  assert.equal(h.db.parts[0].stockQty,7);
  assert.equal(h.db.orders[0].receivedQty,3);
  assert.equal(h.saves.length,1);
  assert.deepEqual(h.snapshots,[structuredClone(h.db)]);
}

// Even if saveDB fails before its first effect, the store must report the
// failure, retain the staged state, and avoid claiming a committed batch.
{
  const h=harness('fail-before');
  assert.throws(()=>h.store.batch(tx=>tx.update('project',31,d=>{d.title='Needs retry'})),
    /simulated save failure before effects/);
  assert.equal(h.db.projects[0].title,'Needs retry');
  assert.equal(h.saves.length,1);
  assert.equal(h.snapshots.length,0);
}

console.log('transaction reliability regression tests passed (local batch only; cloud atomicity not implied)');
