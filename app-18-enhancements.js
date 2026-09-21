// ---------- V4 APP ENHANCEMENTS ----------
// Maintenance, shared file library, activity, trash, system/backups, global search and install UX.

if(!NAV.some(x=>x[0]==='maintenance')) NAV.splice(Math.max(0,NAV.findIndex(x=>x[0]==='documents')),0,['maintenance','Maintenance']);
if(!NAV.some(x=>x[0]==='files')) NAV.splice(Math.max(0,NAV.findIndex(x=>x[0]==='documents')),0,['files','Files']);
if(!NAV.some(x=>x[0]==='activity')) NAV.splice(Math.max(0,NAV.findIndex(x=>x[0]==='access')),0,['activity','Activity']);
if(!NAV.some(x=>x[0]==='trash')) NAV.splice(Math.max(0,NAV.findIndex(x=>x[0]==='settings')),0,['trash','Trash']);
if(!NAV.some(x=>x[0]==='system')) NAV.splice(Math.max(0,NAV.findIndex(x=>x[0]==='settings')),0,['system','System']);

const normalizeDBV4Base=normalizeDB;
normalizeDB=function(){
  normalizeDBV4Base();
  db.version=4;
  db.maintenance=arr(db.maintenance);
  db.maintenance.forEach(x=>{
    x.title=x.title||'Maintenance item';x.system=x.system||'General';x.basis=x.basis||'date';x.meter=x.meter||'engine';
    x.intervalDays=x.intervalDays??'';x.intervalHours=x.intervalHours??'';x.lastDate=x.lastDate||'';x.lastHours=x.lastHours??'';
    x.nextDate=x.nextDate||'';x.nextHours=x.nextHours??'';x.notes=x.notes||'';
    x.procedureItems=arr(x.procedureItems).map(i=>({...i,id:String(i.id||crypto.randomUUID()),text:i.text||'Checklist item',done:!!i.done,note:i.note||'',sourceManaged:!!i.sourceManaged}));
    x.linkedChecklistSourceKey=x.linkedChecklistSourceKey||'';x.procedureSource=x.procedureSource||'';x.procedureSourceKey=x.procedureSourceKey||'';x.sourceDocumentId=x.sourceDocumentId||null;
  });
};
normalizeDB();

function nextNumericId(list,start=700){return Math.max(start,...arr(list).map(x=>Number(x.id)||0))+1}
function dateAddDays(iso,days){if(!iso||!Number(days))return '';const d=new Date(iso+'T12:00:00');if(Number.isNaN(d.getTime()))return '';d.setDate(d.getDate()+Number(days));return d.toISOString().slice(0,10)}
function maintenanceDueInfo(m){
  const now=new Date(),todayIso=now.toISOString().slice(0,10);
  const currentHours=Number(m.meter==='airframe'?db.aircraft.airframeHours:db.aircraft.engineHours);
  const dueDate=m.nextDate||dateAddDays(m.lastDate,m.intervalDays);
  const dueHours=(m.nextHours!==''&&m.nextHours!==null&&m.nextHours!==undefined)?Number(m.nextHours):(Number(m.lastHours)||0)+(Number(m.intervalHours)||0);
  let due=false,soon=false,reason=[];
  if((m.basis==='date'||m.basis==='both')&&dueDate){const dd=new Date(dueDate+'T12:00:00'),days=Math.ceil((dd-now)/86400000);if(dueDate<=todayIso){due=true;reason.push('date due')}else if(days<=30){soon=true;reason.push(`${days} days`)}else reason.push(dueDate)}
  if((m.basis==='hours'||m.basis==='both')&&Number.isFinite(currentHours)&&dueHours>0){const remain=dueHours-currentHours;if(remain<=0){due=true;reason.push('hours due')}else if(remain<=10){soon=true;reason.push(`${remain.toFixed(1)} hr`)}else reason.push(`${dueHours.toFixed(1)} hr`)}
  return {status:due?'Due':soon?'Due Soon':'OK',dueDate,dueHours:dueHours||'',reason:reason.join(' • ')};
}

