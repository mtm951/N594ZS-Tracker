import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeCode=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const outboxCode=fs.readFileSync(new URL('../app-66-atomic-receipt-outbox.js',import.meta.url),'utf8');
const OUTBOX='n594zs_atomic_receipt_outbox_v1';
const OPT='n594zs_atomic_receipts_opt_in_v1';
const PENDING='n594zs_pending_cloud_v4';
const SNAP='n594zs_record_snapshot_v4';
const VERS='n594zs_record_versions_v1';

function storage(seed={},denyKey=null){
  const m=new Map(Object.entries(seed));
  return {
    getItem:k=>m.has(k)?m.get(k):null,
    setItem(k,v){if(k===denyKey)throw new Error('Storage quota exhausted');m.set(k,String(v))},
    removeItem:k=>m.delete(k),
    dump:()=>Object.fromEntries(m)
  };
}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
    const out={};for(const k of Object.keys(value).sort())out[k]=canonical(value[k]);
    return out;
  }
  return value;
}
function stable(x){return JSON.stringify(canonical(x))}
function makeHarness({online=true,enabled=true,seed=null,failKey=null,onRpc=null,receiptSaveError=null}={}){
  const before=seed?.db||{
    parts:[{id:21,name:'TEST WASHER',stockQty:0,status:'Order',unit:'ea'}],
    orders:[{id:31,item:'TEST WASHER',partId:21,qty:4,receivedQty:0,inventoryApplied:false,status:'Ordered',updates:[]}],
    projects:[],settings:{showCosts:true},logs:[],docs:[],checklists:[]
  };
  const db=structuredClone(before),base={
    'part:21':stable(seed?.baseline?.parts?.[0]||db.parts[0]),
    'order:31':stable(seed?.baseline?.orders?.[0]||db.orders[0])
  };
  const versions={'part:21':seed?.baseline?.partVersion||2,'order:31':seed?.baseline?.orderVersion||3};
  const initial=seed?.storage||{[OPT]:enabled?'1':'0',[SNAP]:JSON.stringify(base),[VERS]:JSON.stringify(versions)};
  const localStorage=storage(initial,failKey);
  const rpcCalls=[],saved=[],statuses=[],alerts=[];
  let oldSaveCount=0,oldLoadCount=0;
  const ctx={
    console:{...console,warn:()=>{}},JSON,Date,Map,Set,Array,Object,String,Number,Boolean,Math,Promise,Error,
    structuredClone,
    window:null,db,RECORD_ARRAYS:{part:'parts',order:'orders'},
    CLOUD_CLIENT_ID:'client-1',
    CLOUD_PENDING_KEY:PENDING,
    cloudRecordSnapshot:new Map(Object.entries(base)),
    cloudRecordVersions:new Map(Object.entries(versions)),
    cloudSession:{user:{id:'user-1'}},cloudWorkspaceId:'workspace-1',
    cloudDirty:false,
    supa:{rpc:async(name,args)=>{
      assert.equal(name,'sync_tracker_records_atomic');
      rpcCalls.push(structuredClone(args));
      if(onRpc)return onRpc(name,args,rpcCalls.length);
      return {data:{
        applied:args.changes.map((r,i)=>({record_type:r.record_type,record_id:r.record_id,record_version:r.expected_version+1})),
        conflicts:[],replayed:false
      },error:null};
    }},
    crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},
    cloudRecordKey:(type,id)=>type+':'+String(id),cloudStableJSON:stable,
    localStorage,sessionStorage:storage(),navigator:{onLine:online},
    clone:structuredClone,arr:x=>Array.isArray(x)?x:[],
    canCloudEdit:()=>true,
    cloudStatusLabel:x=>statuses.push(x),
    toast:()=>{},
    persistBrowserData:async value=>{localStorage.setItem('cache',JSON.stringify(value))},
    DB_KEY:'cache',
    saveDB:message=>{
      assert.ok(localStorage.getItem(OUTBOX),'saveDB ran before durable journal');
      saved.push({message,db:structuredClone(ctx.db)});
      if(receiptSaveError)throw new Error(receiptSaveError);
    },
    renderAll:()=>{},
    alert:x=>alerts.push(String(x)),
    confirm:()=>true,
    modalHeader:()=>'',openModal:()=>{},esc:String,
    document:{querySelector:()=>null},
    saveCloudState:async()=>{
      oldSaveCount++;
      localStorage.removeItem(PENDING);
      return {applied:[]};
    },
    loadCloudState:async()=>{oldLoadCount++},
    forceCloudReload:async()=>{oldLoadCount++},
    openCloudAccount:()=>{},
    cloudSignOut:async()=>{},
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(storeCode,ctx,{filename:'app-17a-data-store.js'});
  vm.runInContext(outboxCode,ctx,{filename:'app-66-atomic-receipt-outbox.js'});
  return {ctx,db,localStorage,rpcCalls,saved,statuses,alerts,
    oldSaveCount:()=>oldSaveCount,oldLoadCount:()=>oldLoadCount};
}
function receiptWork(tx){
  tx.update('part',21,p=>{p.stockQty+=2;p.status='On Hand';
    p.receiptHistory=[{id:71,orderUpdateId:71,orderId:31,date:'2026-09-23',qty:2}]});
  tx.update('order',31,o=>{o.receivedQty+=2;o.updates.push({id:71,date:'2026-09-23',text:'Received 2 ea (partial receipt).'})});
}

