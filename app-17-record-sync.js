// ---------- V4 RECORD-LEVEL CLOUD SYNC ----------
const CLOUD_CLIENT_ID=sessionStorage.getItem('n594zs_client_id')||crypto.randomUUID();
sessionStorage.setItem('n594zs_client_id',CLOUD_CLIENT_ID);
const CLOUD_PENDING_KEY='n594zs_pending_cloud_v4';
const CLOUD_SNAPSHOT_KEY='n594zs_record_snapshot_v4';
let cloudRecordSnapshot=new Map();
try{const cached=JSON.parse(localStorage.getItem(CLOUD_SNAPSHOT_KEY)||'{}');cloudRecordSnapshot=new Map(Object.entries(cached));}catch(_e){}
let cloudReloadTimer=null, cloudRemoteReloadPending=false;
let lastCloudSyncAt=null;

const RECORD_ARRAYS={project:'projects',part:'parts',order:'orders',log:'logs',document:'docs',checklist:'checklists',maintenance:'maintenance',system:'systems'};
const SYNC_RECORD_TYPES=new Set(['aircraft','settings',...Object.keys(RECORD_ARRAYS)]);
function cloudRecordKey(type,id){return `${type}:${String(id)}`}
function cloudCanonicalJSONValue(x){
  if(Array.isArray(x))return x.map(cloudCanonicalJSONValue);
  if(x&&typeof x==='object'){
    const out={};Object.keys(x).sort().forEach(k=>{out[k]=cloudCanonicalJSONValue(x[k])});return out;
  }
  return x;
}
function cloudStableJSON(x){try{return JSON.stringify(cloudCanonicalJSONValue(x))}catch(_e){return ''}}
for(const [k,v] of cloudRecordSnapshot){
  try{cloudRecordSnapshot.set(k,cloudStableJSON(JSON.parse(v)))}catch(_e){}
}
persistCloudRecordSnapshot();
function persistCloudRecordSnapshot(){try{localStorage.setItem(CLOUD_SNAPSHOT_KEY,JSON.stringify(Object.fromEntries(cloudRecordSnapshot)))}catch(_e){}}
function buildCloudRecordMap(){
  const m=new Map();
  const aircraft=clone(db.aircraft||{});
  if(aircraft.photoPath&&String(aircraft.photo||'').startsWith('data:image/'))aircraft.photo='';
  m.set(cloudRecordKey('aircraft','singleton'),{record_type:'aircraft',record_id:'singleton',data:aircraft});
  m.set(cloudRecordKey('settings','singleton'),{record_type:'settings',record_id:'singleton',data:clone(db.settings||{})});
  Object.entries(RECORD_ARRAYS).forEach(([type,key])=>arr(db[key]).forEach(item=>m.set(cloudRecordKey(type,item.id),{record_type:type,record_id:String(item.id),data:clone(item)})));
  return m;
}
function snapshotFromRows(rows){const m=new Map();for(const r of rows||[]){if(r.deleted_at||!SYNC_RECORD_TYPES.has(r.record_type))continue;m.set(cloudRecordKey(r.record_type,r.record_id),cloudStableJSON(r.data))}return m}
function blankCloudDB(){return {version:4,aircraft:clone(SEED.aircraft),projects:[],parts:[],orders:[],logs:[],docs:[],checklists:[],maintenance:[],systems:[],settings:clone(SEED.settings)}}
function assembleCloudDB(rows){
  const out=blankCloudDB();
  for(const r of rows||[]){
    if(r.deleted_at)continue;
    if(r.record_type==='aircraft')out.aircraft={...out.aircraft,...(r.data||{})};
    else if(r.record_type==='settings')out.settings={...out.settings,...(r.data||{})};
    else if(RECORD_ARRAYS[r.record_type])out[RECORD_ARRAYS[r.record_type]].push(r.data||{});
  }
  return out;
}
async function upsertAllCloudRecords(){
  const rows=[...buildCloudRecordMap().values()].map(r=>({...r,workspace_id:cloudWorkspaceId,deleted_at:null,updated_at:new Date().toISOString(),updated_by:cloudSession.user.id,updated_client:CLOUD_CLIENT_ID}));
  for(let i=0;i<rows.length;i+=50){
    const {error}=await supa.from('tracker_records').upsert(rows.slice(i,i+50),{onConflict:'workspace_id,record_type,record_id'});
    if(error)throw error;
  }
  cloudRecordSnapshot=new Map([...buildCloudRecordMap()].map(([k,v])=>[k,cloudStableJSON(v.data)]));persistCloudRecordSnapshot();
}