function renderMaintenance(){
  const page=document.getElementById('page-maintenance');if(!page)return;
  const gates=db.projects.filter(p=>p.status!=='Done'&&/before|return|flight|engine/i.test(p.trigger||''));
  page.innerHTML=`<div class="grid">
    <div class="card span-8"><div class="toolbar"><div><h1>Maintenance</h1><div class="muted">Recurring date/hour items plus return-to-service gates from your active projects.</div></div><button class="primary" onclick="openMaintenanceModal()">+ Add Maintenance Item</button></div>
      <div class="controls" style="margin-top:10px"><input id="maintenanceSearch" placeholder="Search maintenance…"><select id="maintenanceSystem">${trackerSystemFilterOptions('')}</select><select id="maintenanceDue"><option value="">All due states</option><option>Due</option><option>Due Soon</option><option>OK</option></select></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Item</th><th>System</th><th>Basis</th><th>Next due</th><th>Status</th><th></th></tr></thead><tbody id="maintenanceRows"></tbody></table></div>
    </div>
    <div class="card span-4"><div class="section-head"><h2>Return-to-service gates</h2><button class="linkbtn" onclick="openProjectsView({status:'Active'})">Projects</button></div>${gates.slice(0,10).map(p=>`<div class="blocker click-row" onclick="openProjectDetail(${p.id})"><span class="dot"></span><div><b>${esc(p.title)}</b><div class="task-note">${esc(p.trigger)} • ${esc(p.nextStep||'No next step')}</div></div></div>`).join('')||'<div class="empty">No open return-to-service gates.</div>'}</div>
  </div>`;
  document.getElementById('maintenanceSearch')?.addEventListener('input',renderMaintenanceRows);
  document.getElementById('maintenanceSystem')?.addEventListener('change',renderMaintenanceRows);
  document.getElementById('maintenanceDue')?.addEventListener('change',renderMaintenanceRows);
  renderMaintenanceRows();
}
function renderMaintenanceRows(){
  const box=document.getElementById('maintenanceRows');if(!box)return;
  const q=(val('maintenanceSearch')||'').toLowerCase(),sys=val('maintenanceSystem'),dueFilter=val('maintenanceDue');
  const rows=[...db.maintenance].filter(m=>
    (!q||cloudStableJSON(m).toLowerCase().includes(q))&&
    trackerRecordMatchesSystem(m,sys,'maintenance')&&
    (!dueFilter||maintenanceDueInfo(m).status===dueFilter)
  ).sort((a,b)=>({Due:0,'Due Soon':1,OK:2}[maintenanceDueInfo(a).status]??9)-({Due:0,'Due Soon':1,OK:2}[maintenanceDueInfo(b).status]??9));
  box.innerHTML=rows.map(m=>{const d=maintenanceDueInfo(m),linked=m.linkedChecklistSourceKey?db.checklists.find(c=>c.sourceKey===m.linkedChecklistSourceKey):null,items=linked?arr(linked.items):arr(m.procedureItems),done=items.filter(i=>i.done).length,checkMeta=items.length?`<span class="mini-badge">${done}/${items.length} checklist</span>`:'';return `<tr class="click-row" onclick="openMaintenanceDetail(${m.id})"><td><b>${esc(m.title)}</b><div class="task-note">${esc(m.notes||m.sourceNotes||'')}</div>${checkMeta?`<div class="task-meta">${checkMeta}</div>`:''}</td><td>${esc(m.system||'—')}</td><td>${esc(m.basis==='both'?'Date + hours':m.basis||'—')}</td><td>${esc(d.reason||'Not set')}</td><td>${pill(d.status)}</td><td><button class="icon-btn" onclick="event.stopPropagation();openMaintenanceModal(${m.id})">Edit</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">No matching maintenance items.</td></tr>';
}

function maintenanceProcedureProgress(m){
  const linked=m?.linkedChecklistSourceKey?db.checklists.find(c=>c.sourceKey===m.linkedChecklistSourceKey):null;
  const items=linked?arr(linked.items):arr(m?.procedureItems);
  const done=items.filter(i=>i.done).length;
  return {linked,items,done,pct:items.length?Math.round(done/items.length*100):0};
}
function openMaintenanceDetail(id){
  const m=db.maintenance.find(x=>String(x.id)===String(id));if(!m)return;
  const d=maintenanceDueInfo(m),p=maintenanceProcedureProgress(m),doc=m.sourceDocumentId?docById(Number(m.sourceDocumentId)):null;
  currentDetail={type:'maintenance',id:m.id};
  const sourceText=m.procedureSource||m.sourceNotes||'';
  const checklist=p.linked
    ?`<div class="detail-card"><div class="section-tools"><div><h3>Procedure Checklist</h3><div class="muted tiny">${esc(p.linked.name)} • ${p.done}/${p.items.length} complete</div></div><button class="primary" onclick="openChecklistDetail('${esc(String(p.linked.id))}')">Open Full Checklist</button></div><div class="progress" style="margin-top:10px"><div style="width:${p.pct}%"></div></div><div class="maintenance-procedure-preview">${p.items.slice(0,6).map(i=>`<div class="${i.done?'done':''}"><span>${i.done?'✓':'○'}</span><span>${esc(i.text)}</span></div>`).join('')}${p.items.length>6?`<div class="muted tiny">+${p.items.length-6} more items in the full checklist</div>`:''}</div></div>`
    :p.items.length
      ?`<div class="detail-card"><div class="section-tools"><div><h3>Procedure Checklist</h3><div class="muted tiny">${p.done}/${p.items.length} complete • source-backed high-level work list</div></div>${p.done?'<button class="secondary" onclick="resetMaintenanceProcedure('+m.id+')">Reset</button>':''}</div><div class="progress" style="margin:10px 0 12px"><div style="width:${p.pct}%"></div></div><div class="maintenance-procedure-list">${p.items.map(i=>`<div class="maintenance-procedure-item ${i.done?'done':''}"><label><input type="checkbox" ${i.done?'checked':''} onchange="toggleMaintenanceProcedureItem(${m.id},'${esc(String(i.id))}',this.checked)"><span>${esc(i.text)}</span></label><button class="linkbtn" onclick="openMaintenanceProcedureNote(${m.id},'${esc(String(i.id))}')">${i.note?'Note ✓':'Note'}</button>${i.note?`<div class="maintenance-procedure-note">${esc(i.note)}</div>`:''}</div>`).join('')}</div></div>`
      :`<div class="detail-card"><h3>Procedure Checklist</h3><div class="empty">No procedure checklist is attached to this maintenance item yet.</div></div>`;
  openModal(`${modalHeader(m.title,m.system+' • '+d.status)}
    <div class="summary-strip">
      <div class="summary-cell"><div class="lab">Status</div><div class="val">${pill(d.status)}</div></div>
      <div class="summary-cell"><div class="lab">Basis</div><div class="val">${esc(m.basis==='both'?'Date + hours':m.basis||'—')}</div></div>
      <div class="summary-cell"><div class="lab">Next due</div><div class="val maintenance-small-val">${esc(d.reason||'Not set')}</div></div>
      <div class="summary-cell"><div class="lab">Checklist</div><div class="val">${p.items.length?(p.done+'/'+p.items.length):'—'}</div></div>
    </div>
    <div class="notice"><b>Maintenance aid:</b> This checklist summarizes source tasks for organization. Use the current applicable ROTAX manual / SI / SB and aircraft instructions for the actual procedure, torque values, limits and return-to-service requirements.</div>
    ${checklist}
    <div class="detail-card"><div class="section-tools"><h3>Source / Scheduling</h3>${doc?`<button class="secondary" onclick="openDocumentDetail(${doc.id})">Open Manual Record</button>`:''}</div>
      <div class="kv"><span>Manufacturer source</span><b>${esc(sourceText||'Not linked')}</b></div>
      <div class="kv"><span>Last completed</span><b>${esc([m.lastDate,m.lastHours!==''?(m.lastHours+' hr'):''].filter(Boolean).join(' • ')||'Not recorded')}</b></div>
      <div class="kv"><span>Next due override</span><b>${esc([m.nextDate,m.nextHours!==''?(m.nextHours+' hr'):''].filter(Boolean).join(' • ')||'None')}</b></div>
    </div>
    <div class="modal-actions"><button class="secondary" onclick="openMaintenanceModal(${m.id})">Edit Schedule</button>${m.engineServiceItemId&&typeof openEngineServiceComplete==='function'?`<button class="primary" onclick="recordMaintenanceService(${m.id})">Record Service</button>`:''}<button class="secondary" onclick="closeModal()">Close</button></div>`,true);
}
function toggleMaintenanceProcedureItem(mid,pid,done){
  const m=db.maintenance.find(x=>String(x.id)===String(mid)),i=arr(m?.procedureItems).find(x=>String(x.id)===String(pid));if(!m||!i)return;
  i.done=!!done;i.completedAt=i.done?new Date().toISOString():'';
  saveDB();openMaintenanceDetail(mid);
}
function openMaintenanceProcedureNote(mid,pid){
  const m=db.maintenance.find(x=>String(x.id)===String(mid)),i=arr(m?.procedureItems).find(x=>String(x.id)===String(pid));if(!m||!i)return;
  openModal(`${modalHeader('Checklist Note',m.title)}<div class="detail-card"><div class="detail-text">${esc(i.text)}</div></div>${textareaField('Notes / findings','mntProcNote',i.note||'')}<div class="modal-actions"><button class="secondary" onclick="openMaintenanceDetail(${m.id})">Cancel</button><button class="primary" onclick="saveMaintenanceProcedureNote(${m.id},'${esc(String(i.id))}')">Save Note</button></div>`,true);
}
function saveMaintenanceProcedureNote(mid,pid){
  const m=db.maintenance.find(x=>String(x.id)===String(mid)),i=arr(m?.procedureItems).find(x=>String(x.id)===String(pid));if(!m||!i)return;
  i.note=val('mntProcNote');saveDB('Checklist note saved.');openMaintenanceDetail(mid);
}
function resetMaintenanceProcedure(id){
  const m=db.maintenance.find(x=>String(x.id)===String(id));if(!m||!confirm('Reset all checklist checkmarks and notes for this maintenance item?'))return;
  arr(m.procedureItems).forEach(i=>{i.done=false;i.note='';i.completedAt=''});saveDB('Maintenance checklist reset.');openMaintenanceDetail(id);
}
function recordMaintenanceService(id){
  const m=db.maintenance.find(x=>String(x.id)===String(id));if(!m||!m.engineServiceItemId||typeof openEngineServiceComplete!=='function')return;
  const p=maintenanceProcedureProgress(m),remaining=p.items.length-p.done;
  if(remaining>0&&!confirm(remaining+' checklist item'+(remaining===1?'':'s')+' remain incomplete. Record the service anyway?'))return;
  openEngineServiceComplete(m.engineServiceItemId);
}

function openMaintenanceModal(id=null){
  const m=id?db.maintenance.find(x=>x.id===id):{id:null,title:'',system:'',basis:'date',meter:'engine',intervalDays:'',intervalHours:'',lastDate:'',lastHours:'',nextDate:'',nextHours:'',notes:''};
  if(!m)return;
  openModal(`${modalHeader(id?'Edit Maintenance Item':'Add Maintenance Item')}
    <div class="form-grid">${field('Item','mntTitle',m.title,'text','required')}${field('System','mntSystem',m.system)}
    <div><label>Basis</label><select id="mntBasis"><option value="date" ${m.basis==='date'?'selected':''}>Date</option><option value="hours" ${m.basis==='hours'?'selected':''}>Hours</option><option value="both" ${m.basis==='both'?'selected':''}>Date + hours</option></select></div>
    <div><label>Hour meter</label><select id="mntMeter"><option value="engine" ${m.meter==='engine'?'selected':''}>Engine hours</option><option value="airframe" ${m.meter==='airframe'?'selected':''}>Airframe hours</option></select></div>
    ${field('Interval days','mntDays',m.intervalDays,'number','min="0"')}${field('Interval hours','mntHours',m.intervalHours,'number','step="0.1" min="0"')}
    ${field('Last completed date','mntLastDate',m.lastDate,'date')}${field('Last completed hours','mntLastHours',m.lastHours,'number','step="0.1"')}
    ${field('Next due date (optional override)','mntNextDate',m.nextDate,'date')}${field('Next due hours (optional override)','mntNextHours',m.nextHours,'number','step="0.1"')}
    ${textareaField('Notes','mntNotes',m.notes)}</div>
    <div class="modal-actions">${id?`<button class="danger" onclick="deleteMaintenance(${id})">Move to Trash</button>`:''}<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveMaintenance(${id||'null'})">Save</button></div>`,true);
}
function saveMaintenance(id){
  const obj={id:id||nextNumericId(db.maintenance,700),title:val('mntTitle').trim()||'Maintenance item',system:val('mntSystem').trim()||'General',basis:val('mntBasis')||'date',meter:val('mntMeter')||'engine',intervalDays:val('mntDays'),intervalHours:val('mntHours'),lastDate:val('mntLastDate'),lastHours:val('mntLastHours'),nextDate:val('mntNextDate'),nextHours:val('mntNextHours'),notes:val('mntNotes')};
  const i=db.maintenance.findIndex(x=>String(x.id)===String(id));if(i>=0)db.maintenance[i]=obj;else db.maintenance.push(obj);closeModal();saveDB('Maintenance item saved.');
}
function deleteMaintenance(id){if(!confirm('Move this maintenance item to Trash?'))return;db.maintenance=db.maintenance.filter(x=>String(x.id)!==String(id));closeModal();saveDB('Maintenance item moved to Trash.')}
(()=>{if(document.getElementById('maintenanceChecklistStyle'))return;const s=document.createElement('style');s.id='maintenanceChecklistStyle';s.textContent=`
.maintenance-procedure-list{display:grid;gap:8px}.maintenance-procedure-item{border:1px solid var(--line);border-radius:9px;padding:10px;background:#fff}.maintenance-procedure-item>label{display:flex;align-items:flex-start;gap:9px;cursor:pointer;font-size:13px;line-height:1.35}.maintenance-procedure-item input{width:auto;margin-top:2px}.maintenance-procedure-item.done>label span{text-decoration:line-through;opacity:.65}.maintenance-procedure-item>.linkbtn{margin-top:7px}.maintenance-procedure-note{margin:7px 0 0 25px;padding:7px 9px;border-radius:7px;background:#f7f9fb;font-size:12px;white-space:pre-wrap}.maintenance-procedure-preview{display:grid;gap:7px;margin-top:12px}.maintenance-procedure-preview>div{display:grid;grid-template-columns:18px 1fr;gap:7px;font-size:12px;line-height:1.35}.maintenance-procedure-preview>div.done{opacity:.65}.maintenance-small-val{font-size:13px!important;line-height:1.25}
`;document.head.appendChild(s)})();

// ---------- SHARED FILE LIBRARY ----------
let filePreviewUrls=[];
function clearFilePreviewUrls(){filePreviewUrls.forEach(URL.revokeObjectURL);filePreviewUrls=[]}
async function fetchLibraryFiles(includeDeleted=false){
  if(!supa||!cloudWorkspaceId)return [];
  let q=supa.from('tracker_records').select('record_id,data,deleted_at,updated_at').eq('workspace_id',cloudWorkspaceId).eq('record_type','file');
  q=includeDeleted?q.not('deleted_at','is',null):q.is('deleted_at',null);
  const {data,error}=await q.order('updated_at',{ascending:false});if(error)throw error;return data||[];
}
async function renderFiles(){
  const page=document.getElementById('page-files');if(!page)return;clearFilePreviewUrls();
  if(!cloudSession||!cloudWorkspaceId){page.innerHTML='<div class="card"><h1>Files</h1><div class="empty">Sign in to use the shared file library.</div></div>';return;}
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>Shared Files</h1><div class="muted">Upload photos, PDFs, receipts, screenshots, manuals and other files here. They are available anywhere you sign in.</div></div><button class="primary" onclick="document.getElementById('libraryFile').click()">+ Upload Files</button></div>
  <div class="upload-drop" ondragover="event.preventDefault()" ondrop="handleLibraryDrop(event)" onclick="document.getElementById('libraryFile').click()"><b>Drop files here</b><span>or click to choose files • up to 30 MB each</span></div><div id="fileLibraryRows"><div class="empty">Loading shared files…</div></div></div>`;
  try{const rows=await fetchLibraryFiles(false);renderLibraryRows(rows)}catch(e){document.getElementById('fileLibraryRows').innerHTML=`<div class="danger-note">Could not load files: ${esc(e.message)}</div>`}
}
function renderLibraryRows(rows){
  const box=document.getElementById('fileLibraryRows');if(!box)return;
  if(!rows.length){box.innerHTML='<div class="empty">No shared files yet.</div>';return;}
  box.innerHTML=`<div class="file-grid">${rows.map(r=>{const f=r.data||{};return `<div class="file-card"><div class="file-thumb" id="libthumb-${esc(r.record_id)}">${String(f.mime||'').startsWith('image/')?'🖼️':'📎'}</div><div class="file-card-body"><b title="${esc(f.name||'File')}">${esc(f.name||'File')}</b><div class="tiny muted">${formatBytes(f.size||0)} • ${esc((f.uploadedAt||r.updated_at||'').slice(0,10))}</div>${f.caption?`<div class="small" style="margin-top:5px">${esc(f.caption)}</div>`:''}<div class="action-row" style="margin-top:8px"><button class="icon-btn" onclick="openSharedLibraryFile('${esc(f.path||'')}')">Open</button><button class="icon-btn" onclick="downloadSharedLibraryFile('${esc(f.path||'')}','${esc(String(f.name||'file')).replace(/'/g,'&#39;')}')">Save</button><button class="icon-btn" onclick="editLibraryFileMeta('${r.record_id}')">Details</button><button class="icon-btn" onclick="trashLibraryFile('${r.record_id}')">Trash</button></div></div></div>`}).join('')}</div>`;
  rows.filter(r=>String(r.data?.mime||'').startsWith('image/')&&r.data?.path).slice(0,30).forEach(async r=>{try{const {data,error}=await supa.storage.from(CLOUD_BUCKET).createSignedUrl(r.data.path,1800);if(error)return;const el=document.getElementById('libthumb-'+r.record_id);if(el)el.innerHTML=`<img src="${data.signedUrl}" alt="${esc(r.data.name||'image')}">`}catch(_e){}});
}
async function handleLibraryDrop(e){e.preventDefault();e.stopPropagation();await uploadLibraryFiles([...(e.dataTransfer?.files||[])])}
async function uploadLibraryFiles(files){
  if(!files.length)return;if(!cloudSession||!cloudWorkspaceId)return toast('Sign in to upload shared files.','bad');if(!canCloudEdit())return toast('Viewer access is read-only.','bad');
  const tooLarge=files.find(f=>f.size>30*1024*1024);if(tooLarge)return alert(`${tooLarge.name} is larger than 30 MB.`);
  try{
    cloudStatusLabel('Uploading…');
    for(const f of files){
      const id=crypto.randomUUID(),path=`${WORKSPACE_SLUG}/library/${id}__${safeCloudName(f.name)}`;
      const up=await supa.storage.from(CLOUD_BUCKET).upload(path,f,{contentType:f.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;
      const data={id,name:f.name,path,mime:f.type||'application/octet-stream',size:f.size,caption:'',tags:'',uploadedAt:new Date().toISOString()};
      const ins=await supa.from('tracker_records').upsert({workspace_id:cloudWorkspaceId,record_type:'file',record_id:id,data,deleted_at:null,updated_at:new Date().toISOString(),updated_by:cloudSession.user.id,updated_client:typeof CLOUD_CLIENT_ID==='undefined'?'library':CLOUD_CLIENT_ID},{onConflict:'workspace_id,record_type,record_id'});if(ins.error)throw ins.error;
    }
    cloudStatusLabel('Synced');toast(`${files.length} shared file${files.length===1?'':'s'} uploaded.`,'good');await renderFiles();
  }catch(e){cloudStatusLabel('Sync pending');alert('Upload failed: '+e.message)}
}
async function openSharedLibraryFile(path){if(!path)return;const {data,error}=await supa.storage.from(CLOUD_BUCKET).createSignedUrl(path,300);if(error)return alert(error.message);window.open(data.signedUrl,'_blank')}
async function downloadSharedLibraryFile(path,name){if(!path)return;const {data,error}=await supa.storage.from(CLOUD_BUCKET).download(path);if(error)return alert(error.message);const u=URL.createObjectURL(data),a=document.createElement('a');a.href=u;a.download=name||'file';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function editLibraryFileMeta(id){
  const {data,error}=await supa.from('tracker_records').select('data').eq('workspace_id',cloudWorkspaceId).eq('record_type','file').eq('record_id',id).maybeSingle();if(error||!data)return alert(error?.message||'File not found');const f=data.data||{};
  openModal(`${modalHeader('File Details',f.name||'Shared file')}<div class="form-grid">${field('File name','libName',f.name||'')}${field('Tags','libTags',f.tags||'')}${textareaField('Caption / notes','libCaption',f.caption||'')}</div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveLibraryFileMeta('${id}')">Save</button></div>`);
}
async function saveLibraryFileMeta(id){
  const {data:row,error}=await supa.from('tracker_records').select('data').eq('workspace_id',cloudWorkspaceId).eq('record_type','file').eq('record_id',id).maybeSingle();if(error||!row)return alert(error?.message||'File not found');const f={...(row.data||{}),name:val('libName').trim()||row.data?.name||'File',tags:val('libTags'),caption:val('libCaption')};
  const u=await supa.from('tracker_records').update({data:f,updated_at:new Date().toISOString(),updated_by:cloudSession.user.id,updated_client:typeof CLOUD_CLIENT_ID==='undefined'?'library':CLOUD_CLIENT_ID}).eq('workspace_id',cloudWorkspaceId).eq('record_type','file').eq('record_id',id);if(u.error)return alert(u.error.message);closeModal();toast('File details updated.','good');renderFiles();
}
async function trashLibraryFile(id){if(!confirm('Move this file to Trash? The stored file will be retained so it can be restored.'))return;const u=await supa.from('tracker_records').update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:cloudSession.user.id,updated_client:typeof CLOUD_CLIENT_ID==='undefined'?'library':CLOUD_CLIENT_ID}).eq('workspace_id',cloudWorkspaceId).eq('record_type','file').eq('record_id',id);if(u.error)return alert(u.error.message);toast('File moved to Trash.','good');renderFiles()}

