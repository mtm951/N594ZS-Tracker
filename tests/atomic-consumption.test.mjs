import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeCode=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const outboxCode=fs.readFileSync(new URL('../app-66-atomic-receipt-outbox.js',import.meta.url),'utf8');
const KEY='n594zs_atomic_receipt_outbox_v1';
const OPT='n594zs_atomic_consumption_opt_in_v1';
const SNAP='n594zs_record_snapshot_v4';
const VERS='n594zs_record_versions_v1';
const PENDING='n594zs_pending_cloud_v4';

function stable(x){
  if(x===undefined)return undefined;
  return JSON.stringify((function canonical(v){
    if(Array.isArray(v))return v.map(canonical);
    if(v&&typeof v==='object'){
      const out={};for(const k of Object.keys(v).sort())out[k]=canonical(v[k]);
      return out;
    }
    return v;
  })(x));
}
function makeDb({installed=true,stockQty=0}={}){
  return {
    orders:[],logs:[],
    parts:[{id:21,name:'TEST LOCK NUT',unit:'ea',stockQty,
      linkedProjectIds:[41],inventoryAdjustments:[]}],
    projects:[{id:41,title:'TEST INSTALL',status:'In Progress',
      plannedParts:[{id:501,partId:21,qty:2,unit:'ea',name:'TEST LOCK NUT'}],
      partsUsed:[]}],
    purchases:installed?[{id:'p1',qty:2,disposition:'Installed',
      inventoryPartId:21,inventoryReceiptMaterializedQty:0,
      inventoryReceiptMaterialized:false,inventoryApplied:true}]:[],
    settings:{}
  };
}
function memory(initial={},deny=null){
  const map=new Map(Object.entries(initial));
  return {
    getItem:k=>map.has(k)?map.get(k):null,
    setItem(k,v){if(k===deny)throw new Error('Quota reached');map.set(k,String(v))},
    removeItem:k=>map.delete(k),
    dump:()=>Object.fromEntries(map)
  };
}
function makeHarness({db:input=null,stored=null,online=true,failKey=null,onRpc=null,onCloudRead=null}={}){
  const db=structuredClone(input||makeDb());
  const snapshot=stored?.[SNAP]?JSON.parse(stored[SNAP]):Object.fromEntries([
    ...db.parts.map(x=>['part:'+x.id,stable(x)]),
    ...db.projects.map(x=>['project:'+x.id,stable(x)]),
    ...db.logs.map(x=>['log:'+x.id,stable(x)]),
    ...db.purchases.map(x=>['purchase:'+x.id,stable(x)])
  ]);
  const versions=stored?.[VERS]?JSON.parse(stored[VERS]):{
    'part:21':2,'project:41':4,
    ...Object.fromEntries(db.logs.map(x=>['log:'+x.id,5])),
    ...(db.purchases.length?{'purchase:p1':3}:{})
  };
  const localStorage=memory(stored||{[OPT]:'1',[SNAP]:JSON.stringify(snapshot),
    [VERS]:JSON.stringify(versions)},failKey);
  const rpcCalls=[],saves=[],alerts=[],statuses=[],downloads=[];
  const ctx={
    console:{...console,warn(){}},JSON,Date,Map,Set,Array,Object,String,Number,Boolean,Math,Promise,Error,
    structuredClone,window:null,db,
    RECORD_ARRAYS:{part:'parts',project:'projects',log:'logs',purchase:'purchases',order:'orders'},
    CLOUD_CLIENT_ID:'test-client',cloudRecordSnapshot:new Map(Object.entries(snapshot)),
    cloudRecordVersions:new Map(Object.entries(versions)),cloudSession:{user:{id:'user-1'}},
    cloudWorkspaceId:'workspace-1',cloudDirty:false,
    cloudRecordKey:(type,id)=>type+':'+String(id),cloudStableJSON:stable,
    crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
    localStorage,sessionStorage:memory(),navigator:{onLine:online},DB_KEY:'test-cache',
    supa:{
      rpc:async(name,args)=>{
        assert.equal(name,'sync_tracker_records_atomic');
        rpcCalls.push(structuredClone(args));
        if(onRpc)return onRpc(name,args,rpcCalls.length);
        return {data:{applied:args.changes.map(r=>({
          record_type:r.record_type,record_id:r.record_id,
          record_version:r.expected_version+1})),conflicts:[],replayed:false},error:null};
      },
      from:table=>{
        assert.equal(table,'tracker_records');
        return {select:()=>({eq:()=>({in:async()=>{
          const e=JSON.parse(localStorage.getItem(KEY));
          if(onCloudRead)return onCloudRead(e);
          return {data:e.changes.map(r=>({record_type:r.record_type,
            record_id:r.record_id,data:structuredClone(r.data),
            deleted_at:null,record_version:r.expected_version+1})),error:null};
        }})})};
      }
    },
    arr:x=>Array.isArray(x)?x:[],clone:structuredClone,canCloudEdit:()=>true,
    cloudStatusLabel:x=>statuses.push(x),toast:()=>{},
    saveDB:message=>{if(message!=='Original consumption recovered; later reservations preserved.')
        assert.ok(localStorage.getItem(KEY),'journal was not saved first');
      saves.push({message,db:structuredClone(ctx.db)})},
    persistBrowserData:async data=>{localStorage.setItem('test-cache',JSON.stringify(data))},
    renderAll:()=>{},alert:x=>alerts.push(String(x)),confirm:()=>true,
    modalHeader:()=>'',openModal:()=>{},esc:String,today:()=> '2026-09-24',
    downloadJSON:(record,name)=>downloads.push({record:structuredClone(record),name}),document:{querySelector:()=>null},
    saveCloudState:async()=>{localStorage.removeItem(PENDING);return {applied:[]}},
    loadCloudState:async()=>{},forceCloudReload:async()=>{},
    openCloudAccount:()=>{},cloudSignOut:async()=>{}
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(storeCode,ctx,{filename:'app-17a-data-store.js'});
  vm.runInContext(outboxCode,ctx,{filename:'app-66-atomic-receipt-outbox.js'});
  return {ctx,db,localStorage,rpcCalls,saves,alerts,statuses,downloads};
}
const META={mode:'reserved',partId:21,projectId:41,reservationId:501,
  logId:888,consumedItemId:901,projectPartId:902,qty:2};
function consumeWork(installed=true){
  return tx=>{
    if(installed){
      tx.update('purchase','p1',p=>{
        p.inventoryReceiptMaterializedQty=2;
        p.inventoryReceiptMaterialized=true;p.inventoryApplied=true;
      });
    }
    tx.update('part',21,p=>{if(installed)p.stockQty=2;});
    tx.update('project',41,p=>{
      p.plannedParts=[];
      p.partsUsed.push({id:902,partId:21,qty:2,unit:'ea',
        logId:888,consumedItemId:901,consumptionRecorded:true});
    });
    tx.write('log',888,{
      id:888,date:'2026-09-24',airframeHours:'',engineHours:'',laborHours:'',
      system:'Hardware',projectIds:[41],work:'Used test hardware',
      observations:'',blockers:'',nextStep:'',otherCost:'',notes:'Test',
      origin:'reserved-part-use',consumedParts:[{id:901,partId:21,qty:2,
        unit:'ea',projectPartId:902}]
    });
  };
}

// Production-default: four records in ONE version-checked RPC, including a
// genuinely new Work Log with expected_version=0. Legacy opt-out is ignored.
{
  const h=makeHarness();
  h.localStorage.removeItem(OPT);
  assert.equal(h.ctx.atomicReceiptOutbox.consumptionEnabled(),true);
  assert.equal(h.ctx.atomicReceiptOutbox.shouldHandle('consumption'),true);
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(), 'TEST consumption',META);
  const pending=JSON.parse(h.localStorage.getItem(KEY));
  assert.equal(pending.operationKind,'consumption');
  assert.deepEqual(new Set(pending.changes.map(x=>x.record_type)),
    new Set(['part','project','log','purchase']));
  assert.equal(pending.changes.find(x=>x.record_type==='log').expected_version,0);
  assert.equal(pending.before.find(x=>x.key==='log:888').data,null);
  assert.equal(h.ctx.atomicReceiptOutbox.isPendingRecord('log',888),true);
  assert.equal(h.ctx.atomicReceiptOutbox.isPendingRecord('log',889),false);
  assert.throws(()=>h.ctx.trackerStore.update('log',888,d=>{d.work='bad mutation'}),/pending/i);
  assert.equal(h.db.logs[0].work,'Used test hardware');
  assert.equal(h.saves.length,1);
  await h.ctx.saveCloudState();
  assert.equal(h.rpcCalls.length,1,'linked records split into multiple cloud writes');
  assert.equal(h.rpcCalls[0].changes.length,4);
  assert.equal(h.localStorage.getItem(KEY),null);
  assert.equal(h.ctx.atomicReceiptOutbox.isPendingRecord('log',888),false);
  assert.equal(h.ctx.cloudRecordVersions.get('log:888'),1);
  await h.ctx.saveCloudState();
  assert.equal(h.rpcCalls.length,1,'repeated sync duplicated a consumption');
  assert.equal(h.db.logs.length,1);
}

