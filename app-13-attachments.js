// ---------- GENERIC ATTACHMENTS ----------
const ATTACH_DB='N594ZS_Attachments';
const ATTACH_STORE='files';
const CLOUD_BUCKET='n594zs-files';
function openAttachDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(ATTACH_DB,2);req.onupgradeneeded=e=>{const d=req.result;let st;if(!d.objectStoreNames.contains(ATTACH_STORE)){st=d.createObjectStore(ATTACH_STORE,{keyPath:'id'});st.createIndex('taskId','taskId',{unique:false});st.createIndex('entityKey','entityKey',{unique:false})}else{st=req.transaction.objectStore(ATTACH_STORE);if(!st.indexNames.contains('entityKey'))st.createIndex('entityKey','entityKey',{unique:false});if(!st.indexNames.contains('taskId'))st.createIndex('taskId','taskId',{unique:false});const cur=st.openCursor();cur.onsuccess=()=>{const c=cur.result;if(!c)return;const r=c.value;if(!r.entityKey&&r.taskId){r.entityType='project';r.entityId=r.taskId;r.entityKey='project:'+r.taskId;c.update(r)}c.continue()}}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function entityKey(type,id){return `${type}:${id}`}
function cloudAttachPrefix(type,id){return `${WORKSPACE_SLUG}/${type}/${id}`}
function safeCloudName(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)}
async function addLocalAttachments(type,id,files){const d=await openAttachDB();const tx=d.transaction(ATTACH_STORE,'readwrite'),st=tx.objectStore(ATTACH_STORE);for(const f of files){st.put({id:uid(),entityType:type,entityId:id,entityKey:entityKey(type,id),taskId:type==='project'?id:undefined,name:f.name,type:f.type||'application/octet-stream',size:f.size,addedAt:new Date().toISOString(),blob:f})}return new Promise((resolve,reject)=>{tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}})}
async function getLocalAttachments(type,id){const d=await openAttachDB();const tx=d.transaction(ATTACH_STORE,'readonly'),st=tx.objectStore(ATTACH_STORE),idx=st.index('entityKey'),req=idx.getAll(entityKey(type,id));return new Promise((resolve,reject)=>{req.onsuccess=()=>{d.close();resolve(req.result||[])};req.onerror=()=>{d.close();reject(req.error)}})}
async function getAllAttachments(){const d=await openAttachDB();const tx=d.transaction(ATTACH_STORE,'readonly'),req=tx.objectStore(ATTACH_STORE).getAll();return new Promise((resolve,reject)=>{req.onsuccess=()=>{d.close();resolve(req.result||[])};req.onerror=()=>{d.close();reject(req.error)}})}
async function getLocalAttachment(id){const d=await openAttachDB();const tx=d.transaction(ATTACH_STORE,'readonly'),req=tx.objectStore(ATTACH_STORE).get(id);return new Promise((resolve,reject)=>{req.onsuccess=()=>{d.close();resolve(req.result)};req.onerror=()=>{d.close();reject(req.error)}})}
async function removeLocalAttachment(id){const d=await openAttachDB();const tx=d.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).delete(id);return new Promise((resolve,reject)=>{tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}})}
async function clearAttachments(){const d=await openAttachDB();const tx=d.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).clear();return new Promise((resolve,reject)=>{tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{d.close();reject(tx.error)}})}

