// ---------- DOCUMENTS ----------
function docJsArg(id){return id===null||id===undefined?'null':JSON.stringify(String(id))}
function openDocModal(id=null,projectId=null){
  const existing=id!==null&&id!==undefined&&id!=='';
  const d=existing?docById(id):{name:'',type:'',revision:'',issueDate:'',system:'',publisher:'',location:'',notes:'',linkedProjectIds:projectId?[projectId]:[],linkedPartIds:[],linkedLogIds:[]};
  if(existing&&!d)return alert('Document record could not be found.');
  const idArg=docJsArg(id),projectArg=projectId===null||projectId===undefined?'null':JSON.stringify(projectId);
  openModal(`${modalHeader(existing?'Edit Document':'Add Document')}<div class="form-grid"><div class="full"><label>Document name</label><input id="dcName" value="${esc(d.name)}"></div>${field('Type','dcType',d.type)}${field('Revision','dcRevision',d.revision)}${field('Issue / revision date','dcIssue',d.issueDate,'date')}<div><label>System</label><select id="dcSystem">${systemOptions(d.system)}</select></div>${field('Publisher / source','dcPublisher',d.publisher)}<div class="full"><label>URL / file-location note</label><input id="dcLocation" value="${esc(d.location)}"></div>${textareaField('Notes / applicability','dcNotes',d.notes)}</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button>${existing?`<button class="btn danger" onclick='deleteDoc(${idArg})'>Delete</button>`:''}<button class="btn primary" onclick='saveDoc(${idArg},${projectArg})'>Save Document</button></div>`);
}
function saveDoc(id,projectId=null){
  const o={name:val('dcName'),type:val('dcType'),revision:val('dcRevision'),issueDate:val('dcIssue'),system:val('dcSystem'),publisher:val('dcPublisher'),location:val('dcLocation'),notes:val('dcNotes')};
  if(!o.name)return alert('Document name is required.');
  const existing=id!==null&&id!==undefined&&id!=='';
  if(existing){
    trackerStore.update('document',id,draft=>Object.assign(draft,o),{message:'Document updated.'});
  }else{
    const newId=uid();
    trackerStore.write('document',newId,{id:newId,...o,linkedProjectIds:projectId?[projectId]:[],linkedPartIds:[],linkedLogIds:[],updates:[]},{message:'Document added.'});
  }
  closeModal();
}
function deleteDoc(id){
  if(!confirm('Delete this document record?'))return;
  trackerStore.remove('document',id,{message:'Document deleted.'});
  closeModal();
}
function openDocumentDetail(id){
  const d=docById(id);if(!d)return;
  currentDetail={type:'document',id:d.id};
  const idArg=docJsArg(d.id);
  const projects=arr(d.linkedProjectIds).map(projectById).filter(Boolean),parts=arr(d.linkedPartIds).map(partById).filter(Boolean),logs=arr(d.linkedLogIds).map(logById).filter(Boolean);
  openModal(`${modalHeader(d.name,`${d.type||'Document'}${d.revision?' • Rev '+d.revision:''}`)}<div class="detail-grid"><div><div class="detail-card"><div class="section-tools"><h3>Document Record</h3><button class="icon-btn" onclick='openDocModal(${idArg})'>Edit</button></div><div class="grid"><div class="span-6"><div class="kv"><span>Type</span><b>${esc(d.type||'—')}</b></div><div class="kv"><span>System</span><b>${esc(d.system||'—')}</b></div><div class="kv"><span>Publisher / source</span><b>${esc(d.publisher||'—')}</b></div></div><div class="span-6"><div class="kv"><span>Revision</span><b>${esc(d.revision||'—')}</b></div><div class="kv"><span>Issue date</span><b>${esc(d.issueDate||'—')}</b></div><div class="kv"><span>Location</span><b>${esc(d.location||'—')}</b></div></div></div><div class="detail-section"><label>Notes / applicability</label><div class="detail-text">${esc(d.notes||'No notes.')}</div></div>${isURL(d.location)?`<button class="btn secondary" style="margin-top:10px" onclick="window.open('${esc(d.location)}','_blank')">Open Web Link</button>`:''}</div><div class="detail-card"><div class="section-tools"><h3>Attached File / Screenshots</h3><button class="icon-btn" data-doc-upload>+ Upload</button></div><div class="attach-drop" data-doc-drop>Attach the actual PDF, scan, screenshot, image or reference file here</div><div id="attachments-document-${esc(String(d.id))}"></div></div></div>
  <div><div class="detail-card"><h3>Linked Projects</h3>${projects.length?projects.map(p=>`<div class="kv click-row" onclick="openProjectDetail(${p.id})"><span>${esc(p.title)}</span>${pill(p.status)}</div>`).join(''):'<div class="muted">None linked.</div>'}</div><div class="detail-card"><h3>Linked Parts</h3>${parts.length?parts.map(p=>`<div class="kv click-row" onclick="openPartDetail(${p.id})"><span>${esc(p.name)}</span>${pill(p.status)}</div>`).join(''):'<div class="muted">None linked.</div>'}</div><div class="detail-card"><h3>Linked Work Entries</h3>${logs.length?logs.map(l=>`<div class="kv click-row" onclick="openLogDetail(${l.id})"><span>${esc(l.date)} • ${esc(l.work)}</span><span>Open</span></div>`).join(''):'<div class="muted">None linked.</div>'}</div><div class="detail-card"><div class="section-tools"><h3>Document Updates</h3><button class="icon-btn" data-doc-update>+ Update</button></div>${arr(d.updates).length?`<div class="timeline">${[...arr(d.updates)].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(u=>`<div class="timeline-item"><div class="timeline-date">${esc(u.date)}</div><div class="timeline-body">${esc(u.text)}</div></div>`).join('')}</div>`:'<div class="muted">No updates.</div>'}</div></div></div>`,true);
  const box=document.getElementById('modalBox');
  box?.querySelector('[data-doc-upload]')?.addEventListener('click',()=>chooseAttachments('document',d.id));
  const drop=box?.querySelector('[data-doc-drop]');
  if(drop){
    drop.addEventListener('click',()=>chooseAttachments('document',d.id));
    drop.addEventListener('dragover',e=>e.preventDefault());
    drop.addEventListener('drop',e=>handleEntityDrop(e,'document',d.id));
  }
  box?.querySelector('[data-doc-update]')?.addEventListener('click',()=>addEntityUpdate('document',d.id));
  renderAttachments('document',d.id);
}
