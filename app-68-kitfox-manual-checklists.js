'use strict';
// Kitfox 912/912S installation manual chapter checklists.
// Checklist DATA is in the owner's private workspace, transcribed from the
// owner's supplied PDF (SkyStar P/N 64825.000, Dec 2001). No manual PDF or
// lengthy extracted manual text is published with this public application.
(function(){
  if(window.__n594zsKitfoxManualUI)return;
  window.__n594zsKitfoxManualUI=true;
  const A=x=>Array.isArray(x)?x:[];
  const E=x=>typeof esc==='function'?esc(String(x??'')):String(x??'');
  const SOURCE_KEY='kitfox-912-64825-000-dec2001';
  const ORDER='ABCDEFGHIJKLM';
  const manual=c=>c?.kitfoxManualPack===SOURCE_KEY;
  const stats=c=>{
    const items=A(c.items),na=items.filter(i=>i.reviewStatus==='N/A').length;
    const verified=items.filter(i=>i.reviewStatus==='Verified'||(i.done&&i.reviewStatus!=='N/A')).length;
    const attention=items.filter(i=>i.reviewStatus==='Needs Attention').length;
    const applicable=items.length-na;
    return {total:items.length,na,verified,attention,applicable,
      percent:applicable?Math.round(verified/applicable*100):100};
  };
  window.kitfoxManualChecklistStats=stats;

  function current(id){return db.checklists.find(c=>String(c.id)===String(id)&&manual(c))||null}
  function step(c,sid){return A(c?.items).find(i=>String(i.id)===String(sid))||null}
  function sourceDoc(c){
    const did=c.sourceDocumentId||c.documentId;
    return did&&typeof docById==='function'?docById(Number(did)):null;
  }
  function chapterNeighbors(c){
    const list=db.checklists.filter(manual).sort((a,b)=>ORDER.indexOf(a.manualChapter)-ORDER.indexOf(b.manualChapter));
    const at=list.findIndex(x=>String(x.id)===String(c.id));
    return {prev:at>0?list[at-1]:null,next:at>=0&&at<list.length-1?list[at+1]:null};
  }
  function statusLabel(i){
    if(i.reviewStatus==='N/A')return 'Not applicable';
    if(i.reviewStatus==='Needs Attention')return 'Needs attention';
    if(i.done||i.reviewStatus==='Verified')return 'Verified';
    return i.sourceGap?'Source gap / requires clarification':'Not verified';
  }
  function statusColor(i){
    if(i.reviewStatus==='N/A')return 'blue';
    if(i.reviewStatus==='Needs Attention'||i.sourceGap&&!i.note&&!i.done)return 'red';
    return i.done||i.reviewStatus==='Verified'?'green':'yellow';
  }
  function itemHtml(i){
    const isNA=i.reviewStatus==='N/A',done=i.done||i.reviewStatus==='Verified';
    const gapBlocked=i.sourceGap&&!String(i.note||'').trim();
    const flagged=i.reviewStatus==='Needs Attention';
    return '<div class="check-item" data-km-item="'+E(i.id)+'" style="align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line, #ddd)">'+
      '<input type="checkbox" data-km-toggle="'+E(i.id)+'" '+(done?'checked ':'')+(isNA||gapBlocked?'disabled ':'')+
        'aria-label="Verify manual step '+E(i.manualStep)+'" style="margin-top:5px">'+
      '<div style="flex:1;min-width:0">'+
        '<div class="'+(done?'done':'')+'" data-km-title style="font-weight:600">'+E(i.text)+'</div>'+
        '<div class="task-meta" style="margin:5px 0 6px"><span class="mini-badge" data-km-status>'+
          '<span class="'+statusColor(i)+' pill">'+E(statusLabel(i))+'</span></span>'+
          '<span class="mini-badge">Manual p.'+E(i.sourcePage)+'</span>'+
          (i.variant?'<span class="mini-badge">'+E(i.variant)+'</span>':'')+
          (i.note?'<span class="mini-badge">Review note</span>':'')+
        '</div>'+
        '<details class="task-note" style="white-space:normal;margin-bottom:6px"><summary style="cursor:pointer">Read the manual step and cautions</summary>'+
          '<div style="white-space:pre-wrap;margin:8px 0;line-height:1.45">'+E(i.manualInstruction||'See source PDF p.'+i.sourcePage)+'</div>'+
          (i.note?'<div style="margin-top:8px"><b>Your review note:</b> '+E(i.note)+'</div>':'')+
          (i.sourceGap?'<div class="danger-note">The provided manual jumps from L.2 to L.4. Do not infer L.3; record the correction or clarification source before marking reviewed.</div>':'')+
        '</details>'+
        '<div class="action-row" style="gap:6px;flex-wrap:wrap">'+
          '<button class="icon-btn" data-km-note="'+E(i.id)+'">Review note</button>'+
          '<button class="icon-btn" data-km-na="'+E(i.id)+'">'+(isNA?'Undo N/A':'N/A')+'</button>'+
          '<button class="icon-btn" data-km-attention="'+E(i.id)+'">'+(flagged?'Clear finding':'Needs attention')+'</button>'+
        '</div>'+
      '</div></div>';
  }
  function updateHeader(c){
    const box=document.getElementById('modalBox');if(!box)return;
    const s=stats(c);
    for(const [key,value] of Object.entries({percent:s.percent+'%',verified:s.verified+'/'+s.applicable,
      na:s.na,attention:s.attention})){
      const el=box.querySelector('[data-km-'+key+']');
      if(el)el.textContent=String(value);
    }
  }
  // In-place updates keep the modal scroll and expanded reference paragraphs
  // stable while checking off a large chapter.
  function refreshItem(c,iid){
    const box=document.getElementById('modalBox');
    const row=box?.querySelector('[data-km-item="'+String(iid)+'"]');
    const i=step(c,iid);
    if(!row||!i)return;
    const shell=document.createElement('div');
    shell.innerHTML=itemHtml(i);
    const replacement=shell.firstElementChild;
    if(replacement)row.replaceWith(replacement);
    bindItemButtons(box);
    updateHeader(c);
  }
  function setStep(cid,iid,action){
    const c=current(cid),i=step(c,iid);if(!i)return;
    const isGap=i.sourceGap;
    if(action==='verify'&&isGap&&!String(i.note||'').trim())
      return alert('This manual has no printed step L.3. Record the Kitfox clarification or reference in a review note before marking this placeholder reviewed.');
    if(action==='na'&&isGap)
      return alert('The missing L.3 is a document gap, not an aircraft-option step. Add a clarification note rather than marking the missing text N/A.');
    const next=i.reviewStatus||'Pending';
    trackerStore.update('checklist',c.id,draft=>{
      const x=step(draft,iid);
      if(!x)return;
      if(action==='verify'){
        x.done=!x.done;x.reviewStatus=x.done?'Verified':'Pending';
        x.reviewedDate=x.done?(typeof today==='function'?today():new Date().toISOString().slice(0,10)):'';
      }else if(action==='na'){
        const toNA=next!=='N/A';
        x.done=false;x.reviewStatus=toNA?'N/A':'Pending';
        x.reviewedDate=toNA?(typeof today==='function'?today():new Date().toISOString().slice(0,10)):'';
      }else if(action==='attention'){
        x.done=false;x.reviewStatus=next==='Needs Attention'?'Pending':'Needs Attention';
        x.reviewedDate='';
      }
    },{message:'Manual checklist review saved.'});
    refreshItem(current(cid),iid);
  }
  window.setKitfoxManualStep=setStep;

  function bindItemButtons(box){
    box.querySelectorAll('[data-km-toggle]').forEach(el=>{
      if(el.dataset.kmBound)return;
      el.dataset.kmBound='1';
      el.addEventListener('change',()=>setStep(currentDetail.id,el.dataset.kmToggle,'verify'));
    });
    box.querySelectorAll('[data-km-na]').forEach(el=>{
      if(el.dataset.kmBound)return;
      el.dataset.kmBound='1';
      el.addEventListener('click',()=>setStep(currentDetail.id,el.dataset.kmNa,'na'));
    });
    box.querySelectorAll('[data-km-attention]').forEach(el=>{
      if(el.dataset.kmBound)return;
      el.dataset.kmBound='1';
      el.addEventListener('click',()=>setStep(currentDetail.id,el.dataset.kmAttention,'attention'));
    });
    box.querySelectorAll('[data-km-note]').forEach(el=>{
      if(el.dataset.kmBound)return;
      el.dataset.kmBound='1';
      el.addEventListener('click',()=>openKitfoxManualStepNote(currentDetail.id,el.dataset.kmNote));
    });
  }
  function bulkNA(cid){
    const c=current(cid);if(!c||!['C','D'].includes(c.manualChapter))return;
    if(A(c.items).some(i=>i.done))
      return alert('This chapter has verified steps. Change those individually before marking the entire alternate cowl chapter N/A.');
    if(!confirm('Mark every step in the '+c.name+' chapter Not Applicable? This is ONLY appropriate if your aircraft uses the other cowl type. You can undo each N/A later.'))return;
    trackerStore.update('checklist',c.id,draft=>{
      A(draft.items).forEach(i=>{i.done=false;i.reviewStatus='N/A';i.reviewedDate=typeof today==='function'?today():new Date().toISOString().slice(0,10)});
    },{message:'Alternate cowl chapter marked N/A.'});
    openKitfox912ManualChecklist(cid);
  }
  window.openKitfox912ManualChecklist=function(id){
    const c=current(id);if(!c)return;
    currentDetail={type:'checklist',id:c.id};
    const s=stats(c),doc=sourceDoc(c),n=chapterNeighbors(c);
    const warning='Your own installed engine, propeller, fuel valve and optional equipment may differ from the 2001 manual. Review actual applicable Kitfox instructions and current ROTAX/component requirements. This is a work-review tracker, not an airworthiness signoff.';
    const alternate=['C','D'].includes(c.manualChapter);
    openModal(modalHeader(c.name,'SkyStar P/N 64825.000 • Dec 2001 • Section '+c.manualChapter)+
      '<div class="notice" style="margin:10px 0"><b>Source-based, initially unchecked.</b> '+
        E(warning)+'</div>'+
      (alternate?'<div class="notice">This cowl chapter applies ONLY to the '+E(c.manualChapter==='C'?'round':'smooth')+
        ' cowling. The opposite cowl chapter can be marked N/A.</div>':'')+
      (c.manualChapter==='L'?'<div class="danger-note">Source gap: the supplied PDF contains electrical steps L.1, L.2, then L.4 through L.15. A review placeholder marks the missing L.3. No procedure has been invented.</div>':'')+
      '<div class="summary-strip">'+
        '<div class="summary-cell"><div class="lab">Applicable reviewed</div><div class="val" data-km-verified>'+s.verified+'/'+s.applicable+'</div></div>'+
        '<div class="summary-cell"><div class="lab">Applicable progress</div><div class="val" data-km-percent>'+s.percent+'%</div></div>'+
        '<div class="summary-cell"><div class="lab">N/A</div><div class="val" data-km-na>'+s.na+'</div></div>'+
        '<div class="summary-cell"><div class="lab">Needs attention</div><div class="val" data-km-attention>'+s.attention+'</div></div>'+
      '</div>'+
      '<div class="detail-card"><div class="section-tools"><h3>Section '+E(c.manualChapter)+
        ' — every numbered step</h3><span class="mini-badge">'+s.total+' review items</span></div>'+
        '<p class="task-note">Check only after personally verifying each action against the source PDF. Expand a row for the full supplied step; record deviations and photos before completion.</p>'+
        A(c.items).map(itemHtml).join('')+
      '</div>'+
      '<div class="detail-card"><h3>Source and applicability</h3><div class="detail-text">'+E(c.notes||'')+
      '</div><div class="task-note" style="margin-top:6px">Source PDF: '+E(c.sourcePdfFilename||'3_Newer_Engine_install_912_64825-000.pdf')+
      ' • Section '+E(c.manualChapter)+' • printed pages '+E(c.sourcePages||'')+
      (doc?'</div><div class="action-row"><button id="kmSource" class="secondary">Open tracker document: '+E(doc.name)+'</button></div>':'</div>')+
      '</div>'+
      '<div class="modal-actions" style="flex-wrap:wrap">'+
        (n.prev?'<button class="secondary" id="kmPrev">← Section '+E(n.prev.manualChapter)+'</button>':'')+
        '<button class="secondary" id="kmBack">All checklists</button>'+
        (alternate?'<button class="secondary" id="kmBulkNA">Mark alternate cowl chapter N/A</button>':'')+
        (n.next?'<button class="primary" id="kmNext">Section '+E(n.next.manualChapter)+' →</button>':'')+
      '</div>',true);
    const box=document.getElementById('modalBox');if(!box)return;
    bindItemButtons(box);
    box.querySelector('#kmPrev')?.addEventListener('click',()=>openKitfox912ManualChecklist(n.prev.id));
    box.querySelector('#kmNext')?.addEventListener('click',()=>openKitfox912ManualChecklist(n.next.id));
    box.querySelector('#kmBack')?.addEventListener('click',()=>{closeModal();navTo('checklists')});
    box.querySelector('#kmBulkNA')?.addEventListener('click',()=>bulkNA(c.id));
    box.querySelector('#kmSource')?.addEventListener('click',()=>openDocumentDetail(doc.id));
  };

  window.openKitfoxManualStepNote=function(cid,iid){
    const c=current(cid),i=step(c,iid);if(!i)return;
    openModal(modalHeader('Review '+i.manualStep,c.name)+
      '<div class="notice"><b>Source PDF p.'+E(i.sourcePage)+'</b> • Keep the original manual step unchanged. Your note records what you actually verified, any substitute parts/procedures, torque evidence or a source clarification.</div>'+
      '<div class="detail-card"><h3>'+E(i.text)+'</h3><div class="detail-text" style="white-space:pre-wrap">'+
        E(i.manualInstruction||'Source text missing; consult the manual.')+'</div></div>'+
      '<div class="form-grid"><div class="full">'+
        textareaField('Your evidence / applicability / clarification','kmReviewNote',i.note||'')+
      '</div></div><div class="modal-actions">'+
        '<button class="secondary" id="kmNoteBack">Back to chapter</button>'+
        '<button class="primary" id="kmNoteSave">Save review note</button>'+
      '</div>',true);
    document.getElementById('kmNoteBack')?.addEventListener('click',()=>openKitfox912ManualChecklist(cid));
    document.getElementById('kmNoteSave')?.addEventListener('click',()=>{
      const note=val('kmReviewNote');
      trackerStore.update('checklist',cid,draft=>{
        const x=step(draft,iid);if(x)x.note=note;
      },{message:'Manual step review note saved.'});
      openKitfox912ManualChecklist(cid);
    });
  };
})();