loadCloudState=async function(silent=false){
  if(!supa||!cloudWorkspaceId)return;
  if(navigator.onLine&&canCloudEdit()&&localStorage.getItem(CLOUD_PENDING_KEY)==='1'&&cloudRecordSnapshot.size){await saveCloudState();}
  cloudLoading=true;
  try{
    let {data:rows,error}=await supa.from('tracker_records').select('record_type,record_id,data,deleted_at,updated_at,updated_by,updated_client').eq('workspace_id',cloudWorkspaceId).is('deleted_at',null);
    if(error)throw error;
    if(!rows?.length){
      const legacy=await supa.from('app_state').select('data').eq('workspace_id',cloudWorkspaceId).maybeSingle();
      if(legacy.error)throw legacy.error;
      if(legacy.data?.data&&Object.keys(legacy.data.data).length){db=legacy.data.data;normalizeDB();}
      if(typeof migrateAircraftPhotoToCloudIfNeeded==='function')await migrateAircraftPhotoToCloudIfNeeded();
      normalizeDB();
      await upsertAllCloudRecords();
      await supa.from('app_state').update({data:{migratedTo:'tracker_records',migratedAt:new Date().toISOString()},updated_by:cloudSession.user.id,updated_at:new Date().toISOString()}).eq('workspace_id',cloudWorkspaceId);
      ({data:rows,error}=await supa.from('tracker_records').select('record_type,record_id,data,deleted_at,updated_at,updated_by,updated_client').eq('workspace_id',cloudWorkspaceId).is('deleted_at',null));
      if(error)throw error;
      if(!silent)toast('Shared workspace upgraded to record-level sync.','good');
    }
    db=assembleCloudDB(rows||[]);
    normalizeDB();
    // Snapshot the normalized in-memory state, not the raw row JSON. Otherwise
    // harmless normalization defaults can look like unsaved local edits later.
    cloudRecordSnapshot=new Map([...buildCloudRecordMap()].map(([k,v])=>[k,cloudStableJSON(v.data)]));persistCloudRecordSnapshot();
    persistCloudCache();
    renderAll();
    lastCloudSyncAt=new Date();
    cloudStatusLabel('Synced');
    if(!silent)toast('Loaded shared N594ZS data.','good');
    if(typeof ensureDailySnapshot==='function')setTimeout(()=>ensureDailySnapshot(),500);
  }finally{cloudLoading=false;}
}

queueCloudSave=function(){
  if(!supa||!cloudSession||!cloudWorkspaceId||cloudLoading||!canCloudEdit())return;
  localStorage.setItem(CLOUD_PENDING_KEY,'1');
  cloudDirty=true;
  clearTimeout(cloudSaveTimer);
  cloudStatusLabel(navigator.onLine?'Saving…':'Offline');
  if(navigator.onLine)cloudSaveTimer=setTimeout(saveCloudState,450);
}