// ---------- ACTIVITY ----------
async function renderActivity(){
  const page=document.getElementById('page-activity');if(!page)return;
  if(!cloudSession||!cloudWorkspaceId){page.innerHTML='<div class="card"><h1>Activity</h1><div class="empty">Sign in to view shared activity.</div></div>';return;}
  page.innerHTML='<div class="card"><div class="toolbar"><div><h1>Activity</h1><div class="muted">Who changed what, and when.</div></div><button class="secondary" onclick="renderActivity()">Refresh</button></div><div id="activityRows"><div class="empty">Loading activity…</div></div></div>';
  const {data,error}=await supa.rpc('list_workspace_activity',{target_workspace:cloudWorkspaceId,limit_count:200});const box=document.getElementById('activityRows');if(!box)return;if(error){box.innerHTML=`<div class="danger-note">${esc(error.message)}</div>`;return;}
  box.innerHTML=`<div class="activity-list">${(data||[]).map(a=>`<div class="activity-row"><div class="activity-icon">${a.action==='created'?'＋':a.action==='trashed'?'🗑':a.action==='restored'?'↩':'✎'}</div><div><b>${esc(a.label||a.record_type)}</b><div class="small">${esc(a.action)} • ${esc(a.record_type)}</div><div class="tiny muted">${esc(a.email||'User')} • ${new Date(a.created_at).toLocaleString()}</div></div></div>`).join('')||'<div class="empty">No activity yet.</div>'}</div>`;
}

