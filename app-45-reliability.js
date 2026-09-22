// ---------- V5.5 RELIABILITY / RECOVERY ----------
(function(){
if(window.__n594zsReliabilityInstalled)return;window.__n594zsReliabilityInstalled=true;
const VER='5.6.0',REC='n594zs_local_recovery_v1',CF='n594zs_cloud_conflicts_v1',DIRTY='n594zs_dirty_record_keys_v1',LEGACY_FIX='n594zs_conflict_migration_v554';let conflicts=[];
try{conflicts=JSON.parse(localStorage.getItem(CF)||'[]')||[]}catch(_e){}
const A=v=>Array.isArray(v)?v:[],J=v=>{try{return JSON.stringify(v)}catch(_e){return''}},C=v=>{try{return structuredClone(v)}catch(_e){return JSON.parse(JSON.stringify(v))}},N=v=>{const n=Number(v);return Number.isFinite(n)?n:0},K=(t,id)=>t+':'+String(id);
function recovery(reason){
  const x={format:'N594ZS_LOCAL_RECOVERY_V1',createdAt:new Date().toISOString(),reason,db:C(db)};
  try{localStorage.setItem(REC,JSON.stringify(x))}catch(e){console.warn('localStorage recovery mirror unavailable',e)}
  if(typeof window.storeLocalRecoveryPoint==='function'){
    Promise.resolve(window.storeLocalRecoveryPoint(x)).catch(e=>console.warn('IndexedDB recovery copy failed',e));
  }
  return x
}
function getRecovery(){try{return JSON.parse(localStorage.getItem(REC)||'null')}catch(_e){return null}}
window.restoreLastLocalRecovery=async function(){
  let x=getRecovery();
  if(!x?.db&&typeof window.readLocalRecoveryPoint==='function')x=await window.readLocalRecoveryPoint();
  if(!x?.db)return alert('No local recovery point is stored in this browser.');
  if(!confirm('Restore local recovery point from '+new Date(x.createdAt).toLocaleString()+'?\n\nA recovery point of the current data will be saved first.'))return;
  const old=C(db);recovery('Before local recovery restore');
  try{
    db=C(x.db);normalizeDB();
    if(typeof persistBrowserData==='function')await persistBrowserData(db,{quiet:true});
    else localStorage.setItem(DB_KEY,J(db));
    queueCloudSave();renderAll();toast('Local recovery restored.','good')
  }catch(e){db=old;normalizeDB();alert(e.message)}
};
function audit(t=db){const issues=[],warnings=[],keys=['projects','parts','orders','logs','docs','checklists','maintenance','purchases','squawks','runs','equipment','specs','inspections'],sets={};let total=0;keys.forEach(k=>{const a=A(t?.[k]),s=new Set,du=[];total+=a.length;a.forEach(x=>{const id=String(x?.id??'');if(id&&s.has(id))du.push(id);if(id)s.add(id)});sets[k]=s;if(du.length)issues.push(k+': duplicate IDs ('+[...new Set(du)].slice(0,4).join(', ')+')')});const has=(k,id)=>id==null||id===''||sets[k]?.has(String(id));A(t.projects).forEach(p=>{A(p.partsUsed).forEach(x=>{if(x.partId&&!has('parts',x.partId))warnings.push('Project '+(p.title||p.id)+' references missing part '+x.partId)});A(p.plannedParts).forEach(x=>{if(x.partId&&!has('parts',x.partId))warnings.push('Project '+(p.title||p.id)+' reserves missing part '+x.partId);if(N(x.qty)<0)issues.push('Negative reservation in '+(p.title||p.id))})});A(t.orders).forEach(o=>{if(o.projectId&&!has('projects',o.projectId))warnings.push('Order '+(o.item||o.id)+' links to missing project '+o.projectId);if(o.partId&&!has('parts',o.partId))warnings.push('Order '+(o.item||o.id)+' links to missing part '+o.partId)});A(t.logs).forEach(l=>{A(l.projectIds).forEach(id=>{if(!has('projects',id))warnings.push('Work entry '+(l.work||l.id)+' links to missing project '+id)});A(l.consumedParts).forEach(x=>{if(x.partId&&!has('parts',x.partId))warnings.push('Work entry '+(l.work||l.id)+' consumed missing part '+x.partId);if(N(x.qty)<0)issues.push('Negative consumption in '+(l.work||l.id))})});A(t.docs).forEach(d=>{A(d.linkedProjectIds).forEach(id=>{if(!has('projects',id))warnings.push('Document '+(d.name||d.id)+' links to missing project '+id)});A(d.linkedPartIds).forEach(id=>{if(!has('parts',id))warnings.push('Document '+(d.name||d.id)+' links to missing part '+id)});A(d.linkedLogIds).forEach(id=>{if(!has('logs',id))warnings.push('Document '+(d.name||d.id)+' links to missing work entry '+id)})});A(t.checklists).forEach(c=>{if(c.projectId&&!has('projects',c.projectId))warnings.push('Checklist '+(c.name||c.id)+' links to missing project '+c.projectId)});A(t.purchases).forEach(p=>{if(p.projectId&&!has('projects',p.projectId))warnings.push('Purchase '+(p.description||p.id)+' links to missing project '+p.projectId);if(p.inventoryPartId&&!has('parts',p.inventoryPartId))warnings.push('Purchase '+(p.description||p.id)+' links to missing part '+p.inventoryPartId);if(N(p.qty)<0)issues.push('Negative purchase quantity: '+(p.description||p.id))});if(!t?.aircraft)issues.push('Aircraft record is missing');if(!t?.settings)warnings.push('Settings record is missing');return{issues:[...new Set(issues)],warnings:[...new Set(warnings)],total,checkedAt:new Date().toISOString()}}
window.runReliabilityAudit=function(show=true){const a=audit();if(show)openModal(modalHeader('Data Integrity Check',a.issues.length?'Problems found':a.warnings.length?'Review recommended':'Passed')+'<div class="summary-strip"><div class="summary-cell"><div class="lab">Records</div><div class="val">'+a.total+'</div></div><div class="summary-cell"><div class="lab">Errors</div><div class="val">'+a.issues.length+'</div></div><div class="summary-cell"><div class="lab">Warnings</div><div class="val">'+a.warnings.length+'</div></div></div><div class="detail-card"><h3>Results</h3>'+a.issues.map(x=>'<div class="danger-note" style="margin-bottom:7px">'+esc(x)+'</div>').join('')+a.warnings.map(x=>'<div class="notice" style="margin-bottom:7px">'+esc(x)+'</div>').join('')+(!a.issues.length&&!a.warnings.length?'<div class="notice"><b>No broken core relationships or duplicate IDs found.</b></div>':'')+'<div class="tiny muted" style="margin-top:10px">Structural check only; not an airworthiness or maintenance determination.</div></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Close</button></div>',true);return a};
async function sha(s){if(!crypto?.subtle)return'';const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const expCore=window.exportCoreData;window.exportCoreData=async function(){try{const copy=C(db),core=J(copy),manifest={format:'N594ZS_BACKUP_MANIFEST_V1',appVersion:VER,createdAt:new Date().toISOString(),records:audit(copy).total,sha256:await sha(core)};downloadJSON({format:'N594ZS_TRACKER_CORE_V3',version:3,exportedAt:new Date().toISOString(),manifest,db:copy},'N594ZS_Core_Backup_'+today()+'.json');toast('Verified core backup created.','good')}catch(e){if(expCore)return expCore();alert(e.message)}};
const expFull=window.exportFullBackup;window.exportFullBackup=async function(){if(cloudSession&&cloudWorkspaceId&&!confirm('Cloud file binaries live in Supabase Storage and are not embedded in the JSON full backup. Structured tracker data is protected by this export and cloud snapshots. Continue?'))return;return expFull()};
const imp=window.importBackupObject;window.importBackupObject=async function(o){const incoming=o?.db||o;if(!incoming?.aircraft||!Array.isArray(incoming?.projects))return alert('Backup validation failed: missing aircraft or projects data.');if(o?.manifest?.sha256&&crypto?.subtle&&await sha(J(incoming))!==o.manifest.sha256)return alert('Backup validation failed: checksum mismatch. The file may be incomplete or modified.');const a=audit(incoming);if((a.issues.length||a.warnings.length)&&!confirm('Backup has '+a.issues.length+' structural error(s) and '+a.warnings.length+' warning(s). Continue to the normal restore confirmation?'))return;recovery('Before backup import');return imp(o)};
const reset=window.resetData;window.resetData=function(){recovery('Before starter-data reset');return reset()};
async function remoteRows(){const types=typeof SYNC_RECORD_TYPES!=='undefined'?[...SYNC_RECORD_TYPES]:['aircraft','settings','project','part','order','log','document','checklist','maintenance','purchase'];const q=await supa.from('tracker_records').select('record_type,record_id,data,deleted_at,updated_at,updated_client,record_version').eq('workspace_id',cloudWorkspaceId).in('record_type',types);if(q.error)throw q.error;return q.data||[]}

let lastAutoMerges=[],conflictPayloads=new Map();
function parseSnapshot(v){if(v===null||v===undefined)return null;try{return JSON.parse(v)}catch(_e){return null}}
function plainObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function stableValue(v){if(v===undefined)return '__N594ZS_UNDEFINED__';try{return cloudStableJSON(v)}catch(_e){return J(v)}}
function pathKey(path){return path.join('\u001f')}
function pathLabel(path){
  if(!path.length)return 'Entire record';
  return path.map(x=>String(x).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/_/g,' ')).join(' → ');
}
function diffChanges(base,next,path=[]){
  if(stableValue(base)===stableValue(next))return [];
  if(plainObject(base)&&plainObject(next)){
    const out=[],keys=new Set([...Object.keys(base),...Object.keys(next)]);
    for(const key of keys){
      const bh=Object.prototype.hasOwnProperty.call(base,key),nh=Object.prototype.hasOwnProperty.call(next,key);
      if(!nh){out.push({path:[...path,key],exists:false,before:C(base[key]),after:undefined});continue}
      if(!bh){out.push({path:[...path,key],exists:true,before:undefined,after:C(next[key])});continue}
      out.push(...diffChanges(base[key],next[key],[...path,key]));
    }
    return out;
  }
  return [{path:[...path],exists:true,before:C(base),after:C(next)}];
}
function pathsOverlap(a,b){
  const n=Math.min(a.length,b.length);
  for(let i=0;i<n;i++)if(String(a[i])!==String(b[i]))return false;
  return true;
}
function exactSameChange(a,b){return pathKey(a.path)===pathKey(b.path)&&a.exists===b.exists&&stableValue(a.after)===stableValue(b.after)}
function applyChange(target,ch){
  if(!ch.path.length)return ch.exists?C(ch.after):null;
  let cur=target;
  for(let i=0;i<ch.path.length-1;i++){
    const key=ch.path[i];
    if(!plainObject(cur[key]))cur[key]={};
    cur=cur[key];
  }
  const leaf=ch.path[ch.path.length-1];
  if(ch.exists)cur[leaf]=C(ch.after);else delete cur[leaf];
  return target;
}
function applyChanges(base,changes){
  let out=C(base);
  for(const ch of changes)out=applyChange(out,ch);
  return out;
}
function recordArrayKey(type){
  if(typeof RECORD_ARRAYS!=='undefined'&&RECORD_ARRAYS[type])return RECORD_ARRAYS[type];
  const fallback={project:'projects',part:'parts',order:'orders',log:'logs',document:'docs',checklist:'checklists',maintenance:'maintenance',purchase:'purchases',invoice:'invoices',equipment:'equipment',system:'systems',spec:'specs',inspection:'inspections',squawk:'squawks',run:'runs'};
  return fallback[type]||null;
}
function applyRecordData(type,id,data){
  if(type==='aircraft'){db.aircraft=C(data);return true}
  if(type==='settings'){db.settings=C(data);return true}
  const key=recordArrayKey(type);if(!key)return false;
  db[key]=A(db[key]);
  const i=db[key].findIndex(x=>String(x?.id)===String(id));
  if(data===null){if(i>=0)db[key].splice(i,1);return true}
  if(i>=0)db[key][i]=C(data);else db[key].push(C(data));
  return true;
}
function recordLabel(type,id,data){
  const d=data||{};
  return d.name||d.title||d.description||d.item||d.work||d.label||((type==='aircraft')?'Aircraft':type+' • '+id);
}
function shortValue(v){
  if(v===undefined)return 'Removed';
  if(v===null)return 'None';
  if(typeof v==='string')return v.length>180?v.slice(0,177)+'…':v;
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(Array.isArray(v)){
    const s=J(v);return (s&&s.length<=180)?s:'Array ('+v.length+' item'+(v.length===1?'':'s')+')';
  }
  const s=J(v);return !s?'—':s.length>180?s.slice(0,177)+'…':s;
}
function changeSummary(ch){return {path:pathLabel(ch.path),pathKey:pathKey(ch.path),value:shortValue(ch.exists?ch.after:undefined)}}
function conflictAnalysis(base,local,remote){
  if(!plainObject(base)||!plainObject(local)||!plainObject(remote))return {mergeable:false,localChanges:[],remoteChanges:[],conflicts:[{path:[],local:{exists:local!==null,after:local},remote:{exists:remote!==null,after:remote}}],safeRemote:[]};
  const lc=diffChanges(base,local),rc=diffChanges(base,remote),conflicts=[],safeRemote=[];
  for(const rch of rc){
    const overlaps=lc.filter(lch=>pathsOverlap(lch.path,rch.path));
    const bad=overlaps.filter(lch=>!exactSameChange(lch,rch));
    if(bad.length){
      for(const lch of bad)conflicts.push({path:lch.path.length>=rch.path.length?lch.path:rch.path,local:lch,remote:rch});
    }else safeRemote.push(rch);
  }
  const dedup=[],seen=new Set();
  for(const x of conflicts){const key=pathKey(x.path);if(seen.has(key))continue;seen.add(key);dedup.push(x)}
  return {mergeable:dedup.length===0,localChanges:lc,remoteChanges:rc,conflicts:dedup,safeRemote};
}
async function persistMergedLocal(){
  normalizeDB();
  try{
    if(typeof persistBrowserData==='function')await persistBrowserData(db,{quiet:true});
    else localStorage.setItem(DB_KEY,J(db));
  }catch(e){console.warn('Could not persist automatically merged local state',e)}
}
async function detect(){
  lastAutoMerges=[];conflictPayloads=new Map();
  if(!supa||!cloudSession||!cloudWorkspaceId||typeof buildCloudRecordMap!=='function'||typeof cloudRecordSnapshot==='undefined')return[];
  const cur=buildCloudRecordMap();
  let changed=getDirtyKeys();
  if(!changed.size&&localStorage.getItem(CLOUD_PENDING_KEY)==='1'){changed=computeDirtyKeys();if(changed.size)setDirtyKeys(changed)}
  if(!changed.size)return[];
  const rm=new Map((await remoteRows()).map(r=>[K(r.record_type,r.record_id),r])),out=[];
  if(typeof cloudRecordVersions!=='undefined'){
    for(const k of changed){
      const row=rm.get(k);
      if(row)cloudRecordVersions.set(k,Number(row.record_version)||0);
    }
    if(typeof persistCloudRecordVersions==='function')persistCloudRecordVersions();
  }
  let localMutated=false;
  for(const k of changed){
    const baseJSON=cloudRecordSnapshot.has(k)?cloudRecordSnapshot.get(k):null;
    const localJSON=cur.has(k)?cloudStableJSON(cur.get(k).data):null;
    const row=rm.get(k),remoteJSON=row?.deleted_at?null:row?cloudStableJSON(row.data):null;
    if(remoteJSON===baseJSON||remoteJSON===localJSON||row?.updated_client===CLOUD_CLIENT_ID)continue;

    const type=row?.record_type||cur.get(k)?.record_type||k.split(':')[0],id=row?.record_id||cur.get(k)?.record_id||k.slice(k.indexOf(':')+1);
    const base=parseSnapshot(baseJSON),local=localJSON===null?null:C(cur.get(k)?.data),remote=remoteJSON===null?null:C(row?.data);
    const analysis=conflictAnalysis(base,local,remote);

    if(base!==null&&local!==null&&remote!==null&&analysis.mergeable){
      const merged=applyChanges(applyChanges(base,analysis.localChanges),analysis.remoteChanges);
      if(applyRecordData(type,id,merged)){
        localMutated=true;
        lastAutoMerges.push({key:k,type,id,label:recordLabel(type,id,merged),localFields:analysis.localChanges.map(changeSummary),cloudFields:analysis.remoteChanges.map(changeSummary)});
      }
      continue;
    }

    let workingLocal=local;
    if(base!==null&&local!==null&&remote!==null&&analysis.safeRemote.length){
      workingLocal=applyChanges(local,analysis.safeRemote);
      if(applyRecordData(type,id,workingLocal))localMutated=true;
    }
    const details={
      key:k,type,id,label:recordLabel(type,id,workingLocal||remote),at:row?.updated_at||'',
      base,local:workingLocal,remote,
      analysis
    };
    conflictPayloads.set(k,details);
    out.push({
      key:k,type,id,label:details.label,at:details.at,
      localFields:analysis.localChanges.map(changeSummary),
      cloudFields:analysis.remoteChanges.map(changeSummary),
      safeCloudFields:analysis.safeRemote.map(changeSummary),
      fields:analysis.conflicts.map(x=>({
        path:pathLabel(x.path),pathKey:pathKey(x.path),
        local:shortValue(x.local.exists?x.local.after:undefined),
        cloud:shortValue(x.remote.exists?x.remote.after:undefined)
      }))
    });
  }
  if(localMutated)await persistMergedLocal();
  return out;
}
function setConf(x){conflicts=x||[];try{localStorage.setItem(CF,J(conflicts))}catch(_e){}}
function getDirtyKeys(){try{return new Set(JSON.parse(localStorage.getItem(DIRTY)||'[]'))}catch(_e){return new Set()}}
function setDirtyKeys(keys){try{localStorage.setItem(DIRTY,J([...keys]))}catch(_e){}}
function clearDirtyKeys(){try{localStorage.removeItem(DIRTY)}catch(_e){}}
function computeDirtyKeys(){
  if(typeof buildCloudRecordMap!=='function'||typeof cloudRecordSnapshot==='undefined')return new Set();
  const cur=buildCloudRecordMap(),dirty=new Set();
  for(const [k,r] of cur)if(cloudRecordSnapshot.get(k)!==cloudStableJSON(r.data))dirty.add(k);
  for(const k of cloudRecordSnapshot.keys())if(!cur.has(k))dirty.add(k);
  return dirty;
}
function migrateLegacyPendingConflict(){
  try{
    if(localStorage.getItem(LEGACY_FIX)==='1')return;
    const pending=localStorage.getItem(CLOUD_PENDING_KEY)==='1';
    const dirty=getDirtyKeys();
    if(pending&&dirty.size===0){
      recovery('v5.5.4 safety copy before clearing legacy stuck sync/conflict marker');
      localStorage.removeItem(CLOUD_PENDING_KEY);
      setConf([]);
    }
    localStorage.setItem(LEGACY_FIX,'1');
  }catch(e){console.warn('Legacy conflict migration warning',e)}
}
migrateLegacyPendingConflict();

const queueBase=window.queueCloudSave;
window.queueCloudSave=function(){
  try{
    const dirty=computeDirtyKeys();
    if(dirty.size)setDirtyKeys(dirty);else clearDirtyKeys();
  }catch(e){console.warn('Could not persist dirty record keys',e)}
  return queueBase();
};
let bypass=false;
const saveBase=window.saveCloudState;
window.saveCloudState=async function(){
  if(bypass){
    bypass=false;setConf([]);
    const result=await saveBase();
    if(localStorage.getItem(CLOUD_PENDING_KEY)!=='1')clearDirtyKeys();
    return result;
  }
  try{
    const c=await detect(),merged=[...lastAutoMerges];
    if(c.length){
      setConf(c);localStorage.setItem(CLOUD_PENDING_KEY,'1');cloudStatusLabel('Conflict');
      toast('Cloud conflict needs review; non-overlapping fields were preserved.','bad');
      if(currentPage==='system')renderSystem();
      return;
    }
    setConf([]);
    let result=await saveBase();
    if(result?.versionConflicts?.length){
      // The server caught a write that became stale after our pre-save comparison.
      // Re-read the current rows. If only metadata/version changed, retry once using
      // the refreshed server version. If data changed, surface the normal field-aware resolver.
      const after=await detect();
      if(after.length){
        setConf(after);localStorage.setItem(CLOUD_PENDING_KEY,'1');cloudStatusLabel('Conflict');
        toast('The server blocked a stale write; review the changed field'+(after.length===1?'':'s')+'.','bad');
        if(currentPage==='system')renderSystem();
        return result;
      }
      result=await saveBase();
      if(result?.versionConflicts?.length){
        const finalConflicts=await detect();
        if(finalConflicts.length)setConf(finalConflicts);
        localStorage.setItem(CLOUD_PENDING_KEY,'1');cloudStatusLabel('Conflict');
        toast('The server is still protecting a newer cloud version. Review the conflict before saving.','bad');
        return result;
      }
    }
    if(localStorage.getItem(CLOUD_PENDING_KEY)!=='1'){
      clearDirtyKeys();
      if(merged.length)toast('Auto-merged '+merged.length+' non-overlapping cloud change'+(merged.length===1?'':'s')+'.','good');
    }
    return result;
  }catch(e){
    localStorage.setItem(CLOUD_PENDING_KEY,'1');cloudStatusLabel('Sync pending');
    toast('Cloud verification was interrupted; local changes are still safe and pending.','bad')
  }
};
const loadBase=window.loadCloudState;
window.loadCloudState=async function(silent=false){
  if(supa&&cloudSession&&cloudWorkspaceId&&localStorage.getItem(CLOUD_PENDING_KEY)==='1'){
    if(typeof cloudRecordSnapshot==='undefined'||!cloudRecordSnapshot.size)throw new Error('Unsynced local changes exist and cannot be compared safely. Use System → Reload Shared Data only if you intend to replace them.');
    const c=await detect();
    if(c.length){
      setConf(c);cloudStatusLabel('Conflict');if(currentPage==='system')renderSystem();
      const e=new Error('Cloud conflict needs review; non-overlapping fields were preserved.');e.code='N594ZS_CONFLICT';throw e;
    }
  }
  const result=await loadBase(silent);
  if(localStorage.getItem(CLOUD_PENDING_KEY)!=='1'){setConf([]);clearDirtyKeys()}
  return result
};

function conflictFieldHTML(c,index){
  const fields=A(c.fields);
  if(!fields.length)return '<div class="notice" style="margin-top:8px">This conflict involves a record-level create/delete or structure change and cannot be safely field-merged automatically.</div>';
  return '<div class="conflict-field-list">'+fields.map((f,i)=>
    '<div class="conflict-field-row"><div class="conflict-field-name">'+esc(f.path)+'</div>'+
    '<label><input type="radio" name="cf_'+index+'_'+i+'" data-conflict-key="'+esc(c.key)+'" data-conflict-path="'+esc(f.pathKey)+'" value="local" checked><span><b>Local</b><small>'+esc(f.local)+'</small></span></label>'+
    '<label><input type="radio" name="cf_'+index+'_'+i+'" data-conflict-key="'+esc(c.key)+'" data-conflict-path="'+esc(f.pathKey)+'" value="cloud"><span><b>Cloud</b><small>'+esc(f.cloud)+'</small></span></label></div>'
  ).join('')+'</div>';
}
function fieldsText(rows){return A(rows).map(x=>x.path).slice(0,8).join(', ')+(A(rows).length>8?'…':'')}

window.openCloudConflictResolver=async function(){
  if(supa&&cloudSession&&cloudWorkspaceId&&localStorage.getItem(CLOUD_PENDING_KEY)==='1'){
    try{const fresh=await detect();if(fresh.length)setConf(fresh)}catch(e){console.warn('Conflict details refresh failed',e)}
  }
  if(!conflicts.length)return alert('No unresolved cloud conflict.');
  openModal(modalHeader('Cloud Conflict Protection',conflicts.length+' record'+(conflicts.length===1?'':'s')+' needs a decision')+
    '<div class="notice"><b>Non-overlapping edits are merged automatically now.</b><br>Only fields changed differently on both sides are shown below. Choose Local or Cloud for each overlapping field. Nothing is overwritten until you apply the merge.</div>'+
    '<div class="conflict-record-list">'+conflicts.map((c,i)=>
      '<div class="detail-card conflict-record-card"><div class="section-tools"><div><h3>'+esc(c.label||c.type+' • '+c.id)+'</h3><div class="tiny muted">'+esc(c.type)+' • '+esc(c.id)+(c.at?' • cloud '+esc(new Date(c.at).toLocaleString()):'')+'</div></div><span class="mini-badge">'+A(c.fields).length+' field'+(A(c.fields).length===1?'':'s')+'</span></div>'+
      (A(c.safeCloudFields).length?'<div class="tiny muted" style="margin:8px 0">Already preserved from cloud: '+esc(fieldsText(c.safeCloudFields))+'</div>':'')+
      '<div class="conflict-sides"><div><span>Local changed</span><b>'+esc(fieldsText(c.localFields)||'record')+'</b></div><div><span>Cloud changed</span><b>'+esc(fieldsText(c.cloudFields)||'record')+'</b></div></div>'+
      conflictFieldHTML(c,i)+'</div>'
    ).join('')+'</div>'+
    '<div class="modal-actions" style="flex-wrap:wrap"><button class="secondary" onclick="closeModal()">Cancel</button><button class="secondary" onclick="reliabilityUseCloud()">Use Entire Cloud Copy</button><button class="secondary" onclick="reliabilityKeepLocal()">Use Entire Local Copy</button><button class="primary" onclick="reliabilityApplyFieldMerge()">Apply Field Merge</button></div>',true);
};

window.reliabilityApplyFieldMerge=async function(){
  if(!conflicts.length)return;
  const unresolved=conflicts.filter(c=>!A(c.fields).length);
  if(unresolved.length)return alert('At least one conflict is a whole-record create/delete conflict. Resolve that one with Entire Cloud or Entire Local.');
  if(!confirm('Apply the selected field choices? A local recovery point and verified cloud safety snapshot will be created first.'))return;
  recovery('Before field-level conflict merge');
  const s=await supa.rpc('create_workspace_snapshot',{target_workspace:cloudWorkspaceId,snapshot_label:'Pre-field-merge safety '+new Date().toLocaleString()});
  if(s.error)return alert('Safety snapshot failed; merge cancelled: '+s.error.message);

  for(const c of conflicts){
    const detail=conflictPayloads.get(c.key);if(!detail)continue;
    let current=C(detail.local);
    for(const f of A(c.fields)){
      const chosen=document.querySelector('input[data-conflict-key="'+CSS.escape(c.key)+'"][data-conflict-path="'+CSS.escape(f.pathKey)+'"]:checked')?.value||'local';
      if(chosen!=='cloud')continue;
      const target=detail.analysis.conflicts.find(x=>pathKey(x.path)===f.pathKey);
      if(target)current=applyChange(current,target.remote);
    }
    applyRecordData(c.type,c.id,current);
  }
  await persistMergedLocal();
  setConf([]);bypass=true;closeModal();
  await window.saveCloudState();
  if(localStorage.getItem(CLOUD_PENDING_KEY)!=='1'){
    clearDirtyKeys();await loadCloudState(true);
    toast('Field-level conflict merge saved.','good');
  }
};

window.reliabilityUseCloud=async function(){if(!confirm('Use the cloud version and discard pending local core changes? A local recovery point will be saved first.'))return;recovery('Before conflict resolution: use cloud');localStorage.removeItem(CLOUD_PENDING_KEY);clearDirtyKeys();setConf([]);closeModal();await loadCloudState(true);toast('Cloud version loaded; prior local state is recoverable.','good')};
window.reliabilityKeepLocal=async function(){if(!confirm('Keep local data and overwrite conflicting cloud records? A cloud snapshot will be created first.'))return;recovery('Before conflict resolution: keep local');const s=await supa.rpc('create_workspace_snapshot',{target_workspace:cloudWorkspaceId,snapshot_label:'Pre-conflict safety '+new Date().toLocaleString()});if(s.error)return alert('Safety snapshot failed; overwrite cancelled: '+s.error.message);bypass=true;closeModal();await window.saveCloudState();if(localStorage.getItem(CLOUD_PENDING_KEY)!=='1')clearDirtyKeys();await loadCloudState(true);toast('Local version saved after cloud safety snapshot.','good')};
const reload=window.forceCloudReload;window.forceCloudReload=async function(){if(localStorage.getItem(CLOUD_PENDING_KEY)==='1'){if(!confirm('Unsynced local changes exist. Save a local recovery point and reload the cloud version?'))return;recovery('Before force cloud reload');localStorage.removeItem(CLOUD_PENDING_KEY);clearDirtyKeys();setConf([])}return reload()};

if(!document.getElementById('smartConflictStyle')){
  const s=document.createElement('style');s.id='smartConflictStyle';s.textContent=
    '.conflict-record-list{display:grid;gap:10px;margin-top:12px}.conflict-record-card{margin:0}.conflict-sides{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.conflict-sides>div{border:1px solid #e2e9ee;border-radius:8px;background:#f8fbfd;padding:8px}.conflict-sides span{display:block;font-size:9px;text-transform:uppercase;font-weight:850;color:var(--muted)}.conflict-sides b{display:block;margin-top:3px;font-size:11px;line-height:1.35}.conflict-field-list{display:grid;gap:8px;margin-top:10px}.conflict-field-row{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(0,1fr) minmax(0,1fr);gap:7px;align-items:stretch}.conflict-field-name{font-size:11px;font-weight:850;padding:9px 4px}.conflict-field-row label{display:grid;grid-template-columns:18px minmax(0,1fr);gap:7px;border:1px solid #dce6ed;border-radius:8px;padding:8px;background:#fff;text-transform:none;letter-spacing:0;cursor:pointer}.conflict-field-row label:has(input:checked){border-color:#6e9fc5;background:#f2f8fc}.conflict-field-row input{width:auto;margin-top:3px}.conflict-field-row b{display:block;font-size:10px}.conflict-field-row small{display:block;margin-top:2px;color:var(--muted);font-size:10px;line-height:1.3;word-break:break-word}@media(max-width:700px){.conflict-sides{grid-template-columns:1fr}.conflict-field-row{grid-template-columns:1fr}.conflict-field-name{padding-bottom:0}}';
  document.head.appendChild(s);
}
window.createVerifiedCloudSnapshot=async function(label=null){if(!supa||!cloudWorkspaceId)return alert('Sign in first.');const name=label||prompt('Snapshot label:','Verified snapshot '+new Date().toLocaleString());if(name===null)return null;const s=await supa.rpc('create_workspace_snapshot',{target_workspace:cloudWorkspaceId,snapshot_label:name});if(s.error)throw s.error;const q=await supa.from('tracker_snapshots').select('id,label,records,created_at').eq('workspace_id',cloudWorkspaceId).eq('label',name).order('created_at',{ascending:false}).limit(1).maybeSingle();if(q.error)throw q.error;if(!Array.isArray(q.data?.records)||!q.data.records.length)throw new Error('Snapshot payload could not be verified.');toast('Cloud snapshot verified: '+q.data.records.length+' records.','good');return q.data};
window.createCloudSnapshot=async function(){try{await createVerifiedCloudSnapshot();renderSystem()}catch(e){alert('Snapshot failed verification: '+e.message)}};
window.testLatestCloudSnapshot=async function(){if(!supa||!cloudWorkspaceId)return alert('Sign in first.');const q=await supa.from('tracker_snapshots').select('label,records,created_at').eq('workspace_id',cloudWorkspaceId).order('created_at',{ascending:false}).limit(1).maybeSingle();if(q.error)return alert(q.error.message);if(!q.data)return alert('No snapshot exists.');const rows=A(q.data.records),active=rows.filter(r=>!r.deleted_at),air=active.some(r=>r.record_type==='aircraft'),settings=active.some(r=>r.record_type==='settings');openModal(modalHeader('Snapshot Restore Drill',q.data.label||'Latest snapshot')+'<div class="summary-strip"><div class="summary-cell"><div class="lab">Stored</div><div class="val">'+rows.length+'</div></div><div class="summary-cell"><div class="lab">Active</div><div class="val">'+active.length+'</div></div><div class="summary-cell"><div class="lab">Aircraft</div><div class="val">'+(air?'YES':'NO')+'</div></div><div class="summary-cell"><div class="lab">Settings</div><div class="val">'+(settings?'YES':'NO')+'</div></div></div><div class="notice"><b>'+(air&&settings&&active.length?'Snapshot payload is readable and has required singleton records.':'Snapshot needs review before relying on it.')+'</b></div><div class="tiny muted" style="margin-top:10px">Non-destructive dry run: current tracker data and files were not changed.</div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Close</button></div>',true)};
window.restoreCloudSnapshot=async function(id,label){const q=await supa.from('tracker_snapshots').select('records').eq('workspace_id',cloudWorkspaceId).eq('id',id).maybeSingle();if(q.error)return alert(q.error.message);if(!A(q.data?.records).length)return alert('Snapshot could not be validated; restore cancelled.');if(!confirm('Restore “'+label+'”? A fresh safety snapshot of the current cloud state will be created first.'))return;try{await createVerifiedCloudSnapshot('Pre-restore safety '+new Date().toLocaleString());recovery('Before cloud snapshot restore');const r=await supa.rpc('restore_workspace_snapshot',{snapshot_id:id});if(r.error)throw r.error;setConf([]);clearDirtyKeys();localStorage.removeItem(CLOUD_PENDING_KEY);toast('Snapshot restored ('+r.data+' records).','good');await loadCloudState(true);renderSystem()}catch(e){alert('Restore cancelled/failed safely: '+e.message)}};
const accountBase=window.openCloudAccount;
window.openCloudAccount=function(){
  accountBase();
  queueMicrotask(()=>{
    const modal=document.getElementById('modalBox');if(!modal||!conflicts.length)return;
    const actions=modal.querySelector('.modal-actions');
    const card=document.createElement('div');card.className='danger-note';card.style.marginTop='12px';
    card.innerHTML='<b>Cloud conflict protected.</b><br>'+conflicts.length+' record'+(conflicts.length===1?'':'s')+' changed both locally and in the cloud. Nothing was overwritten.<div class="action-row" style="margin-top:10px"><button class="primary" onclick="openCloudConflictResolver()">Resolve Conflict</button></div>';
    if(actions)modal.insertBefore(card,actions);else modal.appendChild(card);
  });
};

const sys=window.renderSystem;window.renderSystem=async function(){await sys();const page=document.getElementById('page-system');if(!page||!cloudSession||!cloudWorkspaceId)return;const a=audit(),rec=getRecovery(),hasRecovery=!!rec?.db||(typeof window.hasIndexedRecoveryPoint==='function'&&window.hasIndexedRecoveryPoint()),pending=localStorage.getItem(CLOUD_PENDING_KEY)==='1',grid=page.querySelector('.grid');if(!grid)return;grid.insertAdjacentHTML('beforeend','<div class="card span-12"><div class="toolbar"><div><h2>Reliability & Recovery</h2><div class="muted">Integrity checks, restore drills and sync-conflict protection.</div></div><span class="mini-badge">v'+VER+'</span></div><div class="smart-status-strip"><div class="smart-status-card"><span>Integrity</span><b>'+(a.issues.length?'Review':a.warnings.length?'Warnings':'Clean')+'</b></div><div class="smart-status-card"><span>Errors / warnings</span><b>'+a.issues.length+' / '+a.warnings.length+'</b></div><div class="smart-status-card"><span>Cloud pending</span><b>'+(pending?'YES':'NO')+'</b></div><div class="smart-status-card"><span>Conflicts protected</span><b>'+conflicts.length+'</b></div></div><div class="action-row"><button class="primary" onclick="runReliabilityAudit(true)">Run Integrity Check</button><button class="secondary" onclick="testLatestCloudSnapshot()">Test Latest Snapshot</button><button class="secondary" onclick="createCloudSnapshot()">Verified Snapshot</button>'+(hasRecovery?'<button class="secondary" onclick="restoreLastLocalRecovery()">Restore Local Recovery</button>':'')+(conflicts.length?'<button class="danger" onclick="openCloudConflictResolver()">Resolve Conflict</button>':'')+'</div><div class="tiny muted" style="margin-top:10px">If the same record changes on this device and another device before sync, automatic overwrite is stopped until you choose which version wins.</div></div>')};
})();