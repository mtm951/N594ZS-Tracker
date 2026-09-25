// ---------- PROJECTS ----------
function openProjectModal(id=null){
  const p=id?projectById(id):{title:'',system:'',priority:'Medium',status:'Open',trigger:'',percent:0,summary:'',plan:'',nextStep:'',blockers:''};
  openModal(`${modalHeader(id?'Edit Project':'New Project')}<div class="form-grid">
    <div class="full"><label>Project title</label><input id="prTitle" value="${esc(p.title)}"></div>
    <div><label>System</label><select id="prSystem">${systemOptions(p.system)}</select></div>
    <div><label>Priority</label><select id="prPriority">${['High','Medium','Low'].map(x=>`<option ${p.priority===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div><label>Status</label><select id="prStatus">${['Open','In Progress','Blocked','Done'].map(x=>`<option ${p.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
    ${field('Progress %','prPercent',p.percent,'number','min="0" max="100"')}
    <div class="full"><label>Due / trigger</label><input id="prTrigger" value="${esc(p.trigger)}"></div>
    ${textareaField('Summary','prSummary',p.summary)}${textareaField('Plan / notes','prPlan',p.plan)}${textareaField('Additional older blocker note (optional; new blockers belong under Project Blockers)','prBlockers',p.blockers)}${textareaField('Next step','prNext',p.nextStep)}
  </div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button>${id?`<button class="btn danger" onclick="deleteProject(${id})">Delete</button>`:''}<button class="btn primary" onclick="saveProject(${id||'null'})">Save Project</button></div>`);
}
function saveProject(id){
  const o={title:val('prTitle'),system:val('prSystem')||'General',priority:val('prPriority'),status:val('prStatus'),trigger:val('prTrigger'),percent:Math.max(0,Math.min(100,num(val('prPercent')))),summary:val('prSummary'),plan:val('prPlan'),blockers:val('prBlockers'),nextStep:val('prNext')};
  // Store the selected canonical Readiness stage with the trigger in the
  // SAME Project write. app-20 still supplies the remaining workflow fields,
  // but a cross-device reader must never receive a new trigger and old phase.
  const stage=document.getElementById('prPhase')?.value;
  if(['build','engine-start','ground','flight','rts','later'].includes(stage))o.phase=stage;
  if(!o.title)return alert('Project title is required.');
  const current=id?projectById(id):null;
  if(id&&o.status==='Done'&&current&&current.status!=='Done'){
    openProjectCloseoutReview(id,o);
    return;
  }
  if(o.status==='Done')o.percent=100;
  closeModal();
  if(id){
    trackerStore.update('project',id,draft=>Object.assign(draft,o),{message:'Project updated.'});
  }else{
    const newId=uid();
    trackerStore.write('project',newId,{id:newId,...o,partsUsed:[],updates:[]},{message:'Project created.'});
  }
}
function deleteProject(id){if(!confirm('Delete this project? Linked parts, orders, logs and documents will remain but may show as unlinked.'))return;db.projects=db.projects.filter(x=>x.id!==id);db.orders.forEach(o=>{const remaining=orderProjectIds(o).filter(pid=>pid!==Number(id));o.projectId=remaining[0]??null;o.linkedProjectIds=remaining.slice(1)});db.logs.forEach(l=>{l.projectIds=l.projectIds.filter(x=>x!==id)});db.docs.forEach(d=>{d.linkedProjectIds=d.linkedProjectIds.filter(x=>x!==id)});db.parts.forEach(p=>{p.linkedProjectIds=p.linkedProjectIds.filter(x=>x!==id)});db.checklists.forEach(c=>{if(c.projectId===id)c.projectId=null});closeModal();saveDB('Project deleted.');}

let pendingProjectCompletion=null;
function projectCloseoutAudit(project){
  if(!project)return {issues:[],warnings:[],review:[],ready:true};
  const id=Number(project.id),issues=[];
  const add=(severity,label,detail)=>issues.push({severity,label,detail});
  const steps=arr(project.steps),unfinishedSteps=steps.filter(x=>!x.done);
  const reservations=arr(project.plannedParts).filter(x=>num(x.qty)>0);
  const orders=arr(db.orders).filter(o=>orderLinkedToProject(o,id)&&!isClosedOrder(o));
  const checks=arr(db.checklists).filter(c=>Number(c.projectId)===id);
  const incompleteChecks=checks.filter(ch=>arr(ch.items).some(i=>!i.done));
  const logs=arr(db.logs).filter(l=>arr(l.projectIds).some(pid=>Number(pid)===id));
  const reservedIds=new Set(reservations.filter(x=>x.partId).map(x=>Number(x.partId)));
  const usedIds=new Set(arr(project.partsUsed).filter(x=>x.partId).map(x=>Number(x.partId)));
  const assigned=arr(db.parts).filter(part=>arr(part.linkedProjectIds).some(pid=>Number(pid)===id)&&!reservedIds.has(Number(part.id))&&!usedIds.has(Number(part.id)));

  if(unfinishedSteps.length)add('warning','Unfinished project steps',unfinishedSteps.length+' of '+steps.length+' step'+(steps.length===1?'':'s')+' remain incomplete.');
  if(reservations.length)add('warning','Reserved parts still outstanding',reservations.length+' reservation'+(reservations.length===1?'':'s')+' should be used, released, or intentionally left reserved.');
  if(orders.length)add('warning','Open orders remain',orders.length+' linked order'+(orders.length===1?' is':'s are')+' still open.');
  if(incompleteChecks.length)add('warning','Incomplete linked checklists',incompleteChecks.length+' linked checklist'+(incompleteChecks.length===1?' has':'s have')+' unfinished items.');
  if(String(project.blockers||'').trim())add('warning','Project still has a blocker',String(project.blockers).trim());
  if(assigned.length)add('review','Assigned parts not recorded as used',assigned.length+' assigned part'+(assigned.length===1?' is':'s are')+' still related to this project without a reservation or use record.');
  if(!logs.length)add('review','No work-log entry linked','Consider recording what was actually done before closing the project.');
  if(!String(project.completionCriteria||'').trim())add('review','No completion criteria recorded','The project can still be closed, but there is no saved definition-of-done statement.');
  if(!steps.length&&num(project.percent)<100)add('review','Progress is below 100%',Math.round(num(project.percent))+'% is currently recorded; closing the project will set it to 100%.');

  const warnings=issues.filter(x=>x.severity==='warning'),review=issues.filter(x=>x.severity==='review');
  return {issues,warnings,review,ready:warnings.length===0};
}
window.projectCloseoutAudit=projectCloseoutAudit;

function projectCloseoutSummaryHTML(project){
  const a=projectCloseoutAudit(project);
  const state=project.status==='Done'?'Completed':a.ready?'Ready to close':a.warnings.length+' warning'+(a.warnings.length===1?'':'s');
  const detail=a.issues.length
    ?a.issues.slice(0,3).map(x=>esc(x.label)).join(' • ')+(a.issues.length>3?' • +'+(a.issues.length-3)+' more':'')
    :'No open closeout items detected.';
  return `<div class="detail-card project-closeout-card"><div class="section-tools"><div><h3>Closeout Readiness</h3><div class="tiny muted">Checks tasks, reservations, orders, checklists, blockers and work history before completion.</div></div><button class="icon-btn" onclick="openProjectCloseoutReview(${project.id})">Review</button></div><div class="kv"><span>Status</span><b>${pill(state)}</b></div><div class="task-note" style="margin-top:8px">${detail}</div></div>`;
}

window.openProjectCloseoutReview=function(id,pending=null){
  const base=projectById(Number(id));if(!base)return;
  pendingProjectCompletion={id:Number(id),pending:pending?{...pending}:null};
  const view=pending?{...base,...pending,id:base.id}:base;
  const a=projectCloseoutAudit(view);
  const rows=a.issues.map(x=>`<div class="project-closeout-row ${x.severity}"><span class="project-closeout-dot">${x.severity==='warning'?'!':'i'}</span><div><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div></div>`).join('');
  openModal(`${modalHeader('Project Closeout',view.title)}
    <div class="${a.ready?'notice':'warning'}"><b>${a.ready?'No blocking closeout warnings found.':a.warnings.length+' closeout warning'+(a.warnings.length===1?' needs':'s need')+' review.'}</b><br>This check never prevents you from closing the project. It makes unfinished relationships visible first.</div>
    <div class="summary-strip" style="margin:12px 0"><div class="summary-cell"><div class="lab">Warnings</div><div class="val">${a.warnings.length}</div></div><div class="summary-cell"><div class="lab">Review items</div><div class="val">${a.review.length}</div></div><div class="summary-cell"><div class="lab">Result</div><div class="val">${a.ready?'Ready':'Review'}</div></div></div>
    <div class="detail-card project-closeout-list"><div class="section-tools"><h3>Closeout Check</h3></div>${rows||'<div class="empty">No unfinished steps, reservations, open orders, incomplete linked checklists or blockers were found.</div>'}</div>
    <div class="modal-actions"><button class="secondary" onclick="pendingProjectCompletion=null;openProjectDetail(${base.id})">Back to Project</button><button class="primary" onclick="finalizeProjectDone(${base.id})">${a.ready?'Complete Project':'Mark Done Anyway'}</button></div>`,true);
};

window.finalizeProjectDone=function(id){
  const p=projectById(Number(id));if(!p)return;
  const pending=pendingProjectCompletion&&Number(pendingProjectCompletion.id)===Number(id)?pendingProjectCompletion.pending:null;
  if(pending)Object.assign(p,pending);
  const a=projectCloseoutAudit(p);
  p.status='Done';p.percent=100;
  p.updates=arr(p.updates);
  p.updates.push({id:uid(),date:today(),text:a.warnings.length
    ?'Project marked Done after closeout review; '+a.warnings.length+' warning'+(a.warnings.length===1?' was':'s were')+' acknowledged.'
    :'Project marked Done after closeout review.'});
  pendingProjectCompletion=null;
  saveDB('Project completed after closeout review.');
  openProjectDetail(p.id);
};

if(!document.getElementById('projectCloseoutStyle')){
  const s=document.createElement('style');s.id='projectCloseoutStyle';s.textContent=`
    .project-closeout-list{padding:0!important;overflow:hidden}.project-closeout-list>.section-tools{padding:12px 14px;border-bottom:1px solid var(--line)}
    .project-closeout-row{display:grid;grid-template-columns:28px minmax(0,1fr);gap:9px;align-items:start;padding:10px 14px;border-bottom:1px solid #edf1f4}.project-closeout-row:last-child{border-bottom:0}
    .project-closeout-dot{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:900}.project-closeout-row.warning .project-closeout-dot{background:#fde8e6;color:#9a3f38}.project-closeout-row.review .project-closeout-dot{background:#fff2cf;color:#806018}
    .project-closeout-row b{display:block;font-size:11px}.project-closeout-row small{display:block;color:var(--muted);font-size:10px;line-height:1.35;margin-top:3px}
  `;document.head.appendChild(s);
}

function openProjectDetail(id){
  const p=projectById(id);if(!p)return;currentDetail={type:'project',id};
  const logs=db.logs.filter(l=>l.projectIds.includes(id)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const orders=db.orders.filter(o=>orderLinkedToProject(o,id));
  const docs=db.docs.filter(d=>d.linkedProjectIds.includes(id));
  const checks=db.checklists.filter(c=>c.projectId===id);
  const openOrders=orders.filter(o=>!isClosedOrder(o));
  const closeout=projectCloseoutAudit(p);
  const detail=`${modalHeader(p.title,`${p.system} • ${p.trigger||'No trigger set'}`)}
    <div class="summary-strip"><div class="summary-cell"><div class="lab">Status</div><div class="val">${pill(p.status)}</div></div><div class="summary-cell"><div class="lab">Priority</div><div class="val">${pill(p.priority)}</div></div><div class="summary-cell"><div class="lab">Progress</div><div class="val">${p.percent}%</div></div><div class="summary-cell"><div class="lab">Tracked cost</div><div class="val">${db.settings.showCosts?fmtMoney(projectCost(p)):'Hidden'}</div></div></div>
    <div class="detail-grid"><div>
      <div class="detail-card"><div class="section-tools"><h3>Project Overview</h3><button class="icon-btn" onclick="openProjectModal(${id})">Edit</button></div><div class="detail-text"><b>Summary</b>\n${esc(p.summary||'—')}\n\n<b>Plan / Notes</b>\n${esc(p.plan||'—')}</div></div>
      <div class="detail-card"><div class="section-tools"><h3>Parts Used</h3><button class="icon-btn" onclick="addProjectPart(${id})">+ Part Used</button></div>${p.partsUsed.length?`<div class="table-wrap"><table class="subtable"><thead><tr><th>Part</th><th>Qty</th><th>Unit cost</th><th>Notes</th><th></th></tr></thead><tbody>${p.partsUsed.map(x=>`<tr><td>${x.partId?`<button class="linkbtn" onclick="openPartDetail(${x.partId})">${esc(x.name||partName(x.partId))}</button>`:esc(x.name)}</td><td>${esc(x.qty)} ${esc(x.unit||'')}</td><td>${db.settings.showCosts?fmtMoney(x.unitCost):'Hidden'}</td><td>${esc(x.notes||'')}</td><td><button class="icon-btn" onclick="removeProjectPart(${id},${x.id})">✕</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No parts recorded for this project.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Work History</h3><button class="icon-btn" onclick="openLogModal(null,${id})">+ Work Entry</button></div>${logs.length?logs.map(l=>`<div class="kv click-row" onclick="openLogDetail(${l.id})"><div><b>${esc(l.date)} • ${esc(l.work)}</b><div class="task-note">${esc(l.blockers?`Held up: ${l.blockers}`:`Next: ${l.nextStep||'—'}`)}</div></div><span>${db.settings.showCosts?fmtMoney(consumedCost(l)):''}</span></div>`).join(''):'<div class="empty">No work entries linked yet.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Relevant Documents</h3><button class="icon-btn" onclick="linkDocumentToProject(${id})">+ Link Document</button></div>${docs.length?docs.map(d=>`<div class="kv click-row" onclick="openDocumentDetail(${d.id})"><div><b>${esc(d.name)}</b><div class="task-note">${esc(d.type)}${d.revision?' • Rev '+esc(d.revision):''}</div></div><span>Open</span></div>`).join(''):'<div class="empty">No linked documents.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Files / Screenshots / Photos</h3><button class="icon-btn" onclick="chooseAttachments('project',${id})">+ Upload</button></div><div class="attach-drop" onclick="chooseAttachments('project',${id})" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,'project',${id})">Drop screenshots, photos, PDFs, receipts or reference files here</div><div id="attachments-project-${id}"></div></div>
    </div><div>
      <div class="detail-card"><h3>Next Step</h3><div class="detail-text">${esc(p.nextStep||'No next step recorded.')}</div></div>
      <div class="detail-card"><h3>Blocker / What Is Holding It Up</h3>${p.blockers?`<div class="danger-note">${esc(p.blockers)}</div>`:'<div class="muted">No blocker recorded.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Orders / Things to Buy</h3><button class="icon-btn" onclick="openOrderModal(null,${id})">+ Order</button></div>${orders.length?orders.map(o=>`<div class="kv click-row" onclick="openOrderDetail(${o.id})"><div><b>${esc(o.item)}</b><div class="task-note">${esc(o.vendor||'')} ${o.eta?'• ETA '+esc(o.eta):''}${Number(o.projectId)===Number(id)?'':' • Shared order'}</div></div><div>${pill(o.status)}<div class="tiny right">${db.settings.showCosts?fmtMoney(orderTotal(o)):''}</div></div></div>`).join(''):'<div class="empty">Nothing recorded to order.</div>'}${openOrders.length?`<div class="tiny muted" style="margin-top:8px">${openOrders.length} order${openOrders.length===1?'':'s'} still open.</div>`:''}</div>
      <div class="detail-card"><h3>Linked Checklists</h3>${checks.length?checks.map(c=>`<div class="kv click-row" onclick="openChecklistDetail(${c.id})"><span>${esc(c.name)}</span><b>${c.items.filter(i=>i.done).length}/${c.items.length}</b></div>`).join(''):'<div class="muted">No checklist linked.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Project Updates</h3><button class="icon-btn" onclick="addEntityUpdate('project',${id})">+ Update</button></div>${p.updates.length?`<div class="timeline">${[...p.updates].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(u=>`<div class="timeline-item"><div class="timeline-date">${esc(u.date||'')}</div><div class="timeline-body">${esc(u.text||'')}</div></div>`).join('')}</div>`:'<div class="muted">No updates yet.</div>'}</div>
      ${projectCloseoutSummaryHTML(p)}
      <div class="detail-card"><div class="action-row"><button class="btn secondary" onclick="openProjectModal(${id})">Edit Project</button><button class="btn ${p.status==='Done'?'secondary':'success'}" onclick="toggleProjectDone(${id})">${p.status==='Done'?'Reopen':'Mark Done'}</button></div></div>
    </div></div>`;
  openModal(detail,true);renderAttachments('project',id);
}
function toggleProjectDone(id){
  const p=projectById(id);if(!p)return;
  if(p.status==='Done'){
    p.status='Open';p.percent=Math.min(p.percent,95);
    saveDB('Project reopened.');openProjectDetail(id);return;
  }
  openProjectCloseoutReview(id);
}
function addProjectPart(projectId){
  const p=projectById(projectId);if(!p)return;
  openModal(`${modalHeader('Add Part Used',p.title)}<div class="form-grid"><div class="full"><label>Inventory part (optional)</label><select id="ppuPart" onchange="prefillProjectPart()">${partOptions(null)}</select></div>${field('Part / material name','ppuName','')}${field('Quantity','ppuQty','1','number','step="any"')}${field('Unit','ppuUnit','ea')}${field('Unit cost','ppuCost','', 'number','step="0.01" min="0"')}${textareaField('Notes','ppuNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openProjectDetail(${projectId})">Cancel</button><button class="btn primary" onclick="saveProjectPart(${projectId})">Add Part</button></div>`);
}
function prefillProjectPart(){const id=selectedNumber('ppuPart'),p=partById(id);if(!p)return;document.getElementById('ppuName').value=p.name;document.getElementById('ppuUnit').value=p.unit||'ea';document.getElementById('ppuCost').value=p.unitCost??''}
function saveProjectPart(projectId){
  const p=projectById(projectId);if(!p)return;
  const partId=selectedNumber('ppuPart'),name=val('ppuName')||(partId?partName(partId):'');
  if(!name)return alert('Part name is required.');
  const qty=num(val('ppuQty'))||1,unit=val('ppuUnit')||'ea',unitCost=val('ppuCost'),notes=val('ppuNotes');
  const projectPartId=uid();
  const record={id:projectPartId,partId,name,qty,unit,unitCost,notes};
  if(partId){
    const part=partById(partId);
    if(part&&typeof window.preparePartForPhysicalUse==='function')window.preparePartForPhysicalUse(part,qty);
    const on=part&&typeof partAvailable==='function'?partAvailable(part):null;
    if(on!==null&&qty>on&&!confirm('This use exceeds calculated physical inventory and will make the quantity negative. Record it anyway?'))return;
    const logId=uid(),consumedItemId=uid();
    record.logId=logId;record.consumedItemId=consumedItemId;record.consumptionRecorded=true;
    db.logs.push({
      id:logId,date:today(),airframeHours:'',engineHours:'',laborHours:'',system:p.system||part?.system||'General',projectIds:[p.id],
      work:`Used ${name} on ${p.title}`,observations:notes||'',blockers:'',nextStep:p.nextStep||'',
      consumedParts:[{id:consumedItemId,partId,name,qty,unit,unitCost,notes:'Recorded from Project → Parts Used.',projectPartId}],
      otherCost:'',notes:'Canonical physical inventory use created from the project Parts Used control.',origin:'project-part-use'
    });
    if(part&&!arr(part.linkedProjectIds).includes(projectId))part.linkedProjectIds.push(projectId);
  }
  p.partsUsed.push(record);
  saveDB(partId?'Part use recorded and inventory updated.':'Part/material added to project.');
  openProjectDetail(projectId);
}
function removeProjectPart(projectId,itemId){
  const p=projectById(projectId);if(!p)return;
  const item=arr(p.partsUsed).find(x=>String(x.id)===String(itemId));if(!item)return;
  const linkedConsumption=item.consumptionRecorded&&item.logId;
  const prompt=linkedConsumption?'Remove this part-use record? Its linked inventory-consumption entry will also be removed, returning the quantity to calculated on-hand inventory.':'Remove this part-use record from the project?';
  if(!confirm(prompt))return;
  if(linkedConsumption){
    const log=logById(Number(item.logId));
    if(log){
      log.consumedParts=arr(log.consumedParts).filter(x=>String(x.id)!==String(item.consumedItemId)&&String(x.projectPartId)!==String(item.id));
      if(log.origin==='project-part-use'&&!log.consumedParts.length)db.logs=db.logs.filter(x=>Number(x.id)!==Number(log.id));
    }
  }
  p.partsUsed=arr(p.partsUsed).filter(x=>String(x.id)!==String(itemId));
  saveDB(linkedConsumption?'Part use removed and inventory restored.':'Part-use record removed.');
  openProjectDetail(projectId);
}
function linkDocumentToProject(projectId){if(!db.docs.length)return openDocModal(null,projectId);openModal(`${modalHeader('Link Document',projectName(projectId))}<div><label>Existing document</label><select id="linkDocId">${selectOptions(db.docs.map(d=>({value:d.id,label:d.name})),null,'— Select document —')}</select></div><div class="modal-actions"><button class="btn secondary" onclick="openProjectDetail(${projectId})">Cancel</button><button class="btn secondary" onclick="openDocModal(null,${projectId})">Create New</button><button class="btn primary" onclick="saveDocumentLink(${projectId})">Link</button></div>`)}
function saveDocumentLink(projectId){const did=selectedNumber('linkDocId');if(!did)return alert('Choose a document.');const d=docById(did);if(!d.linkedProjectIds.includes(projectId))d.linkedProjectIds.push(projectId);saveDB('Document linked.');openProjectDetail(projectId)}