{
  const h=makeHarness();
  assert.equal(h.ctx.atomicReceiptOutbox.enabled(),true);
  h.ctx.atomicReceiptOutbox.stage(receiptWork,'Two washers received');
  const pending=JSON.parse(h.localStorage.getItem(OUTBOX));
  assert.equal(pending.changes.length,2);
  assert.equal(pending.before.length,2);
  assert.equal(h.saved.length,1);
  assert.equal(h.saved[0].db.parts[0].stockQty,2);
  assert.equal(h.saved[0].db.orders[0].receivedQty,2);
  assert.equal(h.localStorage.getItem(PENDING),'1');
  assert.equal(pending.operationId,'11111111-1111-4111-8111-111111111111');
  assert.deepEqual(pending.changes.map(x=>x.expected_version).sort(),[2,3]);
  assert.equal(pending.changes.find(x=>x.record_type==='part').data.receiptHistory[0].qty,2);
  const outcome=await h.ctx.saveCloudState();
  assert.equal(outcome.applied.length,0,'normal guarded sync should have no leftover fixture changes');
  assert.equal(h.rpcCalls.length,1,'atomic RPC did not receive a single linked request');
  assert.equal(h.localStorage.getItem(OUTBOX),null,'acknowledged journal not cleared');
  assert.equal(h.oldSaveCount(),1,'general sync should follow atomic acknowledgement');
  const versions=JSON.parse(h.localStorage.getItem(VERS));
  assert.equal(versions['part:21'],3);assert.equal(versions['order:31'],4);
  const snapshot=JSON.parse(h.localStorage.getItem(SNAP));
  assert.equal(JSON.parse(snapshot['part:21']).stockQty,2);
  assert.equal(JSON.parse(snapshot['order:31']).receivedQty,2);
}
{
  // An offline receipt is locally journaled; attempts to receive another
  // shipment while that operation remains pending are safely rejected.
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stage(receiptWork,'Offline receipt');
  const first=h.localStorage.getItem(OUTBOX);
  const result=await h.ctx.saveCloudState();
  assert.equal(result.pending,true);
  assert.equal(h.rpcCalls.length,0);
  assert.equal(h.localStorage.getItem(OUTBOX),first);
  assert.throws(()=>h.ctx.atomicReceiptOutbox.stage(receiptWork,'Duplicate'),/earlier receipt is still pending/);
  assert.equal(h.db.parts[0].stockQty,2);
}
{
  // After a crash between journal and asynchronous cache write, replay
  // reconstructs the SAME records, IDs, data and server operation ID.
  const h1=makeHarness({online:false});
  const original=structuredClone(h1.db);
  h1.ctx.atomicReceiptOutbox.stage(receiptWork,'Crash fixture');
  const storageAfterCrash=h1.localStorage.dump();
  const h2=makeHarness({seed:{db:original,storage:storageAfterCrash}});
  assert.equal(h2.db.parts[0].stockQty,0);
  await h2.ctx.atomicReceiptOutbox.recoverLocal();
  assert.equal(h2.db.parts[0].stockQty,2);
  assert.equal(h2.db.orders[0].receivedQty,2);
  const outcome=await h2.ctx.atomicReceiptOutbox.flush();
  assert.equal(outcome.success,true);
  assert.equal(h2.rpcCalls[0].operation_id,JSON.parse(storageAfterCrash[OUTBOX]).operationId);
  assert.equal(h2.localStorage.getItem(OUTBOX),null);
}
{
  // A transport failure leaves the exact payload ready for a same-ID retry.
  let calls=0;
  const h=makeHarness({onRpc:async(_name,args)=>{
    calls++;
    if(calls===1)return {data:null,error:new Error('Simulated timeout')};
    return {data:{applied:args.changes.map(r=>({
      record_type:r.record_type,record_id:r.record_id,record_version:r.expected_version+1
    })),conflicts:[],replayed:true},error:null};
  }});
  h.ctx.atomicReceiptOutbox.stage(receiptWork,'Retry fixture');
  const payload=h.localStorage.getItem(OUTBOX);
  const failed=await h.ctx.saveCloudState();
  assert.equal(failed.pending,true);
  assert.equal(h.oldSaveCount(),0);
  assert.equal(h.localStorage.getItem(OUTBOX),payload);
  const result=await h.ctx.saveCloudState();
  assert.equal(result.applied.length,0);
  assert.equal(calls,2);
  assert.deepEqual(h.rpcCalls[0],h.rpcCalls[1]);
  assert.equal(h.localStorage.getItem(OUTBOX),null);
}
{
  const h=makeHarness({onRpc:async()=>({data:{applied:[],conflicts:[
    {record_type:'part',record_id:'21',expected_version:2,actual_version:3}
  ]},error:null})});
  h.ctx.atomicReceiptOutbox.stage(receiptWork,'Conflict fixture');
  const result=await h.ctx.saveCloudState();
  assert.equal(result.pending,true);
  assert.equal(h.oldSaveCount(),0);
  assert.equal(JSON.parse(h.localStorage.getItem(OUTBOX)).blocked,true);
  assert.equal(h.localStorage.getItem(PENDING),'1');
  assert.equal(h.ctx.cloudRecordVersions.get('part:21'),2);
  await assert.rejects(h.ctx.loadCloudState(true),/awaiting atomic cloud sync/);
  assert.equal(h.oldLoadCount(),0,'cloud reloaded over a pending conflicting receipt');
  assert.equal(h.rpcCalls.length,1,'a blocked conflict was retried automatically');
  await h.ctx.forceCloudReload();
  assert.equal(h.oldLoadCount(),0);
}
{
  // No server operation can be queued if local journal persistence failed.
  const h=makeHarness({failKey:OUTBOX});
  const old=structuredClone(h.db);
  assert.throws(()=>h.ctx.atomicReceiptOutbox.stage(receiptWork,'Storage full'),/Storage quota exhausted/);
  assert.deepEqual(h.db,old);
  assert.equal(h.saved.length,0);
  assert.equal(h.localStorage.getItem(OUTBOX),null);
}
{
  // Existing unrelated unsynced changes must not silently hitchhike on a
  // receipt's server request and evade normal conflict detection.
  const h=makeHarness();
  h.localStorage.setItem(PENDING,'1');
  const old=structuredClone(h.db);
  assert.throws(()=>h.ctx.atomicReceiptOutbox.stage(receiptWork,'Prior pending'),/Other changes are waiting/);
  assert.deepEqual(h.db,old);
}
{
  // Journal identity is bound to both workspace and authenticated user.
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stage(receiptWork,'Identity fixture');
  h.ctx.cloudSession={user:{id:'different-user'}};
  const result=await h.ctx.saveCloudState();
  assert.equal(result.pending,true);
  assert.equal(h.rpcCalls.length,0);
  await assert.rejects(h.ctx.loadCloudState(true),/different workspace or account/);
}
{
  // Atomic support is OFF unless explicitly enabled on each device; it
  // cannot unexpectedly replace the existing proven receipt pathway.
  const h=makeHarness({enabled:false});
  assert.equal(h.ctx.atomicReceiptOutbox.shouldHandle(),false);
  assert.equal(h.ctx.atomicReceiptOutbox.hasPending(),false);
}
console.log('opt-in atomic receipt journal, replay and crash recovery tests passed');