// ---------- TRASH / RESTORE ----------
async function renderTrash(){
  const page=document.getElementById('page-trash');if(!page)return;
  if(!cloudSession||!cloudWorkspaceId){page.innerHTML='<div class="card"><h1>Trash</h1><div class="empty">Sign in to view Trash.</div></div>';return;}
  page.innerHTML='<div class="card"><div class="toolbar"><div><h1>Trash</h1><div class="muted">Deleted tracker records and shared files stay here until you restore them.</div></div><button class="secondary" onclick="renderTrash()">Refresh</button></div><div id="trashRows"><div class="empty">Loading Trash…</div></div></div>';
  const {data,error}=await supa.from('tracker_records').select('record_type,record_id,data,deleted_at').eq('workspace_id',cloudWorkspaceId).not('deleted_at','is',null).order('deleted_at',{ascending:false});const box=document.getElementById('trashRows');if(!box)return;if(error){box.innerHTML=`<div class="danger-note">${esc(error.message)}</div>`;return;}
  box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Record</th><th>Type</th><th>Deleted</th><th></th></tr></thead><tbody>${(data||[]).map(r=>{const x=r.data||{},label=x.title||x.name||x.item||x.work||`${r.record_type} ${r.record_id}`;return `<tr><td><b>${esc(label)}</b></td><td>${esc(r.record_type)}</td><td>${new Date(r.deleted_at).toLocaleString()}</td><td><button class="icon-btn" onclick="restoreTrashRecord('${esc(r.record_type)}','${esc(r.record_id)}')">Restore</button></td></tr>`}).join('')||'<tr><td colspan="4" class="empty">Trash is empty.</td></tr>'}</tbody></table></div>`;
}
async function restoreTrashRecord(type,id){const u=await supa.from('tracker_records').update({deleted_at:null,updated_at:new Date().toISOString(),updated_by:cloudSession.user.id,updated_client:typeof CLOUD_CLIENT_ID==='undefined'?'restore':CLOUD_CLIENT_ID}).eq('workspace_id',cloudWorkspaceId).eq('record_type',type).eq('record_id',id);if(u.error)return alert(u.error.message);toast('Record restored.','good');await loadCloudState(true);renderTrash()}

// ---------- CLOUD SNAPSHOTS / SYSTEM ----------
async function renderSystem(){
  const page=document.getElementById('page-system');if(!page)return;
  if(!cloudSession||!cloudWorkspaceId){page.innerHTML='<div class="card"><h1>System</h1><div class="empty">Sign in to view cloud health and backups.</div></div>';return;}
  page.innerHTML=`<div class="grid"><div class="card span-5"><h1>System & Sync</h1><div class="kv"><span>Account role</span><b>${esc(cloudRole||'—')}</b></div><div class="kv"><span>Connection</span><b>${navigator.onLine?'Online':'Offline'}</b></div><div class="kv"><span>Last synced</span><b>${typeof lastCloudSyncAt!=='undefined'&&lastCloudSyncAt?lastCloudSyncAt.toLocaleTimeString():'—'}</b></div><div class="kv"><span>App version</span><b>v4.0</b></div><div class="action-row" style="margin-top:12px"><button class="primary" onclick="forceCloudReload()">Reload Shared Data</button><button class="secondary" onclick="exportCoreData()">Export JSON</button><button class="secondary" id="installAppBtn" onclick="installN594ZSApp()" style="display:none">Install App</button></div></div>
    <div class="card span-7"><div class="toolbar"><div><h2>Cloud Snapshots</h2><div class="muted">Manual point-in-time backups of all active tracker records.</div></div><button class="primary" onclick="createCloudSnapshot()">Create Snapshot</button></div><div id="snapshotRows"><div class="empty">Loading snapshots…</div></div></div></div>`;
  if(window.n594zsInstallPrompt)document.getElementById('installAppBtn').style.display='inline-flex';
  const {data,error}=await supa.from('tracker_snapshots').select('id,label,created_at,created_by').eq('workspace_id',cloudWorkspaceId).order('created_at',{ascending:false}).limit(20);const box=document.getElementById('snapshotRows');if(!box)return;if(error){box.innerHTML=`<div class="danger-note">${esc(error.message)}</div>`;return;}
  box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Snapshot</th><th>Created</th><th></th></tr></thead><tbody>${(data||[]).map(s=>`<tr><td><b>${esc(s.label)}</b></td><td>${new Date(s.created_at).toLocaleString()}</td><td><button class="icon-btn" onclick="restoreCloudSnapshot('${s.id}','${esc(s.label).replace(/'/g,'&#39;')}')">Restore</button></td></tr>`).join('')||'<tr><td colspan="3" class="empty">No cloud snapshots yet.</td></tr>'}</tbody></table></div>`;
}
async function createCloudSnapshot(){const label=prompt('Snapshot label:','Manual snapshot '+new Date().toLocaleString());if(label===null)return;const {error}=await supa.rpc('create_workspace_snapshot',{target_workspace:cloudWorkspaceId,snapshot_label:label});if(error)return alert(error.message);toast('Cloud snapshot created.','good');renderSystem()}
async function restoreCloudSnapshot(id,label){if(!confirm(`Restore snapshot “${label}”? Current active records will move to Trash first.`))return;const {data,error}=await supa.rpc('restore_workspace_snapshot',{snapshot_id:id});if(error)return alert(error.message);toast(`Snapshot restored (${data} records).`,'good');await loadCloudState(true);renderSystem()}