saveCloudState=async function(){
  if(!supa||!cloudSession||!cloudWorkspaceId||cloudLoading||!canCloudEdit())return;
  if(!navigator.onLine){localStorage.setItem(CLOUD_PENDING_KEY,'1');cloudStatusLabel('Offline');return;}
  try{
    if(typeof migrateAircraftPhotoToCloudIfNeeded==='function'){
      const migrated=await migrateAircraftPhotoToCloudIfNeeded();
      if(migrated)persistCloudCache();
    }
    normalizeDB();
    const now=new Date().toISOString(),current=buildCloudRecordMap(),changed=[];
    for(const [key,r] of current){
      const js=cloudStableJSON(r.data);
      if(cloudRecordSnapshot.get(key)!==js){changed.push({...r,workspace_id:cloudWorkspaceId,deleted_at:null,updated_at:now,updated_by:cloudSession.user.id,updated_client:CLOUD_CLIENT_ID});}
    }
    const removed=[];
    for(const key of cloudRecordSnapshot.keys())if(!current.has(key))removed.push(key);
    if(changed.length){
      for(let i=0;i<changed.length;i+=50){const {error}=await supa.from('tracker_records').upsert(changed.slice(i,i+50),{onConflict:'workspace_id,record_type,record_id'});if(error)throw error;}
    }
    for(const key of removed){
      const pos=key.indexOf(':'),type=key.slice(0,pos),id=key.slice(pos+1);
      const {error}=await supa.from('tracker_records').update({deleted_at:now,updated_at:now,updated_by:cloudSession.user.id,updated_client:CLOUD_CLIENT_ID}).eq('workspace_id',cloudWorkspaceId).eq('record_type',type).eq('record_id',id);
      if(error)throw error;
    }
    cloudRecordSnapshot=new Map([...current].map(([k,v])=>[k,cloudStableJSON(v.data)]));persistCloudRecordSnapshot();
    localStorage.removeItem(CLOUD_PENDING_KEY);
    cloudDirty=false;
    lastCloudSyncAt=new Date();
    cloudStatusLabel('Synced');
    if(cloudRemoteReloadPending){
      cloudRemoteReloadPending=false;
      setTimeout(()=>loadCloudState(true).catch(e=>{console.warn('Deferred cloud refresh failed',e);cloudStatusLabel('Reconnecting…')}),75);
    }
    if(typeof renderSystem==='function'&&currentPage==='system')renderSystem();
  }catch(err){console.error('Record sync failed',err);cloudStatusLabel('Sync pending');toast('Saved locally; cloud sync failed: '+err.message,'bad');}
}

stopCloudRealtime=function(){if(cloudChannel&&supa)supa.removeChannel(cloudChannel);cloudChannel=null;clearTimeout(cloudReloadTimer)}
startCloudRealtime=function(){
  stopCloudRealtime();
  if(!supa||!cloudSession||!cloudWorkspaceId)return;
  cloudChannel=supa.channel(`n594zs-records-${cloudWorkspaceId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'tracker_records',filter:`workspace_id=eq.${cloudWorkspaceId}`},payload=>{
      const row=payload.new||payload.old||{};
      if(row.updated_client===CLOUD_CLIENT_ID)return;
      clearTimeout(cloudReloadTimer);
      cloudReloadTimer=setTimeout(async()=>{
        try{
          // Never reload over a local save that is still pending. Remember that
          // the cloud changed and refresh from the canonical server state after
          // the local save finishes instead.
          if(cloudDirty||localStorage.getItem(CLOUD_PENDING_KEY)==='1'){
            cloudRemoteReloadPending=true;
            return;
          }
          await loadCloudState(true);
          cloudRemoteReloadPending=false;
          toast('N594ZS updated from another device.','good');
        }catch(e){console.warn('Realtime refresh deferred',e);cloudStatusLabel('Reconnecting…')}
      },350);
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED')cloudStatusLabel(localStorage.getItem(CLOUD_PENDING_KEY)==='1'?'Saving…':'Synced');
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')cloudStatusLabel('Reconnecting…');
    });
}

forceCloudReload=async function(){closeModal();await loadCloudState(true);cloudStatusLabel('Synced');toast('Shared data reloaded.','good')}

window.addEventListener('offline',()=>{if(cloudSession)cloudStatusLabel('Offline')});
window.addEventListener('online',()=>{if(cloudSession){cloudStatusLabel('Reconnecting…');const first=localStorage.getItem(CLOUD_PENDING_KEY)==='1'?saveCloudState():Promise.resolve();first.then(()=>loadCloudState(true)).then(()=>{startCloudRealtime();cloudStatusLabel('Synced');toast('Back online and synced.','good')}).catch(e=>{console.error(e);cloudStatusLabel('Sync pending')})}});
