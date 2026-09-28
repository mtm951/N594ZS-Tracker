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

let manualPdfViewerState=null,manualPdfRenderTask=null;
function shouldUseInAppPdfViewer(){
  const ua=String(navigator?.userAgent||'');
  if(/Android|iPhone|iPad|iPod/i.test(ua))return true;
  try{return !!window.matchMedia?.('(max-width: 900px), (pointer: coarse)').matches}catch(_e){return false}
}
window.shouldUseInAppPdfViewer=shouldUseInAppPdfViewer;

async function renderManualPdfPage(pageNumber){
  const state=manualPdfViewerState;if(!state?.pdf)return false;
  const requested=Math.round(Number(pageNumber)||state.page||1);
  const pageNo=Math.max(1,Math.min(state.pdf.numPages,requested));
  state.page=pageNo;
  const canvas=document.getElementById('manualPdfCanvas');
  const wrap=document.getElementById('manualPdfViewport');
  const status=document.getElementById('manualPdfStatus');
  if(!canvas||!wrap)return false;
  if(status)status.textContent='Rendering page '+pageNo+'…';
  try{manualPdfRenderTask?.cancel?.()}catch(_e){}
  const page=await state.pdf.getPage(pageNo);
  const base=page.getViewport({scale:1});
  const available=Math.max(280,Math.min((wrap.clientWidth||window.innerWidth||420)-12,1200));
  const cssScale=Math.max(.25,available/base.width);
  const dpr=Math.min(Number(window.devicePixelRatio)||1,2);
  const viewport=page.getViewport({scale:cssScale*dpr});
  canvas.width=Math.ceil(viewport.width);
  canvas.height=Math.ceil(viewport.height);
  canvas.style.width=Math.ceil(viewport.width/dpr)+'px';
  canvas.style.height=Math.ceil(viewport.height/dpr)+'px';
  const ctx=canvas.getContext('2d',{alpha:false});
  manualPdfRenderTask=page.render({canvasContext:ctx,viewport});
  await manualPdfRenderTask.promise;
  manualPdfRenderTask=null;
  const input=document.getElementById('manualPdfPageInput');
  const count=document.getElementById('manualPdfPageCount');
  const prev=document.getElementById('manualPdfPrev');
  const next=document.getElementById('manualPdfNext');
  if(input)input.value=String(pageNo);
  if(count)count.textContent='of '+state.pdf.numPages;
  if(prev)prev.disabled=pageNo<=1;
  if(next)next.disabled=pageNo>=state.pdf.numPages;
  if(status)status.textContent='Page '+pageNo+' of '+state.pdf.numPages;
  wrap.scrollTop=0;wrap.scrollLeft=0;
  return true;
}
window.renderManualPdfPage=renderManualPdfPage;
window.manualPdfPrev=()=>renderManualPdfPage((manualPdfViewerState?.page||1)-1);
window.manualPdfNext=()=>renderManualPdfPage((manualPdfViewerState?.page||1)+1);
window.manualPdfSetPage=value=>renderManualPdfPage(value);

async function openMobilePdfViewer(blob,pageNo=1,label='Source manual'){
  if(typeof pdfjsLib==='undefined')return false;
  try{
    try{await manualPdfViewerState?.pdf?.destroy?.()}catch(_e){}
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    manualPdfViewerState={pdf,page:Math.max(1,Math.min(pdf.numPages,Math.round(Number(pageNo)||1))),label};
    openModal(modalHeader(label,'Mobile source viewer')+
      '<div class="action-row" style="position:sticky;top:0;z-index:15;background:var(--panel,#fff);padding:8px 0 10px;align-items:center">'+
        '<button class="secondary" id="manualPdfPrev" onclick="manualPdfPrev()">← Previous</button>'+
        '<label style="display:flex;align-items:center;gap:6px;margin:0">Page <input id="manualPdfPageInput" type="number" min="1" max="'+pdf.numPages+'" value="'+manualPdfViewerState.page+'" onchange="manualPdfSetPage(this.value)" style="width:72px"></label>'+
        '<span id="manualPdfPageCount" class="muted">of '+pdf.numPages+'</span>'+
        '<button class="secondary" id="manualPdfNext" onclick="manualPdfNext()">Next →</button>'+
      '</div>'+
      '<div id="manualPdfStatus" class="muted small" style="margin:4px 0 8px">Loading requested page…</div>'+
      '<div id="manualPdfViewport" style="width:100%;max-height:calc(100dvh - 190px);overflow:auto;-webkit-overflow-scrolling:touch;background:#666;border-radius:8px;padding:6px;text-align:center">'+
        '<canvas id="manualPdfCanvas" style="display:block;margin:0 auto;background:#fff;max-width:none"></canvas>'+
      '</div>'+
      '<div class="tiny muted" style="margin-top:8px">This viewer renders the manual inside the tracker so mobile browsers cannot ignore the requested page.</div>',true);
    await renderManualPdfPage(manualPdfViewerState.page);
    return true;
  }catch(error){
    console.warn('Could not render mobile PDF viewer',error);
    try{await manualPdfViewerState?.pdf?.destroy?.()}catch(_e){}
    manualPdfViewerState=null;
    return false;
  }
}
window.openMobilePdfViewer=openMobilePdfViewer;