// Supervised recovery: if the atomic use is still intact locally and the
// only newer Project edit is a later reservation, replay the ORIGINAL
// operation and then restore that reservation as a separate local edit.
{
  const db=makeDb({installed:false,stockQty:5});
  db.parts.push({id:22,name:'LATER CLAMP',unit:'ea',stockQty:10,
    linkedProjectIds:[41],inventoryAdjustments:[]});
  const h=makeHarness({db,onCloudRead:e=>{
    const rows=[];
    for(const change of e.changes){
      const prior=e.before.find(x=>x.key===change.record_type+':'+String(change.record_id));
      if(prior?.data!==null)rows.push({record_type:change.record_type,
        record_id:change.record_id,data:structuredClone(prior.data),
        deleted_at:null,record_version:change.expected_version});
    }
    rows.push({record_type:'part',record_id:'22',data:structuredClone(db.parts[1]),
      deleted_at:null,record_version:1});
    return {data:rows,error:null};
  }});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(false),'TEST later-reservation recovery',META);
  const operationId=JSON.parse(h.localStorage.getItem(KEY)).operationId;
  h.db.projects[0].plannedParts=[{id:777,partId:22,qty:2,unit:'ea',name:'LATER CLAMP'}];

  const result=await h.ctx.atomicReceiptOutbox.resolvePostStagedReservations();
  assert.equal(result.resolved,true);
  assert.equal(h.rpcCalls.length,1,'recovery sent more than the original atomic operation');
  assert.equal(h.rpcCalls[0].operation_id,operationId,'recovery changed the atomic operation ID');
  assert.equal(h.localStorage.getItem(KEY),null,'successful recovery retained the live journal');
  assert.equal(h.db.logs.filter(x=>x.id===888).length,1,'recovery duplicated the Work Log');
  assert.equal(h.db.projects[0].partsUsed.filter(x=>x.logId===888).length,1,'recovery duplicated Parts Used');
  assert.deepEqual(h.db.projects[0].plannedParts,
    [{id:777,partId:22,qty:2,unit:'ea',name:'LATER CLAMP'}],
    'later reservation was not restored after atomic acknowledgement');
  assert.equal(h.localStorage.getItem(PENDING),'1','later reservation should remain queued for normal sync');
}

