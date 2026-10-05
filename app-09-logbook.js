// ---------- WORK LOG ----------
// The pending atomic journal owns its staged Work Log until cloud acknowledgement.
// Block ordinary edits, deletes and consumed-item changes that would invalidate
// crash recovery; unrelated Work Logs stay editable.
function atomicWorkLogLocked(id){
  return id!=null&&window.atomicReceiptOutbox?.isPendingRecord?.('log',id)===true;
}
function atomicWorkLogEditGuard(id){
  if(!atomicWorkLogLocked(id))return false;
  alert('This Work Log belongs to a pending atomic transaction. Its edits and consumed-item changes are locked until it synchronizes. Go to System → Advanced / Troubleshooting → Inventory Transaction Safety to review the pending transaction or export its safety copy.');
  return true;
}
function openLogModal(id=null,projectId=null,partId=null){
  if(id!=null&&atomicWorkLogEditGuard(id))return;
  const l=id?logById(id):{date:today(),airframeHours:'',engineHours:'',laborHours:'',system:projectId?(projectById(projectId)?.system||''):'',projectIds:projectId?[projectId]:[],work:'',observations:'',blockers:'',nextStep:'',consumedParts:[],otherCost:'',notes:''};
  const selectedProjects=new Set(l.projectIds);
  openModal(`${modalHeader(id?'Edit Work Entry':'Add Work Entry')}<div class="form-grid">
    ${field('Date','lgDate',l.date,'date')}${field('Labor hours','lgLabor',l.laborHours,'number','step="0.1" min="0"')}
    ${field('Airframe hours','lgAirframe',l.airframeHours,'number','step="0.1" min="0"')}${field('Engine hours','lgEngine',l.engineHours,'number','step="0.1" min="0"')}
    <div><label>System</label><select id="lgSystem">${systemOptions(l.system)}</select></div>${field('Other / non-part cost','lgOtherCost',l.otherCost,'number','step="0.01" min="0"')}
    <div class="full"><label>Linked projects</label><div class="chip-select" id="lgProjectChoices">${db.projects.map(p=>`<label class="chip" style="text-transform:none;letter-spacing:0"><input style="width:auto" type="checkbox" value="${p.id}" ${selectedProjects.has(p.id)?'checked':''}> ${esc(p.title)}</label>`).join('')}</div></div>
    ${textareaField('Work performed','lgWork',l.work)}${textareaField('Measurements / observations / settings','lgObservations',l.observations)}${textareaField('What held up the work / blocker','lgBlockers',l.blockers)}${textareaField('Next step','lgNext',l.nextStep)}${textareaField('Additional notes','lgNotes',l.notes)}
  </div>${id?`<div class="notice" style="margin-top:12px">Parts/consumables are managed from the clickable work-entry detail view after saving.</div>`:''}<div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button>${id?`<button class="btn danger" onclick="deleteLog(${id})">Delete</button>`:''}<button class="btn primary" onclick="saveLog(${id||'null'},${partId||'null'})">Save Entry</button></div>`);
}
function saveLog(id,partId=null){
  if(id!=null&&atomicWorkLogEditGuard(id))return;
  const projectIds=[...document.querySelectorAll('#lgProjectChoices input:checked')].map(x=>Number(x.value));
  const o={date:val('lgDate'),airframeHours:val('lgAirframe'),engineHours:val('lgEngine'),laborHours:val('lgLabor'),system:val('lgSystem')||'General',projectIds,work:val('lgWork'),observations:val('lgObservations'),blockers:val('lgBlockers'),nextStep:val('lgNext'),otherCost:val('lgOtherCost'),notes:val('lgNotes')};
  if(!o.date||!o.work)return alert('Date and work performed are required.');
  let logId=id;
  if(id)Object.assign(logById(id),o);else{logId=uid();db.logs.push({id:logId,...o,consumedParts:[]})}
  closeModal();saveDB(id?'Work entry updated.':'Work entry added.');
  if(partId){openLogDetail(logId);setTimeout(()=>addConsumedPart(logId,partId),0)}
}
function deleteLog(id){if(atomicWorkLogEditGuard(id))return;if(!confirm('Delete this work-log entry?'))return;db.logs=db.logs.filter(x=>x.id!==id);db.docs.forEach(d=>{d.linkedLogIds=d.linkedLogIds.filter(x=>x!==id)});closeModal();saveDB('Work entry deleted.')}
function openLogDetail(id){
  const l=logById(id);if(!l)return;currentDetail={type:'log',id};
  const projects=l.projectIds.map(projectById).filter(Boolean),docs=db.docs.filter(d=>d.linkedLogIds.includes(id));
  const atomicLocked=atomicWorkLogLocked(id);
  openModal(`${modalHeader(`${l.date} • ${l.system}`,l.work)}
  ${atomicLocked?'<div class="danger-note"><b>This Work Log is protected by an unsynced atomic transaction.</b> Editing and consumed-item changes are locked until the transaction is acknowledged.<div class="action-row" style="margin-top:8px"><button class="secondary" onclick="atomicReceiptOutbox.openSettings()">Review / Retry Transaction</button></div></div>':''}
  <div class="summary-strip"><div class="summary-cell"><div class="lab">Labor</div><div class="val">${esc(l.laborHours||'—')} ${l.laborHours?'hr':''}</div></div><div class="summary-cell"><div class="lab">Airframe</div><div class="val">${esc(l.airframeHours||'—')}</div></div><div class="summary-cell"><div class="lab">Engine</div><div class="val">${esc(l.engineHours||'—')}</div></div><div class="summary-cell"><div class="lab">Consumed Cost</div><div class="val">${db.settings.showCosts?fmtMoney(consumedCost(l)):'Hidden'}</div></div></div>
  <div class="detail-grid"><div>
    <div class="detail-card"><div class="section-tools"><h3>Work Record</h3><div class="action-row">${atomicLocked?'<span class="tiny muted">Pending atomic sync</span>':`<button class="icon-btn" onclick="openLogModal(${id})">Edit</button>`}<button class="icon-btn" onclick="openLogRecords(${id})">Generate Record</button><button class="icon-btn" onclick="openMaintenanceRecordDraft(${id})">Draft Logbook Entry</button></div></div><label>Work performed</label><div class="detail-text">${esc(l.work||'—')}</div><div class="detail-section"><label>Measurements / observations / settings</label><div class="detail-text">${esc(l.observations||'—')}</div></div><div class="detail-section"><label>Additional notes</label><div class="detail-text">${esc(l.notes||'—')}</div></div></div>
    <div class="detail-card"><div class="section-tools"><h3>Parts & Consumables Used</h3>${atomicLocked?'':`<button class="icon-btn" onclick="addConsumedPart(${id})">+ Add Consumed Item</button>`}</div>${l.consumedParts.length?`<div class="table-wrap"><table class="subtable"><thead><tr><th>Item</th><th>Qty</th><th>Unit cost</th><th>Cost</th><th>Notes</th><th></th></tr></thead><tbody>${l.consumedParts.map(x=>`<tr><td>${x.partId?`<button class="linkbtn" onclick="openPartDetail(${x.partId})">${esc(x.name||partName(x.partId))}</button>`:esc(x.name)}</td><td>${esc(x.qty)} ${esc(x.unit||'')}</td><td>${db.settings.showCosts?fmtMoney(x.unitCost):'Hidden'}</td><td>${db.settings.showCosts?fmtMoney(num(x.qty)*num(x.unitCost)):'Hidden'}</td><td>${esc(x.notes||'')}</td><td>${atomicLocked?'':`<button class="icon-btn" onclick="removeConsumedPart(${id},${x.id})">✕</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No consumed parts/materials recorded.</div>'}</div>
    <div class="detail-card"><div class="section-tools"><h3>Photos / Screenshots / Supporting Files</h3><button class="icon-btn" onclick="chooseAttachments('log',${id})">+ Upload</button></div><div class="attach-drop" onclick="chooseAttachments('log',${id})" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,'log',${id})">Drop before/after photos, readings, screenshots, receipts or documents here</div><div id="attachments-log-${id}"></div></div>
  </div><div>
    <div class="detail-card"><h3>What Held Up the Work</h3>${l.blockers?`<div class="danger-note">${esc(l.blockers)}</div>`:'<div class="muted">No blocker recorded.</div>'}</div>
    <div class="detail-card"><h3>Next Step</h3><div class="detail-text">${esc(l.nextStep||'No next step recorded.')}</div></div>
    <div class="detail-card"><h3>Linked Projects</h3>${projects.length?projects.map(p=>`<div class="kv click-row" onclick="openProjectDetail(${p.id})"><span>${esc(p.title)}</span>${pill(p.status)}</div>`).join(''):'<div class="muted">No projects linked.</div>'}</div>
    <div class="detail-card"><h3>Relevant Documents</h3>${docs.length?docs.map(d=>`<div class="kv click-row" onclick='openDocumentDetail(${JSON.stringify(String(d.id))})'><span>${esc(d.name)}</span><span>${esc(d.type)}</span></div>`).join(''):'<div class="muted">No documents linked directly to this entry.</div>'}</div>
  </div></div>`,true);renderAttachments('log',id)
}
function addConsumedPart(logId,presetPartId=null){if(atomicWorkLogEditGuard(logId))return;const l=logById(logId);if(!l)return;const pp=presetPartId?partById(presetPartId):null;openModal(`${modalHeader('Add Consumed Part / Material',l.work)}<div class="form-grid"><div class="full"><label>Inventory part (optional)</label><select id="cpPart" onchange="prefillConsumedPart()">${partOptions(presetPartId)}</select></div>${field('Item name','cpName',pp?.name||'')}${field('Quantity','cpQty','1','number','step="any" min="0.000001"')}${field('Unit','cpUnit',pp?.unit||'ea')}${field('Unit cost at time of use','cpCost',pp?.unitCost||'','number','step="0.01" min="0"')}${textareaField('Notes','cpNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openLogDetail(${logId})">Cancel</button><button class="btn primary" onclick="saveConsumedPart(${logId})">Add Item</button></div>`)}
function prefillConsumedPart(){const p=partById(selectedNumber('cpPart'));if(!p)return;document.getElementById('cpName').value=p.name;document.getElementById('cpUnit').value=p.unit||'ea';document.getElementById('cpCost').value=p.unitCost??''}
function saveConsumedPart(logId){
  if(atomicWorkLogEditGuard(logId))return;
  const l=logById(logId);if(!l)return;
  const partId=selectedNumber('cpPart'),name=val('cpName')||(partId?partName(partId):'');
  if(!name)return alert('Item name is required.');
  const qty=Number(val('cpQty'));if(!Number.isFinite(qty)||qty<=0)return alert('Enter a positive quantity used.');
  const itemId=uid(),unit=val('cpUnit')||'ea',unitCost=val('cpCost'),notes=val('cpNotes');
  const item={id:itemId,partId,name,qty,unit,unitCost,notes};
  if(!partId){
    try{trackerStore.batch(tx=>tx.update('log',logId,draft=>{
      draft.consumedParts=arr(draft.consumedParts);draft.consumedParts.push(item);
    }),{message:'Consumed item recorded.'})}
    catch(error){return alert('Consumed item was not safely saved: '+(error?.message||String(error)))}
    openLogDetail(logId);return;
  }
  const part=partById(partId);if(!part)return alert('The linked inventory Part is missing.');
  const projectIds=arr(l.projectIds).map(Number).filter(Number.isFinite);
  const reservedProject=projectIds.map(projectById).filter(Boolean).find(project=>
    arr(project.plannedParts).some(x=>String(x.partId)===String(partId)&&num(x.qty)>0));
  if(reservedProject)
    return alert('This Part is already reserved on the linked Project "'+reservedProject.title+'". Record it from Project Parts → Reserved → Use so the reservation, Parts Used record, Work Log and inventory stay synchronized.');
  const preview=typeof window.previewPartForPhysicalUse==='function'?
    window.previewPartForPhysicalUse(part,qty):{credited:0,sources:[]};
  const on=typeof partAvailable==='function'?partAvailable(part):null;
  if(on!==null&&on!==undefined&&qty>num(on)+num(preview.credited)+1e-9&&
     !confirm('This use exceeds calculated physical inventory and will make the quantity negative. Record it anyway?'))return;
  const work=tx=>{
    const currentLog=tx.read('log',logId),currentPart=tx.read('part',partId);
    if(!currentLog||!currentPart)throw new Error('The Work Log or Part changed; reopen before recording use.');
    const credited=typeof window.applyPartUseCreditsTx==='function'?
      window.applyPartUseCreditsTx(tx,preview.sources):0;
    tx.update('part',partId,draft=>{
      if(credited>0)draft.stockQty=(draft.stockQty===''?0:num(draft.stockQty))+credited;
      draft.linkedProjectIds=arr(draft.linkedProjectIds);
      projectIds.forEach(pid=>{
        if(!draft.linkedProjectIds.some(id=>String(id)===String(pid)))draft.linkedProjectIds.push(pid);
      });
    });
    tx.update('log',logId,draft=>{
      draft.consumedParts=arr(draft.consumedParts);
      if(draft.consumedParts.some(x=>String(x.id)===String(itemId)))
        throw new Error('Consumed-item ID already exists.');
      draft.consumedParts.push(item);
    });
  };
  const meta={mode:'log-add',partId,logId,consumedItemId:itemId,qty,projectIds};
  let atomic=false;
  try{
    if(window.atomicReceiptOutbox?.shouldHandle('consumption')){
      atomic=true;
      window.atomicReceiptOutbox.stageConsumption(work,'Consumed item recorded.',meta);
    }else trackerStore.batch(work,{message:'Consumed item recorded.'});
  }catch(error){
    return alert('Consumed item was not safely saved: '+(error?.message||String(error))+'. Review the cloud status before retrying.');
  }
  const finish=()=>openLogDetail(logId);
  if(atomic&&typeof window.atomicReceiptOutbox?.settleUI==='function')window.atomicReceiptOutbox.settleUI(finish);
  else finish();
}
function removeConsumedPart(logId,itemId){
  if(atomicWorkLogEditGuard(logId))return;
  const l=logById(logId);if(!l||!confirm('Remove this consumed-item record?'))return;
  try{trackerStore.batch(tx=>tx.update('log',logId,draft=>{
    draft.consumedParts=arr(draft.consumedParts).filter(x=>String(x.id)!==String(itemId));
  }),{message:'Consumed item removed.'})}
  catch(error){return alert('Consumed item could not be removed safely: '+(error?.message||String(error)))}
  openLogDetail(logId);
}
