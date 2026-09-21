// ---------- CHECKLISTS ----------
// Canonical checklist implementation. Supports numeric legacy IDs and UUID IDs natively.
// Specialized checklist types (currently Annual Inspection) are dispatched explicitly.

function checklistItemById(c,id){return c?.items?.find(x=>String(x.id)===String(id))||null}
function isAnnualInspectionChecklist(c){return !!c?.inspectionMode&&Number(c.id)===503}

function renderChecklists(){
  const page=document.getElementById('page-checklists');if(!page)return;
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>Checklists</h1><div class="muted">Click a checklist to open its purpose, trigger, linked project, item notes and supporting files.</div></div><button class="btn primary" id="checklistNewBtn">+ New Checklist</button></div>
    ${db.checklists.map(c=>{const items=arr(c.items),done=items.filter(i=>i.done).length,pct=items.length?Math.round(done/items.length*100):0;return `
      <div class="checklist click-row" role="button" tabindex="0" data-checklist-id="${esc(String(c.id))}">
        <div class="check-head"><div><b>${esc(c.name)}</b><span class="badge-count">${done}/${items.length}</span><div class="task-note">${esc(c.trigger||c.purpose)}</div></div>
        <div style="min-width:150px"><div class="progress"><div style="width:${pct}%"></div></div><div class="tiny muted right" style="margin-top:4px">${pct}%</div></div></div>
        <div class="check-body">${items.slice(0,5).map(i=>`<div class="check-item"><input type="checkbox" data-checklist-checkbox data-checklist-id="${esc(String(c.id))}" data-item-id="${esc(String(i.id))}" ${i.done?'checked':''}><span class="${i.done?'done':''}">${esc(i.text)}</span></div>`).join('')||'<div class="empty">No checklist items.</div>'}
        ${items.length>5?`<div class="tiny muted" style="padding-top:8px">+ ${items.length-5} more items — click to open</div>`:''}</div>
      </div>`}).join('')||'<div class="empty">No checklists yet.</div>'}
  </div>`;

  document.getElementById('checklistNewBtn')?.addEventListener('click',()=>openChecklistModal());
  page.querySelectorAll('[data-checklist-id].checklist').forEach(card=>{
    const open=()=>openChecklistDetail(card.dataset.checklistId);
    card.addEventListener('click',e=>{if(e.target.closest('input,button,a,select,textarea,label'))return;open()});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  });
  page.querySelectorAll('[data-checklist-checkbox]').forEach(box=>{
    box.addEventListener('click',e=>e.stopPropagation());
    box.addEventListener('change',e=>toggleChecklistItem(box.dataset.checklistId,box.dataset.itemId,e.target.checked));
  });
}

function openChecklistModal(id=null){
  const existing=id!==null&&id!==undefined&&id!==''?checklistById(id):null;
  const c=existing||{name:'',purpose:'',system:'',trigger:'',projectId:null,notes:''};
  openModal(`${modalHeader(existing?'Edit Checklist':'New Checklist')}<div class="form-grid"><div class="full"><label>Checklist name</label><input id="ckName" value="${esc(c.name)}"></div>${field('Purpose','ckPurpose',c.purpose)}<div><label>System</label><select id="ckSystem">${systemOptions(c.system)}</select></div>${field('Trigger / when used','ckTrigger',c.trigger)}<div><label>Linked project</label><select id="ckProject">${projectOptions(c.projectId)}</select></div>${textareaField('Checklist notes','ckNotes',c.notes)}</div><div class="modal-actions"><button class="btn secondary" id="ckCancel">Cancel</button>${existing?'<button class="btn danger" id="ckDelete">Delete</button>':''}<button class="btn primary" id="ckSave">Save Checklist</button></div>`);
  document.getElementById('ckCancel')?.addEventListener('click',closeModal);
  document.getElementById('ckDelete')?.addEventListener('click',()=>deleteChecklist(existing.id));
  document.getElementById('ckSave')?.addEventListener('click',()=>saveChecklist(existing?.id??null));
}
function saveChecklist(id){
  const o={name:val('ckName'),purpose:val('ckPurpose'),system:val('ckSystem'),trigger:val('ckTrigger'),projectId:selectedNumber('ckProject'),notes:val('ckNotes')};
  if(!o.name)return alert('Checklist name is required.');
  const existing=id!==null&&id!==undefined&&id!==''?checklistById(id):null;
  if(existing)Object.assign(existing,o);else db.checklists.push({id:uid(),...o,items:[]});
  closeModal();saveDB(existing?'Checklist updated.':'Checklist created.');
}
function deleteChecklist(id){
  if(!confirm('Delete this checklist?'))return;
  db.checklists=db.checklists.filter(x=>String(x.id)!==String(id));
  closeModal();saveDB('Checklist deleted.');
}

function openChecklistDetail(id){
  const c=checklistById(id);
  if(!c){toast('Checklist record could not be found.','bad');return}
  if(isAnnualInspectionChecklist(c)&&typeof window.openAnnualInspectionChecklist==='function')return window.openAnnualInspectionChecklist(c.id);

  const items=arr(c.items),done=items.filter(i=>i.done).length,pct=items.length?Math.round(done/items.length*100):0;
  const pr=c.projectId?projectById(Number(c.projectId)):null;
  const sourceDocId=c.sourceDocumentId||c.documentId||null;
  const sourceDoc=sourceDocId?docById(Number(sourceDocId)):null;
  currentDetail={type:'checklist',id:c.id};

  openModal(`${modalHeader(c.name,c.trigger||c.purpose)}
    <div class="summary-strip"><div class="summary-cell"><div class="lab">Progress</div><div class="val">${pct}%</div></div><div class="summary-cell"><div class="lab">Complete</div><div class="val">${done}/${items.length}</div></div><div class="summary-cell"><div class="lab">System</div><div class="val">${esc(c.system||'—')}</div></div><div class="summary-cell"><div class="lab">Project</div><div class="val">${esc(pr?.title||'—')}</div></div></div>
    <div class="detail-grid"><div>
      <div class="detail-card"><div class="section-tools"><h3>Checklist Items</h3><button class="icon-btn" id="ckDetailAdd">+ Item</button></div>
        ${items.map(i=>`<div class="check-item"><input type="checkbox" data-detail-check data-item-id="${esc(String(i.id))}" ${i.done?'checked':''}><div style="flex:1"><div class="${i.done?'done':''}">${esc(i.text)}</div>${i.note?`<div class="task-note">${esc(i.note)}</div>`:''}</div><button class="icon-btn" data-detail-edit data-item-id="${esc(String(i.id))}">Edit</button></div>`).join('')||'<div class="empty">No items yet.</div>'}
      </div>
      <div class="detail-card"><div class="section-tools"><h3>Evidence / Supporting Files</h3><button class="icon-btn" id="ckUpload">+ Upload</button></div><div class="attach-drop" id="ckDrop">Attach photos, screenshots or reference files for this checklist</div><div id="attachments-checklist-${esc(String(c.id))}"></div></div>
    </div><div>
      <div class="detail-card"><div class="section-tools"><h3>Checklist Details</h3><button class="icon-btn" id="ckDetailEdit">Edit</button></div><label>Purpose</label><div class="detail-text">${esc(c.purpose||'—')}</div><div class="detail-section"><label>Notes / Source</label><div class="detail-text">${esc(c.notes||'—')}</div></div></div>
      ${sourceDoc?`<div class="detail-card"><h3>Source Document</h3><div class="kv click-row" id="ckSourceDoc"><span>${esc(sourceDoc.name)}</span><b>${esc(sourceDoc.revision||'Open')}</b></div></div>`:''}
      ${pr?`<div class="detail-card"><h3>Linked Project</h3><div class="kv click-row" id="ckLinkedProject"><span>${esc(pr.title)}</span>${pill(pr.status)}</div></div>`:''}
    </div></div>`,true);

  const box=document.getElementById('modalBox');
  box?.querySelector('#ckDetailAdd')?.addEventListener('click',()=>addChecklistItem(c.id));
  box?.querySelector('#ckDetailEdit')?.addEventListener('click',()=>openChecklistModal(c.id));
  box?.querySelector('#ckUpload')?.addEventListener('click',()=>chooseAttachments('checklist',c.id));
  const drop=box?.querySelector('#ckDrop');
  if(drop){
    drop.addEventListener('click',()=>chooseAttachments('checklist',c.id));
    drop.addEventListener('dragover',e=>e.preventDefault());
    drop.addEventListener('drop',e=>handleEntityDrop(e,'checklist',c.id));
  }
  box?.querySelector('#ckSourceDoc')?.addEventListener('click',()=>openDocumentDetail(sourceDoc.id));
  box?.querySelector('#ckLinkedProject')?.addEventListener('click',()=>openProjectDetail(pr.id));
  box?.querySelectorAll('[data-detail-check]').forEach(el=>el.addEventListener('change',e=>toggleChecklistItem(c.id,el.dataset.itemId,e.target.checked)));
  box?.querySelectorAll('[data-detail-edit]').forEach(el=>el.addEventListener('click',()=>editChecklistItem(c.id,el.dataset.itemId)));
  Promise.resolve(renderAttachments('checklist',c.id)).catch(e=>console.warn('Checklist attachments failed',e));
}

function addChecklistItem(cid){
  const c=checklistById(cid);if(!c)return;
  openModal(`${modalHeader('Add Checklist Item',c.name)}<div class="form-grid"><div class="full"><label>Item</label><input id="ckiText"></div>${textareaField('Item note / acceptance detail','ckiNote','')}</div><div class="modal-actions"><button class="btn secondary" id="ckiCancel">Cancel</button><button class="btn primary" id="ckiSave">Add Item</button></div>`);
  document.getElementById('ckiCancel')?.addEventListener('click',()=>openChecklistDetail(c.id));
  document.getElementById('ckiSave')?.addEventListener('click',()=>saveChecklistItem(c.id,null));
}
function editChecklistItem(cid,iid){
  const c=checklistById(cid),i=checklistItemById(c,iid);if(!i)return;
  openModal(`${modalHeader('Edit Checklist Item',c.name)}<div class="form-grid"><div class="full"><label>Item</label><input id="ckiText" value="${esc(i.text)}"></div>${textareaField('Item note / acceptance detail','ckiNote',i.note||'')}</div><div class="modal-actions"><button class="btn secondary" id="ckiCancel">Cancel</button><button class="btn danger" id="ckiDelete">Delete</button><button class="btn primary" id="ckiSave">Save Item</button></div>`);
  document.getElementById('ckiCancel')?.addEventListener('click',()=>openChecklistDetail(c.id));
  document.getElementById('ckiDelete')?.addEventListener('click',()=>deleteChecklistItem(c.id,i.id));
  document.getElementById('ckiSave')?.addEventListener('click',()=>saveChecklistItem(c.id,i.id));
}
function saveChecklistItem(cid,iid){
  const c=checklistById(cid);if(!c)return;
  const text=val('ckiText'),note=val('ckiNote');if(!text)return alert('Item text is required.');
  const item=iid!==null&&iid!==undefined&&iid!==''?checklistItemById(c,iid):null;
  if(item)Object.assign(item,{text,note});else c.items.push({id:uid(),text,note,done:false});
  saveDB('Checklist item saved.');openChecklistDetail(c.id);
}
function toggleChecklistItem(cid,iid,done){
  const c=checklistById(cid),i=checklistItemById(c,iid);if(!i)return;
  i.done=!!done;saveDB();
  if(currentDetail?.type==='checklist'&&String(currentDetail.id)===String(c.id))openChecklistDetail(c.id);
}
function deleteChecklistItem(cid,iid){
  const c=checklistById(cid);if(!c||!confirm('Delete this checklist item?'))return;
  c.items=c.items.filter(x=>String(x.id)!==String(iid));
  saveDB('Checklist item deleted.');openChecklistDetail(c.id);
}
