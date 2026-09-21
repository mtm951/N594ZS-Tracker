// ---------- CHECKLISTS ----------
function checklistJsId(v){return JSON.stringify(String(v))}
function checklistItemById(c,id){return c?.items?.find(x=>String(x.id)===String(id))||null}

function openChecklistModal(id=null){
  const existing=id!==null&&id!==undefined&&id!==''?checklistById(id):null;
  const c=existing||{name:'',purpose:'',system:'',trigger:'',projectId:null,notes:''};
  const jid=existing?checklistJsId(c.id):'null';
  openModal(`${modalHeader(existing?'Edit Checklist':'New Checklist')}<div class="form-grid"><div class="full"><label>Checklist name</label><input id="ckName" value="${esc(c.name)}"></div>${field('Purpose','ckPurpose',c.purpose)}<div><label>System</label><select id="ckSystem">${systemOptions(c.system)}</select></div>${field('Trigger / when used','ckTrigger',c.trigger)}<div><label>Linked project</label><select id="ckProject">${projectOptions(c.projectId)}</select></div>${textareaField('Checklist notes','ckNotes',c.notes)}</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button>${existing?`<button class="btn danger" onclick='deleteChecklist(${jid})'>Delete</button>`:''}<button class="btn primary" onclick='saveChecklist(${jid})'>Save Checklist</button></div>`);
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
  const c=checklistById(id);if(!c)return;
  const cid=checklistJsId(c.id);
  currentDetail={type:'checklist',id:c.id};
  const done=c.items.filter(i=>i.done).length,pct=c.items.length?Math.round(done/c.items.length*100):0;
  const pr=c.projectId?projectById(c.projectId):null;
  openModal(`${modalHeader(c.name,c.trigger||c.purpose)}<div class="summary-strip"><div class="summary-cell"><div class="lab">Progress</div><div class="val">${pct}%</div></div><div class="summary-cell"><div class="lab">Complete</div><div class="val">${done}/${c.items.length}</div></div><div class="summary-cell"><div class="lab">System</div><div class="val">${esc(c.system||'—')}</div></div><div class="summary-cell"><div class="lab">Project</div><div class="val">${esc(pr?.title||'—')}</div></div></div><div class="detail-grid"><div><div class="detail-card"><div class="section-tools"><h3>Checklist Items</h3><button class="icon-btn" onclick='addChecklistItem(${cid})'>+ Item</button></div>${c.items.map(i=>{const iid=checklistJsId(i.id);return `<div class="check-item"><input type="checkbox" ${i.done?'checked':''} onchange='toggleChecklistItem(${cid},${iid},this.checked)'><div style="flex:1"><div class="${i.done?'done':''}">${esc(i.text)}</div>${i.note?`<div class="task-note">${esc(i.note)}</div>`:''}</div><button class="icon-btn" onclick='editChecklistItem(${cid},${iid})'>Edit</button></div>`}).join('')||'<div class="empty">No items yet.</div>'}</div><div class="detail-card"><div class="section-tools"><h3>Evidence / Supporting Files</h3><button class="icon-btn" onclick='chooseAttachments("checklist",${cid})'>+ Upload</button></div><div class="attach-drop" onclick='chooseAttachments("checklist",${cid})' ondragover="event.preventDefault()" ondrop='handleEntityDrop(event,"checklist",${cid})'>Attach photos, screenshots or reference files for this checklist</div><div id="attachments-checklist-${esc(c.id)}"></div></div></div><div><div class="detail-card"><div class="section-tools"><h3>Checklist Details</h3><button class="icon-btn" onclick='openChecklistModal(${cid})'>Edit</button></div><label>Purpose</label><div class="detail-text">${esc(c.purpose||'—')}</div><div class="detail-section"><label>Notes</label><div class="detail-text">${esc(c.notes||'—')}</div></div></div>${pr?`<div class="detail-card"><h3>Linked Project</h3><div class="kv click-row" onclick="openProjectDetail(${pr.id})"><span>${esc(pr.title)}</span>${pill(pr.status)}</div></div>`:''}</div></div>`,true);
  renderAttachments('checklist',c.id);
}
function addChecklistItem(cid){
  const c=checklistById(cid);if(!c)return;const q=checklistJsId(c.id);
  openModal(`${modalHeader('Add Checklist Item',c.name)}<div class="form-grid"><div class="full"><label>Item</label><input id="ckiText"></div>${textareaField('Item note / acceptance detail','ckiNote','')}</div><div class="modal-actions"><button class="btn secondary" onclick='openChecklistDetail(${q})'>Cancel</button><button class="btn primary" onclick='saveChecklistItem(${q},null)'>Add Item</button></div>`);
}
function editChecklistItem(cid,iid){
  const c=checklistById(cid),i=checklistItemById(c,iid);if(!i)return;
  const qc=checklistJsId(c.id),qi=checklistJsId(i.id);
  openModal(`${modalHeader('Edit Checklist Item',c.name)}<div class="form-grid"><div class="full"><label>Item</label><input id="ckiText" value="${esc(i.text)}"></div>${textareaField('Item note / acceptance detail','ckiNote',i.note||'')}</div><div class="modal-actions"><button class="btn secondary" onclick='openChecklistDetail(${qc})'>Cancel</button><button class="btn danger" onclick='deleteChecklistItem(${qc},${qi})'>Delete</button><button class="btn primary" onclick='saveChecklistItem(${qc},${qi})'>Save Item</button></div>`);
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
  i.done=done;saveDB();
  if(currentDetail?.type==='checklist'&&String(currentDetail.id)===String(c.id))openChecklistDetail(c.id);
}
function deleteChecklistItem(cid,iid){
  const c=checklistById(cid);if(!c||!confirm('Delete this checklist item?'))return;
  c.items=c.items.filter(x=>String(x.id)!==String(iid));
  saveDB('Checklist item deleted.');openChecklistDetail(c.id);
}


function toggleChecklistItemByDataset(_el,cid,iid){
  toggleChecklistItem(cid,iid,!!_el.checked);
}

if(!window.__n594zsChecklistDelegationBound){
  window.__n594zsChecklistDelegationBound=true;
  document.addEventListener('click',event=>{
    if(event.target.closest('input,button,a,select,textarea,label'))return;
    const card=event.target.closest('.checklist[data-checklist-id]');
    if(!card)return;
    openChecklistDetail(card.dataset.checklistId);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const card=event.target.closest('.checklist[data-checklist-id]');
    if(!card)return;
    event.preventDefault();
    openChecklistDetail(card.dataset.checklistId);
  });
}