async function addAttachments(type,id,files){
  if(supa&&cloudSession&&cloudWorkspaceId){
    for(const f of files){
      const path=`${cloudAttachPrefix(type,id)}/${crypto.randomUUID()}__${safeCloudName(f.name)}`;
      const {error}=await supa.storage.from(CLOUD_BUCKET).upload(path,f,{contentType:f.type||'application/octet-stream',upsert:false});
      if(error)throw error;
    }
    return;
  }
  return addLocalAttachments(type,id,files);
}
async function getAttachments(type,id){
  if(supa&&cloudSession&&cloudWorkspaceId){
    const prefix=cloudAttachPrefix(type,id);
    const {data,error}=await supa.storage.from(CLOUD_BUCKET).list(prefix,{limit:100,sortBy:{column:'created_at',order:'desc'}});
    if(error)throw error;
    return (data||[]).filter(x=>x.name!=='.emptyFolderPlaceholder').map(x=>({id:`${prefix}/${x.name}`,name:(x.name.split('__').slice(1).join('__')||x.name),type:x.metadata?.mimetype||'application/octet-stream',size:x.metadata?.size||0,addedAt:x.created_at||x.updated_at||'' ,cloud:true}));
  }
  return getLocalAttachments(type,id);
}
async function getAttachment(id){
  if(typeof id==='string'&&id.includes('/')){
    const {data,error}=await supa.storage.from(CLOUD_BUCKET).download(id);if(error)throw error;
    return {id,name:id.split('/').pop().split('__').slice(1).join('__')||'attachment',type:data.type||'application/octet-stream',size:data.size,blob:data,cloud:true};
  }
  return getLocalAttachment(id);
}
async function removeAttachment(id){
  if(typeof id==='string'&&id.includes('/')){const {error}=await supa.storage.from(CLOUD_BUCKET).remove([id]);if(error)throw error;return;}
  return removeLocalAttachment(id);
}
function chooseAttachments(type,id){const input=document.getElementById('entityFile');input.dataset.entityType=type;input.dataset.entityId=id;input.click()}
async function handleEntityDrop(event,type,id){event.preventDefault();event.stopPropagation();const files=[...(event.dataTransfer?.files||[])];await saveSelectedFiles(type,id,files)}
async function saveSelectedFiles(type,id,files){if(!files.length)return;const tooLarge=files.find(f=>f.size>30*1024*1024);if(tooLarge)return alert(`Please keep each file under 30 MB. ${tooLarge.name} is too large.`);try{await addAttachments(type,id,files);toast(`${files.length} file${files.length===1?'':'s'} attached${cloudSession?' to shared storage':''}.`,'good');reopenDetail(type,id)}catch(e){alert('Could not save attachment: '+e.message)}}
async function renderAttachments(type,id){const box=document.getElementById(`attachments-${type}-${id}`);if(!box)return;try{const files=(await getAttachments(type,id)).sort((a,b)=>(b.addedAt||'').localeCompare(a.addedAt||''));if(!files.length){box.innerHTML='<div class="empty">No files attached yet.</div>';return}box.innerHTML=`<div class="attach-grid">${files.map(f=>{const arg=JSON.stringify(f.id);return `<div class="attach-card"><div class="attach-thumb" id="thumb-${String(f.id).replace(/[^a-zA-Z0-9_-]/g,'_')}">📎</div><div class="attach-name" title="${esc(f.name)}">${esc(f.name)}</div><div class="attach-meta">${formatBytes(f.size)} • ${esc((f.addedAt||'').slice(0,10))}${f.cloud?' • shared':''}</div><div class="action-row"><button class="icon-btn" onclick='openAttachment(${arg})'>Open</button><button class="icon-btn" onclick='downloadAttachment(${arg})'>Save</button><button class="icon-btn" onclick='deleteAttachment(${JSON.stringify(type)},${JSON.stringify(id)},${arg})'>✕</button></div></div>`}).join('')}</div>`;for(const f of files.filter(f=>f.type?.startsWith('image/'))){try{const file=await getAttachment(f.id);const u=URL.createObjectURL(file.blob);objectUrls.push(u);const el=document.getElementById('thumb-'+String(f.id).replace(/[^a-zA-Z0-9_-]/g,'_'));if(el)el.innerHTML=`<img src="${u}" alt="${esc(f.name)}">`}catch(_e){}}}catch(e){box.innerHTML=`<div class="danger-note">Could not load attachments: ${esc(e.message)}</div>`}}
async function openAttachment(id){const f=await getAttachment(id);if(!f)return;const u=URL.createObjectURL(f.blob);objectUrls.push(u);window.open(u,'_blank')}
async function downloadAttachment(id){const f=await getAttachment(id);if(!f)return;const u=URL.createObjectURL(f.blob),a=document.createElement('a');a.href=u;a.download=f.name||'attachment';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200)}
async function deleteAttachment(type,entityId,id){if(!confirm('Delete this attached file?'))return;await removeAttachment(id);toast('Attachment deleted.');renderAttachments(type,entityId);renderStorageStats()}
async function clearAllAttachments(){
  if(supa&&cloudSession){alert('Shared cloud attachments must be deleted from their individual records so accidental bulk deletion is avoided.');return;}
  if(!confirm('Delete ALL locally stored screenshots, photos and files from this tracker? This cannot be undone unless you have a full backup.'))return;await clearAttachments();toast('All attachments deleted.');renderStorageStats()
}
