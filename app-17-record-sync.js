// ---------- V4 RECORD-LEVEL CLOUD SYNC ----------
const CLOUD_CLIENT_ID=sessionStorage.getItem('n594zs_client_id')||crypto.randomUUID();
sessionStorage.setItem('n594zs_client_id',CLOUD_CLIENT_ID);
const CLOUD_PENDING_KEY='n594zs_pending_cloud_v4';
const CLOUD_SNAPSHOT_KEY='n594zs_record_snapshot_v4';
const CLOUD_VERSION_KEY='n594zs_record_versions_v1';
let cloudRecordSnapshot=new Map(),cloudRecordVersions=new Map();
try{const cached=JSON.parse(localStorage.getItem(CLOUD_SNAPSHOT_KEY)||'{}');cloudRecordSnapshot=new Map(Object.entries(cached));}catch(_e){}
try{const cached=JSON.parse(localStorage.getItem(CLOUD_VERSION_KEY)||'{}');cloudRecordVersions=new Map(Object.entries(cached).map(([k,v])=>[k,Number(v)||0]));}catch(_e){}
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
persistCloudRecordSnapshot();persistCloudRecordVersions();
function persistCloudRecordSnapshot(){try{localStorage.setItem(CLOUD_SNAPSHOT_KEY,JSON.stringify(Object.fromEntries(cloudRecordSnapshot)))}catch(_e){}}
function persistCloudRecordVersions(){try{localStorage.setItem(CLOUD_VERSION_KEY,JSON.stringify(Object.fromEntries(cloudRecordVersions)))}catch(_e){}}
function buildCloudRecordMap(){
  const m=new Map();
  const aircraft=clone(db.aircraft||{});
  if(aircraft.photoPath&&String(aircraft.photo||'').startsWith('data:image/'))aircraft.photo='';
  m.set(cloudRecordKey('aircraft','singleton'),{record_type:'aircraft',record_id:'singleton',data:aircraft});
  m.set(cloudRecordKey('settings','singleton'),{record_type:'settings',record_id:'singleton',data:clone(db.settings||{})});
  Object.entries(RECORD_ARRAYS).forEach(([type,key])=>arr(db[key]).forEach(item=>m.set(cloudRecordKey(type,item.id),{record_type:type,record_id:String(item.id),data:clone(item)})));
  return m;
}
// PostgREST commonly caps an unpaginated select at 1,000 rows. Never mark
// a truncated workspace Synced: incomplete imports create false missing links.
// Read a stable, explicit ordering and verify every page against exact count.
async function cloudReadAllTrackerRecords({columns,types=null,activeOnly=false,pageSize=500}={}){
  if(!supa||!cloudWorkspaceId)throw new Error('Cloud workspace is not connected.');
  const PAGE=Math.max(1,Math.min(500,Number(pageSize)||500));
  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    const all=[],seen=new Set();let total=null,failed=false;
    try{
      for(let offset=0;offset===0||offset<total;offset+=PAGE){
        let query=supa.from('tracker_records')
          .select(columns||'record_type,record_id,data,deleted_at,record_version',{count:'exact'})
          .eq('workspace_id',cloudWorkspaceId);
        if(types?.length)query=query.in('record_type',types);
        if(activeOnly)query=query.is('deleted_at',null);
        const {data,error,count}=await query.order('record_type',{ascending:true})
          .order('record_id',{ascending:true}).range(offset,offset+PAGE-1);
        if(error)throw error;
        if(!Number.isSafeInteger(count)||count<0)throw new Error('Cloud returned no verifiable record count.');
        if(total===null)total=count;
        if(count!==total){failed=true;throw new Error('Cloud records changed while loading; retrying complete read.');}
        if(total===0)return [];
        if(!Array.isArray(data)||!data.length)throw new Error('Cloud returned an incomplete page.');
        for(const row of data){
          const key=cloudRecordKey(row.record_type,row.record_id);
          if(seen.has(key))throw new Error('Duplicate cloud record between pages: '+key);
          seen.add(key);all.push(row);
        }
      }
      if(all.length!==total)throw new Error('Cloud record count mismatch: '+all.length+' of '+total+'.');
      return all;
    }catch(error){lastError=error;if(attempt===1)break;}
  }
  throw lastError||new Error('Could not verify a complete cloud record download.');
}
window.cloudReadAllTrackerRecords=cloudReadAllTrackerRecords;
function snapshotFromRows(rows){const m=new Map();for(const r of rows||[]){if(r.deleted_at||!SYNC_RECORD_TYPES.has(r.record_type))continue;m.set(cloudRecordKey(r.record_type,r.record_id),cloudStableJSON(r.data))}return m}
function versionsFromRows(rows){const m=new Map();for(const r of rows||[]){if(!SYNC_RECORD_TYPES.has(r.record_type))continue;m.set(cloudRecordKey(r.record_type,r.record_id),Number(r.record_version)||0)}return m}
async function refreshCloudRecordVersions(keys=null){
  if(!supa||!cloudWorkspaceId)return cloudRecordVersions;
  const wanted=keys?new Set([...keys]):null;
  const rows=await cloudReadAllTrackerRecords({columns:'record_type,record_id,record_version,deleted_at',types:[...SYNC_RECORD_TYPES]});
  for(const row of rows||[]){
    const key=cloudRecordKey(row.record_type,row.record_id);
    if(!wanted||wanted.has(key))cloudRecordVersions.set(key,Number(row.record_version)||0);
  }
  persistCloudRecordVersions();
  return cloudRecordVersions;
}
window.refreshCloudRecordVersions=refreshCloudRecordVersions;
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
  await refreshCloudRecordVersions();
}

