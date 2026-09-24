import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeCode=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const outboxCode=fs.readFileSync(new URL('../app-66-atomic-receipt-outbox.js',import.meta.url),'utf8');
const blockersCode=fs.readFileSync(new URL('../app-67-linked-order-blockers.js',import.meta.url),'utf8');
const OUTBOX='n594zs_atomic_receipt_outbox_v1';
const OPT='n594zs_atomic_receipts_opt_in_v1';
const PENDING='n594zs_pending_cloud_v4';
const SNAP='n594zs_record_snapshot_v4';
const VERS='n594zs_record_versions_v1';

const clean=x=>JSON.parse(JSON.stringify(x));
function stable(x){
  if(Array.isArray(x))return x.map(stable);
  if(x&&typeof x==='object'){
    const out={};for(const k of Object.keys(x).sort())out[k]=stable(x[k]);return out;
  }
  return x;
}
const str=x=>JSON.stringify(stable(x));
function storage(seed={}){
  const map=new Map(Object.entries(seed));
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,val)=>map.set(key,String(val)),
    removeItem:key=>map.delete(key)
  };
}
function fixture(){
  return {
    parts:[{id:21,name:'Test panel light',stockQty:0,unit:'ea'}],
    orders:[{id:31,item:'Test panel light',projectId:41,partId:21,qty:4,
      receivedQty:0,status:'Ordered',unit:'ea',updates:[]}],
    projects:[{id:41,title:'Install test light',status:'Held Up',percent:40,
      blockers:'',updates:[],partsUsed:[],orderBlockerHeld:true,
      orderBlockers:[{id:71,orderId:31,description:'Waiting on panel light',
        requiredQty:2,status:'waiting',holdsProject:true}]}],
    logs:[],purchases:[],settings:{},aircraft:{}
  };
}
function harness(db=fixture(),{atomic=false,online=true,server=null}={}){
  let uid=900,modal='',saves=0;
  const events=[],rpc=[],alerts=[];
  const base={},versions={};
  for(const [type,array] of [['part','parts'],['order','orders'],['project','projects']]){
    for(const row of db[array]){
      const key=type+':'+row.id;base[key]=str(row);versions[key]=2;
    }
  }
  const localStorage=storage(atomic?{[OPT]:'1',[SNAP]:JSON.stringify(base),[VERS]:JSON.stringify(versions)}:{});
  const ctx={
    console,JSON,Date,Map,Set,Array,Object,String,Number,Boolean,Math,Promise,
    structuredClone,window:null,db,RECORD_ARRAYS:{part:'parts',order:'orders',project:'projects',log:'logs',purchase:'purchases'},
    localStorage,sessionStorage:storage(),navigator:{onLine:online},
    document:{getElementById:()=>null,querySelector:()=>null},
    uid:()=>++uid,today:()=> '2026-09-24',
    arr:x=>Array.isArray(x)?x:[],num:x=>Number(x)||0,esc:String,
    partById:id=>db.parts.find(x=>String(x.id)===String(id)),
    projectById:id=>db.projects.find(x=>String(x.id)===String(id)),
    orderById:id=>db.orders.find(x=>String(x.id)===String(id)),
    orderReceivedQty:o=>Number(o.receivedQty)||0,
    saveDB:()=>{saves++;if(atomic)assert.ok(localStorage.getItem(OUTBOX),'Journal must predate saveDB');},
    openProjectDetail:()=>{},projectCloseoutAudit:()=>({issues:[],warnings:[],review:[],ready:true}),
    openModal:x=>{modal=x},modalHeader:()=>'',toast:(...x)=>events.push(x),alert:x=>alerts.push(x),
    confirm:()=>true,cloudRecordKey:(type,id)=>type+':'+id,cloudStableJSON:str,
    CLOUD_CLIENT_ID:'client-test',cloudRecordSnapshot:new Map(Object.entries(base)),
    cloudRecordVersions:new Map(Object.entries(versions)),
    cloudSession:{user:{id:'user-test'}},cloudWorkspaceId:'workspace-test',
    cloudDirty:false,canCloudEdit:()=>true,cloudStatusLabel:()=>{},
    crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},
    persistBrowserData:async()=>{},renderAll:()=>{},DB_KEY:'test-db',
    saveCloudState:async()=>{localStorage.removeItem(PENDING);return {applied:[]}},
    loadCloudState:async()=>{},forceCloudReload:async()=>{},cloudSignOut:async()=>{},openCloudAccount:()=>{}
  };
  ctx.supa={rpc:async(name,args)=>{
    assert.equal(name,'sync_tracker_records_atomic');
    rpc.push(clean(args));
    if(server)return server(name,args,rpc.length);
    return {data:{applied:args.changes.map(r=>({record_type:r.record_type,
      record_id:r.record_id,record_version:r.expected_version+1})),
      conflicts:[],replayed:false},error:null};
  }};
  ctx.applyOrderReceipt=function(tx,orderId,amount,date){
    const order=tx.read('order',orderId);
    if(!(amount>0)||amount>order.qty-order.receivedQty)throw new Error('Bad receipt');
    const updateId=ctx.uid();
    tx.update('part',order.partId,p=>{
      p.stockQty+=amount;
      p.receiptHistory=[...(p.receiptHistory||[]),{id:updateId,orderId,qty:amount}];
    });
    tx.update('order',orderId,o=>{
      o.receivedQty+=amount;
      o.status=o.receivedQty===o.qty?'Received':'Ordered';
      o.updates.push({id:updateId,date:date||ctx.today(),text:'Received '+amount});
    });
    return amount;
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(storeCode,ctx,{filename:'app-17a-data-store.js'});
  if(atomic)vm.runInContext(outboxCode,ctx,{filename:'app-66-atomic-receipt-outbox.js'});
  vm.runInContext(blockersCode,ctx,{filename:'app-67-linked-order-blockers.js'});
  return {ctx,db,localStorage,rpc,alerts,events,saves:()=>saves,modal:()=>modal};
}
function receipt(h,qty,orderId=31){
  return h.ctx.trackerStore.batch(tx=>h.ctx.applyOrderReceipt(tx,orderId,qty),'2026-09-24'),
    h.ctx.trackerStore.commit('Order received.');
}

