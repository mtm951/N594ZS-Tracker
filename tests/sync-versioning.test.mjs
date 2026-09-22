import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const syncSource=fs.readFileSync(new URL('../app-17-record-sync.js',import.meta.url),'utf8');

function storage(seed={}){
  const m=new Map(Object.entries(seed));
  return {
    getItem:k=>m.has(k)?m.get(k):null,
    setItem:(k,v)=>m.set(k,String(v)),
    removeItem:k=>m.delete(k),
    dump:()=>Object.fromEntries(m)
  };
}
function makeHarness(rpcResult,{rpcError=null,online=true}={}){
  const localStorage=storage({
    n594zs_record_snapshot_v4:JSON.stringify({
      'aircraft:singleton':'{"id":"singleton"}',
      'settings:singleton':'{}',
      'project:1':'{"id":1,"title":"Old"}'
    }),
    n594zs_record_versions_v1:JSON.stringify({
      'aircraft:singleton':1,
      'settings:singleton':1,
      'project:1':7
    }),
    n594zs_pending_cloud_v4:'1'
  });
  const sessionStorage=storage();
  const rpcCalls=[],statuses=[],errors=[];
  const context={
    console:{...console,error:(...args)=>errors.push(args)},
    JSON,
    Date,
    Map,
    Set,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Math,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    crypto:{randomUUID:()=> 'test-client'},
    sessionStorage,
    localStorage,
    navigator:{onLine:online},
    addEventListener:()=>{},
    db:{
      aircraft:{id:'singleton'},
      settings:{},
      projects:[{id:1,title:'New'}],
      parts:[],orders:[],logs:[],docs:[],checklists:[],maintenance:[],systems:[]
    },
    SEED:{aircraft:{},settings:{}},
    clone:x=>structuredClone(x),
    arr:v=>Array.isArray(v)?v:[],
    normalizeDB:()=>{},
    cloudWorkspaceId:'workspace',
    cloudSession:{user:{id:'user'}},
    cloudLoading:false,
    cloudDirty:true,
    cloudSaveTimer:null,
    cloudChannel:null,
    cloudRole:'owner',
    currentPage:'dashboard',
    canCloudEdit:()=>true,
    cloudStatusLabel:label=>statuses.push(label),
    toast:()=>{},
    persistCloudCache:()=>{},
    renderAll:()=>{},
    renderSystem:()=>{},
    markCloudSynced:()=>{},
    loadCloudState:async()=>{},
    queueCloudSave:()=>{},
    saveCloudState:async()=>{},
    stopCloudRealtime:()=>{},
    startCloudRealtime:()=>{},
    forceCloudReload:async()=>{},
    supa:{
      rpc:async(name,args)=>{
        assert.equal(name,'sync_tracker_records_guarded');
        rpcCalls.push(args);
        return {data:structuredClone(rpcResult),error:rpcError};
      },
      from:()=>{throw new Error('unexpected table query in this test')},
      channel:()=>({on(){return this},subscribe(){return this}}),
      removeChannel:()=>{}
    }
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(syncSource,context,{filename:'app-17-record-sync.js'});
  return {context,localStorage,rpcCalls,statuses,errors};
}

{
  const h=makeHarness({applied:[{record_type:'project',record_id:'1',record_version:8,deleted_at:null}],conflicts:[]});
  const out=await h.context.saveCloudState();
  assert.equal(out.versionConflicts.length,0);
  assert.equal(h.rpcCalls.length,1);
  const change=h.rpcCalls[0].changes[0];
  assert.equal(change.record_type,'project');
  assert.equal(change.record_id,'1');
  assert.equal(change.expected_version,7);
  assert.equal(change.data.title,'New');
  assert.equal(h.localStorage.getItem('n594zs_pending_cloud_v4'),null);
  const versions=JSON.parse(h.localStorage.getItem('n594zs_record_versions_v1'));
  assert.equal(versions['project:1'],8);
}

{
  const h=makeHarness({
    applied:[],
    conflicts:[{record_type:'project',record_id:'1',expected_version:7,actual_version:9,data:{id:1,title:'Cloud'},deleted_at:null}]
  });
  const out=await h.context.saveCloudState();
  assert.equal(out.versionConflicts.length,1);
  assert.equal(h.localStorage.getItem('n594zs_pending_cloud_v4'),'1');
  const versions=JSON.parse(h.localStorage.getItem('n594zs_record_versions_v1'));
  assert.equal(versions['project:1'],9);
}


{
  // If the guarded RPC fails, keep the current local record and the unsynced
  // marker; do not advance the cloud snapshot or its expected row version.
  const h=makeHarness(null,{rpcError:new Error('simulated cloud outage')});
  const out=await h.context.saveCloudState();
  assert.match(out.error.message,/simulated cloud outage/);
  assert.equal(h.localStorage.getItem('n594zs_pending_cloud_v4'),'1');
  assert.equal(h.context.db.projects[0].title,'New');
  assert.equal(h.rpcCalls.length,1);
  assert.ok(h.statuses.includes('Sync pending'));
  assert.equal(h.errors.length,1);
  const versions=JSON.parse(h.localStorage.getItem('n594zs_record_versions_v1'));
  const snapshot=JSON.parse(h.localStorage.getItem('n594zs_record_snapshot_v4'));
  assert.equal(versions['project:1'],7,'failed cloud save advanced expected version');
  assert.equal(JSON.parse(snapshot['project:1']).title,'Old','failed cloud save falsified synced snapshot');
}

{
  // Offline saves remain pending without even attempting the network.
  const h=makeHarness(null,{online:false});
  await h.context.saveCloudState();
  assert.equal(h.localStorage.getItem('n594zs_pending_cloud_v4'),'1');
  assert.equal(h.rpcCalls.length,0);
  assert.ok(h.statuses.includes('Offline'));
  assert.equal(h.context.db.projects[0].title,'New');
}


console.log('sync-versioning regression tests passed');