// Assigned -> Used: Part + Project + new Work Log + Installed Purchase
// provenance are one scoped transaction, with no reservation mutation.
{
  const db=makeDb();db.projects[0].plannedParts=[];
  const h=makeHarness({db});
  const meta={mode:'assigned',partId:21,projectId:41,logId:889,
    consumedItemId:910,projectPartId:911,qty:1};
  h.ctx.atomicReceiptOutbox.stageConsumption(tx=>{
    tx.update('purchase','p1',p=>{
      p.inventoryReceiptMaterializedQty=1;p.inventoryReceiptMaterialized=true;p.inventoryApplied=true;
    });
    tx.update('part',21,p=>{p.stockQty=1});
    tx.update('project',41,p=>{p.partsUsed.push({id:911,partId:21,qty:1,unit:'ea',
      logId:889,consumedItemId:910,consumptionRecorded:true})});
    tx.write('log',889,{id:889,date:'2026-09-24',airframeHours:'',engineHours:'',laborHours:'',
      system:'Hardware',projectIds:[41],work:'Assigned use',observations:'',blockers:'',nextStep:'',
      otherCost:'',notes:'Assigned → Used.',origin:'assigned-part-use',
      consumedParts:[{id:910,partId:21,qty:1,unit:'ea',projectPartId:911}]});
  },'Assigned use',meta);
  const journal=JSON.parse(h.localStorage.getItem(KEY));
  assert.deepEqual(new Set(journal.changes.map(x=>x.record_type)),
    new Set(['part','project','log','purchase']));
  assert.equal(journal.changes.find(x=>x.record_type==='project').data.plannedParts.length,0);
}