// Partial receipt does not resolve a two-unit requirement; reaching the
// threshold resolves exactly once and does NOT wait for the whole order.
{
  const h=harness();
  receipt(h,1);
  assert.equal(h.db.projects[0].status,'Held Up');
  assert.equal(h.db.projects[0].orderBlockers[0].status,'waiting');
  receipt(h,1);
  assert.equal(h.db.projects[0].status,'In Progress');
  assert.equal(h.db.projects[0].blockers,'');
  assert.equal(h.db.projects[0].orderBlockers[0].status,'resolved');
  assert.equal(h.db.projects[0].orderBlockers[0].resolvedBy,'receipt');
  assert.equal(h.db.parts[0].stockQty,2);
  receipt(h,2);
  assert.equal(h.db.projects[0].updates.filter(u=>u.text.startsWith('Order blocker resolved:')).length,1,
    'subsequent receipt duplicated the resolution event');
}

// Multiple linked blockers must ALL be resolved before an order-held project
// automatically resumes work.
{
  const db=fixture();
  db.orders.push({id:32,item:'Second test terminal',partId:22,projectId:41,qty:1,receivedQty:0,status:'Ordered',updates:[]});
  db.parts.push({id:22,name:'Second test terminal',stockQty:0});
  db.projects[0].orderBlockers.push({id:72,orderId:32,description:'Awaiting terminal',
    requiredQty:1,status:'waiting',holdsProject:true});
  const h=harness(db);
  receipt(h,2);
  assert.equal(db.projects[0].status,'Held Up');
  receipt(h,1,32);
  assert.equal(db.projects[0].status,'In Progress');
  assert.equal(db.projects[0].orderBlockers.filter(b=>b.status==='resolved').length,2);
}

// A free-text blocker describing a separate problem is never guessed away.
{
  const db=fixture();
  db.projects[0].blockers='Waiting for a second unrelated part';
  const h=harness(db);
  receipt(h,2);
  assert.equal(db.projects[0].status,'Held Up');
  assert.equal(db.projects[0].blockers,'Waiting for a second unrelated part');
  assert.equal(db.projects[0].orderBlockers[0].status,'resolved');
}