// ---------- GLOBAL SEARCH ----------
function globalSearchChanged(q){if(!q.trim()){if(currentPage==='search')renderSearchPage('');return;}currentPage='search';document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-search')?.classList.add('active');renderNav();renderSearchPage(q)}
async function renderSearchPage(q=''){
  const page=document.getElementById('page-search');if(!page)return;const term=(q||document.getElementById('globalSearchInput')?.value||'').trim().toLowerCase();
  if(!term){page.innerHTML='<div class="card"><h1>Search</h1><div class="empty">Type in the search box above to search projects, parts, orders, work logs, documents, checklists, maintenance and shared files.</div></div>';return;}
  const results=[];
  db.projects.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Project',label:x.title,sub:x.nextStep||x.summary,go:`openProjectDetail(${x.id})`})});
  db.parts.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Part',label:x.name,sub:x.partNo||x.notes,go:`openPartDetail(${x.id})`})});
  db.orders.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Order',label:x.item,sub:x.vendor||x.status,go:`openOrderDetail(${x.id})`})});
  db.logs.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Work Log',label:x.work||x.date,sub:x.date+' • '+x.system,go:`openLogDetail(${x.id})`})});
  db.docs.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Document',label:x.name,sub:x.type||x.location,go:`openDocumentDetail(${x.id})`})});
  db.checklists.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Checklist',label:x.name,sub:x.trigger||x.purpose,go:`openChecklistDetail(${x.id})`})});
  db.maintenance.forEach(x=>{if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'Maintenance',label:x.title,sub:maintenanceDueInfo(x).reason,go:`openMaintenanceModal(${x.id})`})});
  if(supa&&cloudWorkspaceId){try{const {data}=await supa.from('tracker_records').select('record_id,data').eq('workspace_id',cloudWorkspaceId).eq('record_type','file').is('deleted_at',null);(data||[]).forEach(r=>{const x=r.data||{};if(cloudStableJSON(x).toLowerCase().includes(term))results.push({kind:'File',label:x.name||'File',sub:x.caption||x.tags||formatBytes(x.size||0),go:`openSharedLibraryFile('${String(x.path||'').replace(/'/g,"\\'")}')`})})}catch(_e){}}
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>Search</h1><div class="muted">${results.length} result${results.length===1?'':'s'} for “${esc(term)}”</div></div></div><div class="search-results">${results.slice(0,100).map(r=>`<button class="search-result" onclick="${r.go}"><span class="mini-badge">${esc(r.kind)}</span><b>${esc(r.label||'Untitled')}</b><small>${esc(r.sub||'')}</small></button>`).join('')||'<div class="empty">No matches.</div>'}</div></div>`;
}

// Page rendering/navigation is coordinated centrally by app-61-performance.

const libraryFileInput=document.getElementById('libraryFile');if(libraryFileInput)libraryFileInput.addEventListener('change',async e=>{const files=[...(e.target.files||[])];e.target.value='';await uploadLibraryFiles(files)});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();document.getElementById('globalSearchInput')?.focus()}});