// Quick Part Used may consume more than an existing reservation; it releases
// that reservation while recording the actual larger physical use.
{
  const h=makeHarness();
  h.db.projects[0].plannedParts[0].qty=1;
  h.ctx.cloudRecordSnapshot.set('project:41',stable(h.db.projects[0]));
  const snapshots=JSON.parse(h.localStorage.getItem(SNAP));
  snapshots['project:41']=stable(h.db.projects[0]);
  h.localStorage.setItem(SNAP,JSON.stringify(snapshots));
  const meta={mode:'quick',partId:21,projectId:41,reservationId:501,logId:890,
    consumedItemId:912,projectPartId:913,qty:2};
  h.ctx.atomicReceiptOutbox.stageConsumption(tx=>{
    tx.update('purchase','p1',p=>{
      p.inventoryReceiptMaterializedQty=2;p.inventoryReceiptMaterialized=true;p.inventoryApplied=true;
    });
    tx.update('part',21,p=>{p.stockQty=2});
    tx.update('project',41,p=>{
      p.partsUsed.push({id:913,partId:21,qty:2,unit:'ea',logId:890,
        consumedItemId:912,consumptionRecorded:true});
      p.plannedParts=[];
    });
    tx.write('log',890,{id:890,date:'2026-09-24',airframeHours:'',engineHours:'',laborHours:'',
      system:'Hardware',projectIds:[41],work:'Quick use',observations:'',blockers:'',nextStep:'',
      otherCost:'',notes:'Created by Quick Add 2.0.',origin:'quick-part-use',
      consumedParts:[{id:912,partId:21,qty:2,unit:'ea',projectPartId:913}]});
  },'Quick use',meta);
  assert.equal(JSON.parse(h.localStorage.getItem(KEY)).operationKind,'consumption');
  assert.equal(h.db.projects[0].plannedParts.length,0);
}

// Existing Work Log consumption appends exactly one item while locking the
// source Part and any materialized Installed-Purchase receipt in the same op.
{
  const db=makeDb();
  db.logs=[{id:777,date:'2026-09-24',system:'Hardware',projectIds:[41],work:'Existing work',
    observations:'',blockers:'',nextStep:'',otherCost:'',notes:'',consumedParts:[]}];
  const h=makeHarness({db});
  const meta={mode:'log-add',partId:21,logId:777,consumedItemId:914,qty:1,projectIds:[41]};
  h.ctx.atomicReceiptOutbox.stageConsumption(tx=>{
    tx.update('purchase','p1',p=>{
      p.inventoryReceiptMaterializedQty=1;p.inventoryReceiptMaterialized=true;p.inventoryApplied=true;
    });
    tx.update('part',21,p=>{p.stockQty=1});
    tx.update('log',777,l=>{l.consumedParts.push({id:914,partId:21,qty:1,unit:'ea',notes:'Added'})});
  },'Log use',meta);
  const journal=JSON.parse(h.localStorage.getItem(KEY));
  assert.deepEqual(new Set(journal.changes.map(x=>x.record_type)),new Set(['part','log','purchase']));
  assert.equal(journal.changes.find(x=>x.record_type==='log').expected_version,5);
}

// Purchase -> Stock Received is a two-record transaction. It cannot change
// arbitrary Purchase or Part metadata while crediting physical stock.
{
  const db=makeDb({installed:false,stockQty:0});
  db.purchases=[{id:'p1',qty:2,remainingQty:2,disposition:'Unknown',inventoryPartId:21,
    inventoryApplied:false,vendor:'Test Vendor',location:'Shelf',projectId:41,notes:'Source'}];
  db.parts[0].status='Order';db.parts[0].vendor='';db.parts[0].location='';
  const h=makeHarness({db});
  assert.equal(h.ctx.atomicReceiptOutbox.shouldHandle('purchase'),true);
  h.ctx.atomicReceiptOutbox.stagePurchaseReceipt(tx=>{
    tx.update('part',21,p=>{
      p.stockQty=2;p.status='On Hand';p.vendor='Test Vendor';p.location='Shelf';
    });
    tx.update('purchase','p1',p=>{
      p.inventoryPartId=21;p.inventoryApplied=true;p.disposition='On Hand';p.remainingQty=2;
    });
  },'Purchase received',{purchaseId:'p1',partId:21,qty:2});
  const journal=JSON.parse(h.localStorage.getItem(KEY));
  assert.equal(journal.operationKind,'purchase');
  assert.deepEqual(new Set(journal.changes.map(x=>x.record_type)),new Set(['part','purchase']));
  assert.equal(h.db.parts[0].stockQty,2);
  assert.equal(h.db.purchases[0].inventoryApplied,true);
}