// Existing received order: explicit one-click migration archives the old text
// and unblocks WITHOUT touching Order data or crediting stock a second time.
{
  const db=fixture(),p=db.projects[0],o=db.orders[0];
  p.blockers='Waiting for EarthX light on the Spruce order';
  p.orderBlockers=[];p.orderBlockerHeld=false;
  o.qty=1;o.receivedQty=1;o.status='Received';
  db.parts[0].stockQty=1;
  const h=harness(db),originalOrder=clean(o),originalPart=clean(db.parts[0]);
  h.ctx.resolveExistingLinkedOrderBlocker(41);
  assert.equal(p.status,'In Progress');
  assert.equal(p.blockers,'');
  assert.equal(p.orderBlockers[0].status,'resolved');
  assert.equal(p.orderBlockers[0].resolvedBy,'existing-receipt');
  assert.ok(p.updates.some(u=>u.text.includes('Prior free-text blocker archived')));
  assert.deepEqual(o,originalOrder);
  assert.deepEqual(db.parts[0],originalPart);
  assert.equal(h.saves(),1,'linking an already received order should save once');
}

// A user must explicitly approve migrating legacy free text.
{
  const db=fixture();db.orders[0].qty=1;db.orders[0].receivedQty=1;
  db.projects[0].orderBlockers=[];db.projects[0].blockers='Legacy note';
  const h=harness(db);h.ctx.confirm=()=>false;
  const before=clean(db);
  h.ctx.resolveExistingLinkedOrderBlocker(41);
  assert.deepEqual(db,before);
  assert.equal(h.saves(),0);
}
// Linked but not explicitly set as an order blocker: receipt does not edit
// the project's unrelated blocker text, status or history.
{
  const db=fixture();db.projects[0].orderBlockers=[];db.projects[0].orderBlockerHeld=false;
  db.projects[0].blockers='Manual inspection required';
  const h=harness(db);
  receipt(h,2);
  assert.equal(db.projects[0].blockers,'Manual inspection required');
  assert.equal(db.projects[0].updates.length,0);
}
// Invalid required quantity and missing order must roll back safely.
{
  const h=harness(),before=clean(h.db);
  assert.throws(()=>h.ctx.linkOrderBlockerForProject(41,31,'Extra blocker',5,true,false),
    /exceeds the ordered quantity/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves(),0);
}
// Failure while the project resolution is staged cannot leave only inventory
// and Order modified: the real trackerStore rolls back the whole batch.
{
  const h=harness();let calls=0;
  h.ctx.uid=()=>{if(++calls===2)throw new Error('Simulated resolution failure');return calls};
  const before=clean(h.db);
  assert.throws(()=>receipt(h,2),/Simulated resolution failure/);
  assert.deepEqual(h.db,before);
  assert.equal(h.saves(),0);
}
// Opt-in receipt uses the existing durable outbox to journal ALL THREE:
// Order, Part and newly resolved Project in one version-checked RPC.
{
  const h=harness(fixture(),{atomic:true,online:false});
  h.ctx.atomicReceiptOutbox.stage(tx=>h.ctx.applyOrderReceipt(tx,31,2,'2026-09-24'),
    'Atomic linked-blocker receipt');
  const journal=JSON.parse(h.localStorage.getItem(OUTBOX));
  assert.deepEqual(journal.changes.map(r=>r.record_type).sort(),['order','part','project']);
  assert.equal(journal.changes.find(r=>r.record_type==='project').data.status,'In Progress');
  assert.equal(journal.changes.find(r=>r.record_type==='part').data.stockQty,2);
  const offline=await h.ctx.saveCloudState();
  assert.equal(offline.pending,true);
  assert.equal(h.rpc.length,0);
  h.ctx.navigator.onLine=true;
  await h.ctx.saveCloudState();
  assert.equal(h.rpc.length,1);
  assert.equal(h.rpc[0].changes.length,3);
  assert.equal(h.localStorage.getItem(OUTBOX),null);
  assert.equal(h.db.projects[0].orderBlockers[0].status,'resolved');
}

console.log('linked order blocker and atomic receipt regressions passed');
