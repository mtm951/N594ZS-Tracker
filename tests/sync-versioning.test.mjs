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
function makeHarness(rpcResult){
  const localStorage=storage({
    n594zs_record_snapshot_v4:JSON.stringify({'project:1':'{"id":1,"title":"Old"}'}),
    n594zs_record_versions_v1:JSON.stringify({'project:1':7}),
    n594zs_pending_cloud_v4:'1'
  });
  const sessionStorage=storage();
  const rpcCalls=[];
  const context={
    console,
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
    navigator:{onLine:true},
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
    cloudStatusLabel:()=>{},
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
        return {data:structuredClone(rpcResult),error:null};
      },
      from:()=>{throw new Error('unexpected table query in this test')},
      channel:()=>({on(){return this},subscribe(){return this}}),
      removeChannel:()=>{}
    }
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(syncSource,context,{filename:'app-17-record-sync.js'});
  return {context,localStorage,rpcCalls};
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

console.log('sync-versioning regression tests passed');