// Offline durable journal can restore a partially saved browser cache,
// including a missing NEW Work Log, without crediting purchases twice.
{
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Offline reserved consumption',META);
  const offline=await h.ctx.saveCloudState();
  assert.equal(offline.pending,true);
  assert.equal(h.rpcCalls.length,0);
  const partial=structuredClone(h.db);partial.logs=[];
  const restored=makeHarness({db:partial,stored:h.localStorage.dump()});
  const recovered=await restored.ctx.atomicReceiptOutbox.recoverLocal();
  assert.equal(recovered,true);
  assert.equal(restored.db.logs.length,1);
  assert.equal(restored.db.parts[0].stockQty,2);
  assert.equal(restored.db.purchases[0].inventoryReceiptMaterializedQty,2);
  await restored.ctx.saveCloudState();
  assert.equal(restored.rpcCalls.length,1);
  assert.equal(restored.localStorage.getItem(KEY),null);
}

// Regression for the real-world offline failure: a user edited the newly
// staged Work Log while the operation was pending. Recovery must reject the
// mismatch without altering any local records or clearing the journal.
{
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Offline use',META);
  const staged=JSON.parse(h.localStorage.getItem(KEY)).changes
    .find(x=>x.record_type==='log').data;
  h.db.logs[0].work+='\\nOffline test notes added while pending';
  const before=structuredClone(h.db);
  await assert.rejects(h.ctx.atomicReceiptOutbox.recoverLocal(),
    /pending atomic Work Log was edited locally/i);
  assert.deepEqual(h.db,before,'Recovery must preserve the divergent local note');
  assert.ok(h.localStorage.getItem(KEY),'Recovery cleared an unacknowledged journal');
  assert.equal(h.ctx.atomicReceiptOutbox.isPendingRecord('log',888),true);
  // The owner can compare the already-downloaded safety copy and restore the
  // original staged text in the pre-update tab. Once exact, replay is safe.
  h.db.logs[0].work=staged.work;
  assert.equal(await h.ctx.atomicReceiptOutbox.recoverLocal(),false);
  h.ctx.navigator.onLine=true;
  const applied=await h.ctx.saveCloudState();
  assert.equal(h.rpcCalls.length,1);
  assert.equal(h.localStorage.getItem(KEY),null);
  assert.equal(h.ctx.atomicReceiptOutbox.isPendingRecord('log',888),false);
  assert.equal(h.ctx.trackerStore.update('log',888,d=>{d.work+=' after sync'},{persist:false}).work,
    'Used test hardware after sync');
}

// Newer UI offers a BACKUP-FIRST recovery path for the pre-lock case where
// only log TEXT was edited after staging; no consumed items or quantities can
// be silently adjusted, and no RPC runs until the owner explicitly retries.
{
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Offline use',META);
  const queued=h.localStorage.getItem(KEY);
  const staged=JSON.parse(queued).changes.find(x=>x.record_type==='log').data;
  h.db.logs[0].work+='\\nOwner note written while offline';
  const extra=h.db.logs[0].work,previousPart=structuredClone(h.db.parts[0]);
  const previousProject=structuredClone(h.db.projects[0]);
  assert.equal(await h.ctx.atomicReceiptOutbox.restorePendingWorkLog(),true);
  assert.equal(h.downloads.length,1,'Text restore did not back up local edits first');
  assert.match(h.downloads[0].record.localRecords.find(x=>x.record_type==='log').data.work,/Owner note/);
  assert.equal(h.db.logs[0].work,staged.work);
  assert.deepEqual(h.db.parts[0],previousPart);
  assert.deepEqual(h.db.projects[0],previousProject);
  assert.equal(h.localStorage.getItem(KEY),queued,'Repair changed pending operation ID or payload');
  assert.equal(h.rpcCalls.length,0,'Local repair unexpectedly submitted a cloud transaction');
  h.ctx.navigator.onLine=true;
  await h.ctx.saveCloudState();
  assert.equal(h.rpcCalls.length,1);
  assert.equal(h.localStorage.getItem(KEY),null);
  assert.equal(h.ctx.atomicReceiptOutbox.isPendingRecord('log',888),false);
  assert.match(extra,/Owner note/);
}
{
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Offline use',META);
  h.db.logs[0].consumedParts[0].qty=99;
  assert.equal(await h.ctx.atomicReceiptOutbox.restorePendingWorkLog(),false);
  assert.equal(h.db.logs[0].consumedParts[0].qty,99,'Structural mismatch was silently overwritten');
  assert.equal(h.downloads.length,0,'Unsafe structural drift offered text-only repair');
  assert.ok(h.localStorage.getItem(KEY));
}
{
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Offline use',META);
  h.db.logs[0].work+='\\nKept on cancel';
  h.ctx.confirm=()=>false;
  assert.equal(await h.ctx.atomicReceiptOutbox.restorePendingWorkLog(),false);
  assert.equal(h.downloads.length,0);
  assert.match(h.db.logs[0].work,/Kept on cancel/);
}