async function openAttachmentPage(id,page=null,label='Kitfox 912 Install Manual'){
  const requested=Number(page),pageNo=Number.isFinite(requested)&&requested>0?Math.floor(requested):null;
  const inApp=shouldUseInAppPdfViewer()&&typeof pdfjsLib!=='undefined';
  // Desktop keeps the native viewer. Mobile/tablet renders with PDF.js inside
  // the tracker so page selection is not delegated to the OS PDF viewer.
  const tab=inApp?null:window.open('about:blank','_blank');
  if(tab)try{tab.opener=null}catch(_e){}
  let url='';
  try{
    let blob=null;
    if(typeof id==='string'&&id.includes('/')&&supa&&cloudSession){
      // Native PDF viewers do not consistently honor #page on signed,
      // cross-origin Storage URLs. Download the already-private file through
      // the authenticated client and give the viewer a same-browser blob URL.
      const {data,error}=await supa.storage.from(CLOUD_BUCKET).download(id);
      if(error)throw error;
      blob=data;
    }else{
      const f=await getAttachment(id);if(!f)throw new Error('Attachment was not found.');
      blob=f.blob;
    }
    if(!blob)throw new Error('Attachment data was empty.');
    if(inApp){
      const rendered=await window.openMobilePdfViewer(blob,pageNo||1,label||'Source manual');
      if(rendered)return true;
      // If PDF.js cannot render for any reason, fall through to the native
      // blob viewer rather than leaving the user with a dead source button.
    }
    url=URL.createObjectURL(blob);
    objectUrls.push(url);
    const target=url+(pageNo?'#page='+pageNo+'&zoom=page-width':'');
    if(tab)tab.location.replace?tab.location.replace(target):tab.location.href=target;
    else window.open(target,'_blank');
    setTimeout(()=>URL.revokeObjectURL(url),5*60*1000);
    return true;
  }catch(error){
    try{tab?.close()}catch(_e){}
    if(url)try{URL.revokeObjectURL(url)}catch(_e){}
    console.warn('Could not open attachment page',error);
    alert('Could not open the source file: '+(error?.message||String(error)));
    return false;
  }
}
window.openAttachmentPage=openAttachmentPage;

function sourceDocumentUrl(doc){
  const urls=[doc?.sourceUrl,doc?.location].map(v=>String(v||'').trim()).filter(Boolean);
  return urls.find(v=>/^https?:\/\//i.test(v))||'';
}
function sourcePdfPageFromCitation(doc,citation){
  const map=doc?.pdfPageMap||doc?.sourcePdfPageMap||null;
  if(!map||typeof map!=='object')return null;
  const text=String(citation||'').replace(/[–—]/g,'-');
  const match=text.match(/(\d{2}-\d{2}-\d{2}).*?(?:p(?:age)?\.?\s*)(\d+)/i);
  if(!match)return null;
  const chapter=match[1],chapterFirstPdfPage=Number(map[chapter]),chapterPage=Number(match[2]);
  if(!Number.isFinite(chapterFirstPdfPage)||chapterFirstPdfPage<1||!Number.isFinite(chapterPage)||chapterPage<1)return null;
  return Math.floor(chapterFirstPdfPage+chapterPage-1);
}
async function sourcePdfAttachment(doc){
  if(!doc||typeof getAttachments!=='function')return null;
  try{
    const files=await getAttachments('document',doc.id);
    return (files||[]).find(f=>String(f.type||'').toLowerCase()==='application/pdf')||
      (files||[]).find(f=>String(f.name||'').toLowerCase().endsWith('.pdf'))||null;
  }catch(error){
    console.warn('Could not resolve source PDF attachment',error);
    return null;
  }
}
async function openSourceReference(doc,citation='',options={}){
  if(!doc)return false;
  const page=sourcePdfPageFromCitation(doc,citation);
  const pdf=await sourcePdfAttachment(doc);
  if(pdf){
    try{
      if(page&&typeof openAttachmentPage==='function'){
        const ok=await openAttachmentPage(pdf.id,page,doc.name||'Source manual');
        if(ok)return true;
      }
      if(typeof openAttachment==='function'){
        await openAttachment(pdf.id);
        return true;
      }
    }catch(error){
      console.warn('Could not open attached source PDF',error);
    }
  }

  const url=sourceDocumentUrl(doc);
  if(url){
    try{
      const tab=window.open(url,'_blank','noopener');
      if(tab)try{tab.opener=null}catch(_e){}
      return true;
    }catch(error){
      console.warn('Could not open manufacturer source URL',error);
    }
  }

  if(options.fallbackToDocument!==false&&typeof openDocumentDetail==='function'){
    openDocumentDetail(doc.id);
    return true;
  }
  return false;
}
window.sourceDocumentUrl=sourceDocumentUrl;
window.sourcePdfPageFromCitation=sourcePdfPageFromCitation;
window.sourcePdfAttachment=sourcePdfAttachment;
window.openSourceReference=openSourceReference;

async function downloadAttachment(id){const f=await getAttachment(id);if(!f)return;const u=URL.createObjectURL(f.blob),a=document.createElement('a');a.href=u;a.download=f.name||'attachment';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200)}
async function deleteAttachment(type,entityId,id){if(!confirm('Delete this attached file?'))return;await removeAttachment(id);toast('Attachment deleted.');renderAttachments(type,entityId);renderStorageStats()}
async function clearAllAttachments(){
  if(supa&&cloudSession){alert('Shared cloud attachments must be deleted from their individual records so accidental bulk deletion is avoided.');return;}
  if(!confirm('Delete ALL locally stored screenshots, photos and files from this tracker? This cannot be undone unless you have a full backup.'))return;await clearAttachments();toast('All attachments deleted.');renderStorageStats()
}