loadCloudState=async function(silent=false){
  if(!supa||!cloudWorkspaceId)return;
  if(navigator.onLine&&canCloudEdit()&&localStorage.getItem(CLOUD_PENDING_KEY)==='1'&&cloudRecordSnapshot.size){await saveCloudState();}
  cloudLoading=true;
  try{
    let rows=await cloudReadAllTrackerRecords({columns:'record_type,record_id,data,deleted_at,updated_at,updated_by,updated_client,record_version',activeOnly:true});
    if(!rows?.length){
      const legacy=await supa.from('app_state').select('data').eq('workspace_id',cloudWorkspaceId).maybeSingle();
      if(legacy.error)throw legacy.error;
      if(legacy.data?.data&&Object.keys(legacy.data.data).length){db=legacy.data.data;normalizeDB();}
      if(typeof migrateAircraftPhotoToCloudIfNeeded==='function')await migrateAircraftPhotoToCloudIfNeeded();
      normalizeDB();
      await upsertAllCloudRecords();
      await supa.from('app_state').update({data:{migratedTo:'tracker_records',migratedAt:new Date().toISOString()},updated_by:cloudSession.user.id,updated_at:new Date().toISOString()}).eq('workspace_id',cloudWorkspaceId);
      rows=await cloudReadAllTrackerRecords({columns:'record_type,record_id,data,deleted_at,updated_at,updated_by,updated_client,record_version',activeOnly:true});
      if(!silent)toast('Shared workspace upgraded to record-level sync.','good');
    }
    db=assembleCloudDB(rows||[]);
    normalizeDB();
    cloudRecordVersions=versionsFromRows(rows||[]);persistCloudRecordVersions();
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
    const now=new Date().toISOString(),current=buildCloudRecordMap(),changed=[],removed=[];
    for(const [key,r] of current){
      const js=cloudStableJSON(r.data);
      if(cloudRecordSnapshot.get(key)!==js)changed.push({key,...r});
    }
    for(const key of cloudRecordSnapshot.keys())if(!current.has(key))removed.push(key);

    const dirtyKeys=[...changed.map(x=>x.key),...removed];
    if(dirtyKeys.length){
      const missing=dirtyKeys.filter(k=>!cloudRecordVersions.has(k));
      if(missing.length)await refreshCloudRecordVersions(missing);
    }

    const requests=[];
    for(const r of changed){
      requests.push({
        record_type:r.record_type,
        record_id:r.record_id,
        data:r.data,
        deleted_at:null,
        expected_version:Number(cloudRecordVersions.get(r.key))||0,
        updated_client:CLOUD_CLIENT_ID
      });
    }
    for(const key of removed){
      const pos=key.indexOf(':'),type=key.slice(0,pos),id=key.slice(pos+1);
      requests.push({
        record_type:type,
        record_id:id,
        data:null,
        deleted_at:now,
        expected_version:Number(cloudRecordVersions.get(key))||0,
        updated_client:CLOUD_CLIENT_ID
      });
    }

    const applied=[],versionConflicts=[];
    for(let i=0;i<requests.length;i+=50){
      const batch=requests.slice(i,i+50);
      const {data,error}=await supa.rpc('sync_tracker_records_guarded',{target_workspace:cloudWorkspaceId,changes:batch});
      if(error)throw error;
      applied.push(...arr(data?.applied));
      versionConflicts.push(...arr(data?.conflicts));
    }

    for(const a of applied){
      const key=cloudRecordKey(a.record_type,a.record_id);
      cloudRecordVersions.set(key,Number(a.record_version)||0);
      if(a.deleted_at)cloudRecordSnapshot.delete(key);
      else if(current.has(key))cloudRecordSnapshot.set(key,cloudStableJSON(current.get(key).data));
    }
    for(const x of versionConflicts){
      const key=cloudRecordKey(x.record_type,x.record_id);
      cloudRecordVersions.set(key,Number(x.actual_version)||0);
    }
    persistCloudRecordSnapshot();persistCloudRecordVersions();

    if(versionConflicts.length){
      localStorage.setItem(CLOUD_PENDING_KEY,'1');
      cloudDirty=true;
      cloudStatusLabel('Conflict');
      return {applied,versionConflicts};
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
    return {applied,versionConflicts:[]};
  }catch(err){console.error('Record sync failed',err);cloudStatusLabel('Sync pending');toast('Saved locally; cloud sync failed: '+err.message,'bad');return {error:err};}
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