// Even when Part stockQty does not change, its version is included as a
// source-stock lock, so two devices cannot blindly consume the same Part.
{
  const h=makeHarness({db:makeDb({installed:false,stockQty:4})});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(false),'Stock-only use',META);
  const changes=JSON.parse(h.localStorage.getItem(KEY)).changes;
  const part=changes.find(x=>x.record_type==='part');
  assert.ok(part);
  assert.equal(part.expected_version,2);
  assert.equal(part.data.stockQty,4);
  assert.equal(changes.length,3);
}

// An unrelated Project write (or a different log relationship) fails BEFORE
// a durable journal and rolls back the entire scoped mutation.
{
  const h=makeHarness(),original=structuredClone(h.db);
  assert.throws(()=>h.ctx.atomicReceiptOutbox.stageConsumption(tx=>{
    consumeWork()(tx);
    tx.update('project',41,p=>{p.title='Unexpected extra edit'});
  },'Invalid use',META),/unrelated Project field/);
  assert.deepEqual(h.db,original);
  assert.equal(h.localStorage.getItem(KEY),null);
}
{
  const h=makeHarness({failKey:KEY}),original=structuredClone(h.db);
  assert.throws(()=>h.ctx.atomicReceiptOutbox.stageConsumption(
    consumeWork(),'Quota failure',META),/Quota reached/);
  assert.deepEqual(h.db,original,'failed journal write left local inventory altered');
}

// A second operation cannot overtake a pending journal, even with the new
// consumption toggle turned OFF while offline.
{
  const h=makeHarness({online:false});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'First use',META);
  h.localStorage.removeItem(OPT);
  assert.equal(h.ctx.atomicReceiptOutbox.shouldHandle('consumption'),true);
  assert.throws(()=>h.ctx.atomicReceiptOutbox.stageConsumption(
    consumeWork(),'Duplicate use',META),/earlier receipt is still pending/);
  assert.equal(h.db.logs.length,1);
}

// A version conflict blocks the WHOLE Part/Project/Log/Purchase RPC; exact
// cloud-payload review can acknowledge an operation without applying it again.
{
  const h=makeHarness({onRpc:()=>({data:{
    applied:[],conflicts:[{record_type:'part',record_id:'21',actual_version:8}],
    replayed:false},error:null})});
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Conflicting use',META);
  const conflict=await h.ctx.saveCloudState();
  assert.equal(conflict.pending,true);
  assert.equal(JSON.parse(h.localStorage.getItem(KEY)).blocked,true);
  assert.equal(h.rpcCalls.length,1);
  await h.ctx.saveCloudState();
  assert.equal(h.rpcCalls.length,1,'blocked journal retried automatically');
  const acknowledged=await h.ctx.atomicReceiptOutbox.reviewConflict();
  assert.equal(acknowledged.resolved,true);
  assert.equal(h.rpcCalls.length,1,'exact-match review re-applied a consumption');
  assert.equal(h.localStorage.getItem(KEY),null);
}
{
  const h=makeHarness({
    onRpc:()=>({data:{applied:[],conflicts:[{record_type:'project',record_id:'41'}]},error:null}),
    onCloudRead:e=>({data:e.changes.map(r=>({record_type:r.record_type,
      record_id:r.record_id,data:r.record_type==='project'?{id:41,title:'Conflicting edit'}:r.data,
      record_version:r.expected_version+1,deleted_at:null})),error:null})
  });
  h.ctx.atomicReceiptOutbox.stageConsumption(consumeWork(),'Divergent use',META);
  await h.ctx.saveCloudState();
  const review=await h.ctx.atomicReceiptOutbox.reviewConflict();
  assert.equal(review.matched,false);
  assert.ok(h.localStorage.getItem(KEY),'divergent journal was improperly cleared');
}

console.log('atomic Reserve -> Use four-record journal, recovery, conflict and replay tests passed');
