// ---------- CHECKLISTS ----------
// Canonical checklist implementation. Supports numeric legacy IDs and UUID IDs natively.
// Specialized checklist types (currently Annual Inspection) are dispatched explicitly.

function checklistItemById(c,id){return c?.items?.find(x=>String(x.id)===String(id))||null}
function isAnnualInspectionChecklist(c){return !!c?.inspectionMode&&Number(c.id)===503}
function checklistSourceDocs(c){
  const ids=[c?.sourceDocumentId,c?.documentId,...arr(c?.sourceDocumentIds)].filter(x=>x!==null&&x!==undefined&&x!=='');
  const seen=new Set();
  return ids.filter(id=>{const k=String(id);if(seen.has(k))return false;seen.add(k);return true})
    .map(id=>typeof docById==='function'?docById(id):null).filter(Boolean);
}
function checklistItemSourceDoc(c,i){
  const id=i?.sourceDocumentId||c?.sourceDocumentId||c?.documentId||null;
  return id!==null&&id!==undefined&&typeof docById==='function'?docById(id):null;
}
function checklistReadinessGateLabel(gate){
  return {'first-start':'Before First Start','full-power':'Before Full-Power','flight':'Before Flight'}[String(gate||'')]||'';
}

function checklistSystemName(c){
  if(typeof window.systemRecordMatches==='function'&&typeof window.systemNames==='function'){
    const direct=String(c?.system||'').trim();
    if(direct)return direct;
  }
  return String(c?.system||'').trim();
}
function checklistSystemOptions(selected=''){
  const names=typeof window.systemNames==='function'
    ? window.systemNames()
    : [...new Set(db.checklists.map(c=>checklistSystemName(c)).filter(Boolean))].sort();
  return '<option value="">All systems</option>'+names.map(n=>'<option value="'+esc(n)+'" '+(String(n)===String(selected)?'selected':'')+'>'+esc(n)+'</option>').join('');
}
function renderChecklists(){
  const page=document.getElementById('page-checklists');if(!page)return;
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>Checklists</h1><div class="muted">Procedures grouped by aircraft system.</div></div><button class="btn primary" id="checklistNewBtn">+ New Checklist</button></div>
    <div class="controls"><input id="checklistSearch" placeholder="Search checklists…"><select id="checklistSystem">${checklistSystemOptions('')}</select></div>
    <div id="checklistRows"></div>
  </div>`;
  document.getElementById('checklistNewBtn')?.addEventListener('click',()=>openChecklistModal());
  document.getElementById('checklistSearch')?.addEventListener('input',renderChecklistRows);
  document.getElementById('checklistSystem')?.addEventListener('change',renderChecklistRows);
  renderChecklistRows();
}
function renderChecklistRows(){
  const box=document.getElementById('checklistRows');if(!box)return;
  const q=String(document.getElementById('checklistSearch')?.value||'').trim().toLowerCase();
  const sys=String(document.getElementById('checklistSystem')?.value||'');
  const rows=db.checklists.filter(c=>{
    const hay=[c.name,c.purpose,c.trigger,c.system,c.notes,...((Array.isArray(c.items)?c.items:[]).map(i=>[i.text,i.note].join(' ')))].join(' ').toLowerCase();
    const systemMatch=!sys||(typeof window.systemRecordMatches==='function'?window.systemRecordMatches(c,sys,'checklists'):String(c.system||'')===sys);
    return (!q||hay.includes(q))&&systemMatch;
  });
  box.innerHTML=rows.map(c=>{
    const items=Array.isArray(c.items)?c.items:[];
    const isManual=c.kitfoxManualPack==='kitfox-912-64825-000-dec2001';
    const na=isManual?items.filter(i=>i.reviewStatus==='N/A').length:0;
    const verified=isManual?items.filter(i=>i.reviewStatus==='Verified').length:items.filter(i=>i.done).length;
    const done=verified+(isManual?na:0),
      pct=items.length?Math.round(done/items.length*100):0;
    const inspectionMeta=c.inspectionMode?`<div class="task-meta"><span class="mini-badge">${esc(c.sourcePages?'POH '+c.sourcePages:'Source-backed')}</span>${Array.isArray(c.groupOrder)&&c.groupOrder.length?`<span class="mini-badge">${c.groupOrder.length} groups</span>`:''}<span class="mini-badge">click items for history & notes</span></div>`:'';
    const manualMeta=c.kitfoxManualPack==='kitfox-912-64825-000-dec2001'
      ?`<div class="task-meta"><span class="mini-badge">SkyStar 912 manual • Section ${esc(c.manualChapter)}</span><span class="mini-badge">p.${esc(c.sourcePages||'')}</span><span class="mini-badge">click to review steps, N/A and notes</span></div>`:'';
    const sourceMeta=!manualMeta&&(c.rotaxSourceManaged||c.sourceBacked||c.commissioningPack)
      ?`<div class="task-meta"><span class="mini-badge">${c.rotaxSourceManaged?'ROTAX source-backed':'Source-backed'}</span>${c.sourcePack?`<span class="mini-badge">commissioning pack</span>`:''}<span class="mini-badge">source details inside</span></div>`:'';
    const readinessMeta=c.commissioningReadinessPack?(()=>{
      const counts={'first-start':0,'full-power':0,'flight':0};
      items.forEach(i=>{if(Object.prototype.hasOwnProperty.call(counts,i.requiredBefore))counts[i.requiredBefore]++});
      return `<div class="task-meta"><span class="mini-badge">${counts['first-start']} before start</span><span class="mini-badge">${counts['full-power']} before full-power</span><span class="mini-badge">${counts.flight} before flight</span></div>`;
    })():'';
    return `<div class="checklist click-row" role="button" tabindex="0" data-checklist-id="${esc(String(c.id))}">
      <div class="check-head"><div><b>${esc(c.name)}</b><span class="badge-count">${done}/${items.length}</span><div class="task-note">${esc(checklistSystemName(c)||'Unassigned')} • ${esc(c.trigger||c.purpose)}</div>${inspectionMeta}${manualMeta}${sourceMeta}${readinessMeta}</div>
      <div style="min-width:150px"><div class="progress"><div style="width:${pct}%"></div></div><div class="tiny muted right">${pct}%</div></div></div>
    </div>`;
  }).join('')||'<div class="empty">No matching checklists.</div>';

  box.querySelectorAll('.checklist[data-checklist-id]').forEach(card=>{
    const open=()=>openChecklistDetail(card.dataset.checklistId);
    card.addEventListener('click',open);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  });
}
window.renderChecklistRows=renderChecklistRows;

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
  if(existing){
    trackerStore.update('checklist',id,draft=>Object.assign(draft,o),{message:'Checklist updated.'});
  }else{
    const newId=uid();
    trackerStore.write('checklist',newId,{id:newId,...o,items:[]},{message:'Checklist created.'});
  }
  closeModal();
}
function deleteChecklist(id){
  if(!confirm('Delete this checklist?'))return;
  trackerStore.remove('checklist',id,{message:'Checklist deleted.'});
  closeModal();
}

function openChecklistDetail(id){
  const c=checklistById(id);
  if(!c){toast('Checklist record could not be found.','bad');return}
  if(isAnnualInspectionChecklist(c)&&typeof window.openAnnualInspectionChecklist==='function')return window.openAnnualInspectionChecklist(c.id);
  if(c.kitfoxManualPack==='kitfox-912-64825-000-dec2001'&&typeof window.openKitfox912ManualChecklist==='function')return window.openKitfox912ManualChecklist(c.id);

  const items=arr(c.items),done=items.filter(i=>i.done).length,pct=items.length?Math.round(done/items.length*100):0;
  const pr=c.projectId?projectById(Number(c.projectId)):null;
  const sourceDocs=checklistSourceDocs(c);
  const sourceDoc=sourceDocs[0]||null;
  currentDetail={type:'checklist',id:c.id};

  openModal(`${modalHeader(c.name,c.trigger||c.purpose)}
    <div class="summary-strip"><div class="summary-cell"><div class="lab">Progress</div><div class="val">${pct}%</div></div><div class="summary-cell"><div class="lab">Complete</div><div class="val">${done}/${items.length}</div></div><div class="summary-cell"><div class="lab">System</div><div class="val">${esc(c.system||'—')}</div></div><div class="summary-cell"><div class="lab">Project</div><div class="val">${esc(pr?.title||'—')}</div></div></div>
    <div class="detail-grid"><div>
      <div class="detail-card"><div class="section-tools"><h3>Checklist Items</h3><button class="icon-btn" id="ckDetailAdd">+ Item</button></div>
        ${items.map(i=>{
          const itemDoc=checklistItemSourceDoc(c,i);
          const gateLabel=checklistReadinessGateLabel(i.requiredBefore);
          const meta=[
            gateLabel?`<span class="mini-badge warn">${esc(gateLabel)}</span>`:'',
            i.group?`<span class="mini-badge">${esc(i.group)}</span>`:'',
            itemDoc?`<span class="mini-badge">${esc(itemDoc.name)}</span>`:'',
            i.sourcePage?`<span class="mini-badge">${esc(i.sourcePage)}</span>`:'',
            i.sourceSection?`<span class="mini-badge">${esc(i.sourceSection)}</span>`:''
          ].filter(Boolean).join('');
          return `<div class="check-item"><input type="checkbox" data-detail-check data-item-id="${esc(String(i.id))}" ${i.done?'checked':''}><div style="flex:1"><div class="${i.done?'done':''}">${esc(i.text)}</div>${meta?`<div class="task-meta" style="margin-top:5px">${meta}</div>`:''}${i.moreInfo?`<div class="task-note" style="margin-top:5px">${esc(i.moreInfo)}</div>`:''}${i.note?`<div class="task-note" style="margin-top:5px"><b>Review note:</b> ${esc(i.note)}</div>`:''}</div><div class="action-row" style="gap:5px;flex-wrap:wrap">${itemDoc?`<button class="icon-btn" data-detail-source data-item-id="${esc(String(i.id))}">Source</button>`:''}<button class="icon-btn" data-detail-edit data-item-id="${esc(String(i.id))}">Edit</button></div></div>`;
        }).join('')||'<div class="empty">No items yet.</div>'}
      </div>
      <div class="detail-card"><div class="section-tools"><h3>Evidence / Supporting Files</h3><button class="icon-btn" id="ckUpload">+ Upload</button></div><div class="attach-drop" id="ckDrop">Attach photos, screenshots or reference files for this checklist</div><div id="attachments-checklist-${esc(String(c.id))}"></div></div>
    </div><div>
      <div class="detail-card"><div class="section-tools"><h3>Checklist Details</h3><button class="icon-btn" id="ckDetailEdit">Edit</button></div><label>Purpose</label><div class="detail-text">${esc(c.purpose||'—')}</div><div class="detail-section"><label>Notes / Source</label><div class="detail-text">${esc(c.notes||'—')}</div></div></div>
      ${sourceDocs.length?`<div class="detail-card"><h3>Source Documents</h3><div class="muted small" style="margin-bottom:8px">Manufacturer references used by this checklist. Item-level Source buttons open the attached PDF at the cited page when available; otherwise they open the manufacturer source or Document record.</div>${sourceDocs.map(d=>`<div class="kv click-row" data-ck-source-doc="${esc(String(d.id))}"><span>${esc(d.name)}</span><b>${esc(d.revision||d.issueDate||'Open')}</b></div>`).join('')}</div>`:''}
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
  box?.querySelectorAll('[data-ck-source-doc]').forEach(el=>el.addEventListener('click',()=>openDocumentDetail(el.dataset.ckSourceDoc)));
  box?.querySelector('#ckLinkedProject')?.addEventListener('click',()=>openProjectDetail(pr.id));
  box?.querySelectorAll('[data-detail-check]').forEach(el=>el.addEventListener('change',e=>toggleChecklistItem(c.id,el.dataset.itemId,e.target.checked)));
  box?.querySelectorAll('[data-detail-source]').forEach(el=>el.addEventListener('click',async()=>{
    const item=checklistItemById(c,el.dataset.itemId),doc=checklistItemSourceDoc(c,item);
    if(!doc)return;
    if(typeof openSourceReference==='function'){
      await openSourceReference(doc,item?.sourcePage||'',{fallbackToDocument:true});
      return;
    }
    openDocumentDetail(doc.id);
  }));
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
  const hasItem=iid!==null&&iid!==undefined&&iid!==''&&!!checklistItemById(c,iid);
  const newItemId=hasItem?null:uid();
  trackerStore.update('checklist',cid,draft=>{
    draft.items=arr(draft.items);
    const item=hasItem?checklistItemById(draft,iid):null;
    if(item)Object.assign(item,{text,note});
    else draft.items.push({id:newItemId,text,note,done:false});
  },{message:'Checklist item saved.'});
  openChecklistDetail(cid);
}
function toggleChecklistItem(cid,iid,done){
  const c=checklistById(cid),i=checklistItemById(c,iid);if(!i)return;
  const modalBox=document.getElementById('modalBox');
  const priorScrollTop=modalBox?.scrollTop||0;

  trackerStore.update('checklist',cid,draft=>{
    const item=checklistItemById(draft,iid);if(item)item.done=!!done;
  });

  if(currentDetail?.type==='checklist'&&String(currentDetail.id)===String(cid)){
    openChecklistDetail(cid);
    const restoreScroll=()=>{
      const refreshedBox=document.getElementById('modalBox');
      if(refreshedBox)refreshedBox.scrollTop=priorScrollTop;
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(restoreScroll);
    else setTimeout(restoreScroll,0);
  }
}
function deleteChecklistItem(cid,iid){
  const c=checklistById(cid);if(!c||!confirm('Delete this checklist item?'))return;
  trackerStore.update('checklist',cid,draft=>{
    draft.items=arr(draft.items).filter(x=>String(x.id)!==String(iid));
  },{message:'Checklist item deleted.'});
  openChecklistDetail(cid);
}
