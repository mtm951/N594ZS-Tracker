// ---------- V5.10 ANNUAL INSPECTION WORKSPACE ----------
(function(){
  if(window.__n594zsAnnualInspectionWorkspace)return;
  window.__n594zsAnnualInspectionWorkspace=true;

  const A=v=>Array.isArray(v)?v:[], T=v=>String(v??''), E=v=>typeof esc==='function'?esc(v):T(v);
  const annualId=503;

  function checklistItem(cid,iid){
    return checklistById(Number(cid))?.items?.find(x=>Number(x.id)===Number(iid))||null;
  }
  function sourceChecklist(c){return !!c?.inspectionMode&&Number(c.id)===annualId}
  function itemStatus(i){
    if(i.done&&(!i.inspectionStatus||i.inspectionStatus==='Pending'))return 'Satisfactory';
    return i.inspectionStatus||'Pending';
  }
  function statusPill(s){
    const cls=s==='Satisfactory'?'green':s==='Finding'?'red':s==='N/A'?'blue':'yellow';
    return '<span class="'+cls+' pill">'+E(s)+'</span>';
  }
  function groupOrder(c){
    const known=A(c.groupOrder),extra=[...new Set(A(c.items).map(i=>i.group||'UNGROUPED').filter(x=>!known.includes(x)))];
    return [...known,...extra];
  }
  function groupProgress(c,g){
    const items=A(c.items).filter(i=>(i.group||'UNGROUPED')===g),done=items.filter(i=>i.done||itemStatus(i)==='N/A').length;
    return {items,done,pct:items.length?Math.round(done/items.length*100):0};
  }

  const openChecklistDetailBase=window.openChecklistDetail;
  window.openChecklistDetail=function(id){
    // UUID-based ROTAX checklists must pass through untouched; only the
    // legacy numeric annual-inspection checklist uses this specialized renderer.
    const c=checklistById(id);
    if(!c||!sourceChecklist(c))return openChecklistDetailBase(id);
    currentDetail={type:'checklist',id:Number(c.id)};
    const all=A(c.items),done=all.filter(i=>i.done||itemStatus(i)==='N/A').length,pct=all.length?Math.round(done/all.length*100):0;
    const finding=all.filter(i=>itemStatus(i)==='Finding').length;
    const sourceDoc=c.sourceDocumentId?docById(Number(c.sourceDocumentId)):null;
    const groups=groupOrder(c);
    openModal(
      modalHeader(c.name,c.trigger||c.purpose)+
      '<div class="summary-strip">'+
        '<div class="summary-cell"><div class="lab">Progress</div><div class="val" data-annual-progress>'+pct+'%</div></div>'+
        '<div class="summary-cell"><div class="lab">Complete / N/A</div><div class="val" data-annual-complete>'+done+'/'+all.length+'</div></div>'+
        '<div class="summary-cell"><div class="lab">Findings</div><div class="val" data-annual-findings>'+finding+'</div></div>'+
        '<div class="summary-cell"><div class="lab">Source</div><div class="val">'+E(c.sourcePages||'POH')+'</div></div>'+
      '</div>'+
      '<div class="notice annual-source-note"><b>Source-backed checklist.</b> The inspection line text below is retained verbatim from the POH. Configuration/applicability notes are separate and do not alter the source wording.</div>'+
      '<div class="annual-groups">'+groups.map(g=>{
        const p=groupProgress(c,g);
        return '<section class="detail-card annual-group"><div class="section-tools"><h3>'+E(g)+'</h3><span class="mini-badge" data-annual-group-progress>'+p.done+'/'+p.items.length+'</span></div>'+
          p.items.map(i=>{
            const s=itemStatus(i),hasDetail=!!(i.note||i.moreInfo||i.completedDate||i.airframeHours||i.engineHours||i.applicabilityNote||A(i.relatedTerms).length);
            return '<div class="annual-item '+(i.done?'annual-item-done':'')+'" data-annual-item="'+i.id+'">'+
              '<input type="checkbox" '+(i.done?'checked':'')+' aria-label="Complete checklist item" onclick="event.stopPropagation()" onchange="toggleAnnualInspectionItem('+c.id+','+i.id+',this.checked)">'+
              '<div class="annual-item-main"><div class="annual-item-text">'+E(i.text)+'</div><div class="annual-item-meta"><span data-annual-item-status>'+statusPill(s)+'</span> <span class="mini-badge">POH '+E(i.sourcePage||c.sourcePages||'')+'</span>'+(hasDetail?'<span class="mini-badge">details</span>':'')+'</div></div>'+
              '<span class="annual-item-arrow">›</span>'+
            '</div>';
          }).join('')+
        '</section>';
      }).join('')+'</div>'+
      '<div class="detail-grid"><div><div class="detail-card"><h3>Checklist Notes / Applicability</h3><div class="detail-text">'+E(c.notes||'—')+'</div></div></div>'+
      '<div><div class="detail-card"><h3>Source Document</h3>'+(sourceDoc?'<div class="kv click-row" onclick="openDocumentDetail('+sourceDoc.id+')"><span>'+E(sourceDoc.name)+'</span><b>'+E(c.sourcePages||sourceDoc.revision||'Open')+'</b></div>':'<div class="empty">Source document record not linked.</div>')+'</div></div></div>'+
      '<div class="detail-card"><div class="section-tools"><h3>Evidence / Supporting Files</h3><button class="icon-btn" onclick="chooseAttachments(\'checklist\','+c.id+')">+ Upload</button></div><div class="attach-drop" onclick="chooseAttachments(\'checklist\','+c.id+')" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,\'checklist\','+c.id+')">Attach inspection overview photos, worksheets, signed records or references</div><div id="attachments-checklist-'+c.id+'"></div></div>'+
      '<div class="modal-actions"><button class="secondary" onclick="closeModal()">Close</button></div>',
      true
    );
    document.querySelectorAll('[data-annual-item]').forEach(el=>el.addEventListener('click',()=>openAnnualInspectionItem(c.id,Number(el.dataset.annualItem))));
    renderAttachments('checklist',c.id);
  };

  window.toggleAnnualInspectionItem=function(cid,iid,done){
    const c=checklistById(Number(cid)),i=checklistItem(cid,iid);if(!c||!i)return;
    i.done=!!done;
    if(done&&(!i.inspectionStatus||i.inspectionStatus==='Pending'))i.inspectionStatus='Satisfactory';
    if(done&&!i.completedDate)i.completedDate=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    if(!done&&i.inspectionStatus==='Satisfactory')i.inspectionStatus='Pending';
    saveDB();

    // Update the open annual-inspection modal in place so checking an item never
    // destroys/reopens the modal (which previously snapped the scroll position to the top).
    const row=document.querySelector('[data-annual-item="'+Number(iid)+'"]');
    if(row){
      row.classList.toggle('annual-item-done',!!i.done);
      const checkbox=row.querySelector('input[type="checkbox"]');if(checkbox)checkbox.checked=!!i.done;
      const status=row.querySelector('[data-annual-item-status]');if(status)status.innerHTML=statusPill(itemStatus(i));
      const group=row.closest('.annual-group'),badge=group?.querySelector('[data-annual-group-progress]');
      if(group&&badge){
        const rows=[...group.querySelectorAll('[data-annual-item]')];
        const groupDone=rows.filter(el=>checklistItem(cid,Number(el.dataset.annualItem))?.done||itemStatus(checklistItem(cid,Number(el.dataset.annualItem)))==='N/A').length;
        badge.textContent=groupDone+'/'+rows.length;
      }
    }

    const all=A(c.items),complete=all.filter(x=>x.done||itemStatus(x)==='N/A').length;
    const pct=all.length?Math.round(complete/all.length*100):0;
    const findings=all.filter(x=>itemStatus(x)==='Finding').length;
    const progressEl=document.querySelector('[data-annual-progress]');
    const completeEl=document.querySelector('[data-annual-complete]');
    const findingsEl=document.querySelector('[data-annual-findings]');
    if(progressEl)progressEl.textContent=pct+'%';
    if(completeEl)completeEl.textContent=complete+'/'+all.length;
    if(findingsEl)findingsEl.textContent=String(findings);
  };

  function matchTerms(text,terms){
    const hay=T(text).toLowerCase();
    return A(terms).some(t=>T(t).trim().length>=3&&hay.includes(T(t).toLowerCase()));
  }
  function relatedForItem(i){
    const terms=A(i.relatedTerms);
    if(!terms.length)return {parts:[],purchases:[],logs:[]};
    const parts=A(db.parts).filter(p=>matchTerms([p.name,p.partNo,p.description,p.notes,p.vendor,p.system].join(' '),terms));
    const ids=new Set(parts.map(p=>Number(p.id)));
    const purchases=A(db.purchases).filter(p=>ids.has(Number(p.inventoryPartId))||matchTerms([p.description,p.pn,p.notes,p.vendor,p.system].join(' '),terms))
      .sort((a,b)=>T(b.shipDate).localeCompare(T(a.shipDate)));
    const logs=A(db.logs).filter(l=>{
      if(matchTerms([l.work,l.observations,l.notes,l.nextStep,l.system].join(' '),terms))return true;
      return A(l.consumedParts).some(cp=>ids.has(Number(cp.partId))||matchTerms([cp.name,cp.partNo].join(' '),terms));
    }).sort((a,b)=>T(b.date).localeCompare(T(a.date)));
    return {parts,purchases,logs};
  }
  function bindRelated(){
    const box=document.getElementById('modalBox');if(!box)return;
    box.querySelectorAll('[data-ai-part]').forEach(el=>el.addEventListener('click',()=>openPartDetail(Number(el.dataset.aiPart))));
    box.querySelectorAll('[data-ai-purchase]').forEach(el=>el.addEventListener('click',()=>openPurchaseDetail(el.dataset.aiPurchase)));
    box.querySelectorAll('[data-ai-log]').forEach(el=>el.addEventListener('click',()=>openLogDetail(Number(el.dataset.aiLog))));
  }
  function relatedHTML(rel){
    const lastPurchase=rel.purchases[0],lastLog=rel.logs[0];
    return '<div class="summary-strip annual-history-summary">'+
      '<div class="summary-cell"><div class="lab">Inventory matches</div><div class="val">'+rel.parts.length+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Last purchase</div><div class="val annual-small-val">'+E(lastPurchase?.shipDate||'—')+'</div></div>'+
      '<div class="summary-cell"><div class="lab">Last work / use</div><div class="val annual-small-val">'+E(lastLog?.date||'—')+'</div></div>'+
    '</div>'+
    '<div class="detail-card"><h3>Matching Parts / Inventory</h3>'+
      (rel.parts.length?rel.parts.slice(0,10).map(p=>'<div class="kv click-row" data-ai-part="'+E(p.id)+'"><div><b>'+E(p.name||p.partNo||'Part')+'</b><div class="task-note">'+E(p.partNo||'No PN')+' • '+E(p.vendor||'')+'</div></div><b>'+E((typeof partAvailable==='function'?partAvailable(p):p.stockQty)??'—')+' '+E(p.unit||'')+'</b></div>').join(''):'<div class="empty">No matching inventory records yet.</div>')+
    '</div>'+
    '<div class="detail-card"><h3>Purchase History</h3>'+
      (rel.purchases.length?rel.purchases.slice(0,10).map(p=>'<div class="kv click-row" data-ai-purchase="'+E(p.id)+'"><div><b>'+E(p.shipDate||'Unknown date')+' • '+E(p.pn||p.description||'Purchase')+'</b><div class="task-note">'+E(p.vendor||'Vendor')+' • Qty '+E(p.qty)+'</div></div><b>'+ (typeof fmtMoney==='function'?fmtMoney(p.unitPrice):E(p.unitPrice))+'</b></div>').join(''):'<div class="empty">No matching purchase history yet.</div>')+
    '</div>'+
    '<div class="detail-card"><h3>Work / Use History</h3>'+
      (rel.logs.length?rel.logs.slice(0,10).map(l=>'<div class="kv click-row" data-ai-log="'+E(l.id)+'"><div><b>'+E(l.date||'Unknown date')+' • '+E(l.work||'Work entry')+'</b><div class="task-note">'+(l.airframeHours?'AF '+E(l.airframeHours)+' ':'')+(l.engineHours?'• ENG '+E(l.engineHours):'')+'</div></div><span>Open ›</span></div>').join(''):'<div class="empty">No matching work/use history yet.</div>')+
    '</div>';
  }

  window.openAnnualInspectionItem=function(cid,iid){
    const c=checklistById(Number(cid)),i=checklistItem(cid,iid);if(!c||!i)return;
    currentDetail={type:'checklist-item',id:Number(iid),checklistId:Number(cid)};
    const rel=relatedForItem(i),status=itemStatus(i),sourceDoc=c.sourceDocumentId?docById(Number(c.sourceDocumentId)):null;
    const af=T(db.aircraft?.airframeHours||''),eng=T(db.aircraft?.engineHours||'');
    openModal(
      modalHeader('Annual Inspection Item',i.group+' • POH '+(i.sourcePage||c.sourcePages||''))+
      '<div class="annual-source-text">'+E(i.text)+'</div>'+
      (i.applicabilityNote?'<div class="notice"><b>Applicability note:</b> '+E(i.applicabilityNote)+'</div>':'')+
      '<div class="summary-strip">'+
        '<div class="summary-cell"><div class="lab">Status</div><div class="val">'+E(status)+'</div></div>'+
        '<div class="summary-cell"><div class="lab">Performed / replaced</div><div class="val annual-small-val">'+E(i.completedDate||'—')+'</div></div>'+
        '<div class="summary-cell"><div class="lab">AF hours</div><div class="val">'+E(i.airframeHours||'—')+'</div></div>'+
        '<div class="summary-cell"><div class="lab">ENG hours</div><div class="val">'+E(i.engineHours||'—')+'</div></div>'+
      '</div>'+
      '<div class="detail-card"><h3>Inspection Record</h3><div class="form-grid">'+
        '<div><label>Result / status</label><select id="aciStatus">'+['Pending','Satisfactory','Finding','N/A'].map(x=>'<option '+(status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'+
        '<div><label>Performed / replaced date</label><input id="aciDate" type="date" value="'+E(i.completedDate||'')+'"></div>'+
        '<div><label>Airframe hours</label><input id="aciAF" type="number" step="0.1" value="'+E(i.airframeHours||'')+'" placeholder="'+E(af)+'"></div>'+
        '<div><label>Engine hours</label><input id="aciENG" type="number" step="0.1" value="'+E(i.engineHours||'')+'" placeholder="'+E(eng)+'"></div>'+
        '<div class="full"><label><input id="aciDone" type="checkbox" '+(i.done?'checked':'')+'> Checklist item complete</label></div>'+
        '<div class="full"><label>Inspection notes / observations</label><textarea id="aciNote">'+E(i.note||'')+'</textarea></div>'+
        '<div class="full"><label>More info / specification note</label><textarea id="aciMore">'+E(i.moreInfo||'')+'</textarea></div>'+
      '</div>'+
      ((af||eng)?'<div class="action-row"><button class="secondary" onclick="fillAnnualCurrentHours()">'+E('Use current aircraft hours')+'</button></div>':'')+
      '</div>'+
      (A(i.relatedTerms).length?relatedHTML(rel):'<div class="detail-card"><h3>Related History</h3><div class="empty">No automatic part/history keywords are assigned to this inspection item. You can still record notes, hours and evidence here.</div></div>')+
      '<div class="detail-card"><div class="section-tools"><h3>Evidence / Photos</h3><button class="icon-btn" onclick="chooseAttachments(\'checklist-item\','+i.id+')">+ Upload</button></div><div class="attach-drop" onclick="chooseAttachments(\'checklist-item\','+i.id+')" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,\'checklist-item\','+i.id+')">Attach close-up photos, measurements, screenshots, receipts or supporting evidence for this exact inspection line</div><div id="attachments-checklist-item-'+i.id+'"></div></div>'+
      '<div class="detail-card"><h3>Source</h3>'+(sourceDoc?'<div class="kv click-row" onclick="openDocumentDetail('+sourceDoc.id+')"><span>'+E(sourceDoc.name)+'</span><b>POH '+E(i.sourcePage||'')+'</b></div>':'<div class="kv"><span>POH page</span><b>'+E(i.sourcePage||'—')+'</b></div>')+'<div class="tiny muted" style="margin-top:9px">The source checklist text above is locked/verbatim; the editable fields are your inspection record and applicability/context notes.</div></div>'+
      '<div class="modal-actions"><button class="secondary" onclick="openChecklistDetail('+c.id+')">← Annual Inspection</button><button class="primary" onclick="saveAnnualInspectionItem('+c.id+','+i.id+')">Save Details</button></div>',
      true
    );
    bindRelated();
    renderAttachments('checklist-item',i.id);
  };

  window.fillAnnualCurrentHours=function(){
    const af=document.getElementById('aciAF'),eng=document.getElementById('aciENG');
    if(af&&db.aircraft?.airframeHours!==undefined)af.value=db.aircraft.airframeHours||'';
    if(eng&&db.aircraft?.engineHours!==undefined)eng.value=db.aircraft.engineHours||'';
  };

  window.saveAnnualInspectionItem=function(cid,iid){
    const i=checklistItem(cid,iid);if(!i)return;
    let status=val('aciStatus')||'Pending',done=!!document.getElementById('aciDone')?.checked;
    if(done&&status==='Pending')status='Satisfactory';
    if(status==='N/A')done=true;
    i.inspectionStatus=status;i.done=done;i.completedDate=val('aciDate');i.airframeHours=val('aciAF');i.engineHours=val('aciENG');i.note=val('aciNote');i.moreInfo=val('aciMore');
    if(done&&!i.completedDate)i.completedDate=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    saveDB('Annual inspection item updated.');
    openAnnualInspectionItem(Number(cid),Number(iid));
  };

  const reopenBase=window.reopenDetail;
  window.reopenDetail=function(type,id){
    if(type==='checklist-item'){
      const c=A(db.checklists).find(c=>A(c.items).some(i=>Number(i.id)===Number(id)));
      if(c)return openAnnualInspectionItem(c.id,Number(id));
    }
    return reopenBase?reopenBase(type,id):undefined;
  };

  const renderChecklistsBase=window.renderChecklists;
  window.renderChecklists=function(){
    renderChecklistsBase();
    const c=checklistById(annualId),page=document.getElementById('page-checklists');if(!c||!page)return;
    const cards=[...page.querySelectorAll('.checklist')],card=cards.find(x=>x.querySelector('.check-head b')?.textContent?.trim()===c.name);
    if(card&&!card.querySelector('[data-annual-source-badge]')){
      const note=card.querySelector('.task-note');
      note?.insertAdjacentHTML('afterend','<div class="task-meta" data-annual-source-badge><span class="mini-badge">POH '+E(c.sourcePages)+'</span><span class="mini-badge">'+A(c.groupOrder).length+' groups</span><span class="mini-badge">click items for history & notes</span></div>');
    }
  };

  if(!document.getElementById('annualInspectionStyle')){
    const s=document.createElement('style');s.id='annualInspectionStyle';
    s.textContent=
      '.annual-source-note{margin:12px 0}.annual-groups{display:flex;flex-direction:column;gap:12px}.annual-group{margin:0}.annual-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 4px;border-bottom:1px solid #edf1f5;cursor:pointer}.annual-item:hover{background:#f7fbff}.annual-item input{margin-top:4px}.annual-item-text{font-weight:650;line-height:1.35}.annual-item-done .annual-item-text{text-decoration:line-through;opacity:.66}.annual-item-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.annual-item-arrow{font-size:1.25rem;opacity:.35;padding-right:4px}.annual-source-text{font-size:1.05rem;font-weight:750;line-height:1.45;padding:14px 16px;border:1px solid #dbe6ef;border-left:4px solid #0d6efd;border-radius:10px;background:#f8fbff;margin-bottom:12px}.annual-small-val{font-size:.92rem!important}.annual-history-summary{margin:12px 0}#modalBox .annual-group .section-tools{position:sticky;top:0;background:#fff;z-index:1;padding:4px 0 7px}@media(max-width:700px){.annual-item{grid-template-columns:auto minmax(0,1fr) auto}.annual-source-text{font-size:1rem}.annual-history-summary{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
})();