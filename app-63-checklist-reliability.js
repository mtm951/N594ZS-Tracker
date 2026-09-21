'use strict';
// ---------- V5.16 CHECKLIST RELIABILITY OVERRIDE ----------
// Final compatibility layer for checklists with either numeric or UUID ids.
// Keeps the specialized annual-inspection renderer, but uses a self-contained
// generic renderer for every other checklist so newer source-backed checklists
// cannot be blocked by legacy numeric-id assumptions.

(function(){
  if(window.__n594zsChecklistReliabilityInstalled)return;
  window.__n594zsChecklistReliabilityInstalled=true;

  const previousOpenChecklist=window.openChecklistDetail;
  const previousRenderChecklists=window.renderChecklists;
  const A=v=>Array.isArray(v)?v:[];

  function record(id){
    return A(db.checklists).find(x=>String(x.id)===String(id))||null;
  }
  function js(v){return JSON.stringify(String(v))}
  function isAnnual(c){return !!c?.inspectionMode&&Number(c.id)===503}

  function openGenericChecklist(c){
    if(!c)return;
    const cid=js(c.id),items=A(c.items);
    currentDetail={type:'checklist',id:c.id};
    const done=items.filter(i=>i.done).length;
    const pct=items.length?Math.round(done/items.length*100):0;
    const pr=c.projectId?projectById(Number(c.projectId)):null;
    const sourceDocId=c.sourceDocumentId||c.documentId||null;
    const sourceDoc=sourceDocId?docById(Number(sourceDocId)):null;

    openModal(
      modalHeader(c.name,c.trigger||c.purpose)+
      '<div class="summary-strip">'+
        '<div class="summary-cell"><div class="lab">Progress</div><div class="val">'+pct+'%</div></div>'+
        '<div class="summary-cell"><div class="lab">Complete</div><div class="val">'+done+'/'+items.length+'</div></div>'+
        '<div class="summary-cell"><div class="lab">System</div><div class="val">'+esc(c.system||'—')+'</div></div>'+
        '<div class="summary-cell"><div class="lab">Project</div><div class="val">'+esc(pr?.title||'—')+'</div></div>'+
      '</div>'+
      '<div class="detail-grid"><div>'+
        '<div class="detail-card"><div class="section-tools"><h3>Checklist Items</h3><button class="icon-btn" onclick=\'addChecklistItem('+cid+')\'>+ Item</button></div>'+
        (items.length?items.map(i=>{
          const iid=js(i.id);
          return '<div class="check-item"><input type="checkbox" '+(i.done?'checked':'')+' onclick="event.stopPropagation()" onchange=\'toggleChecklistItem('+cid+','+iid+',this.checked)\'><div style="flex:1"><div class="'+(i.done?'done':'')+'">'+esc(i.text||'')+'</div>'+(i.note?'<div class="task-note">'+esc(i.note)+'</div>':'')+'</div><button class="icon-btn" onclick=\'editChecklistItem('+cid+','+iid+')\'>Edit</button></div>';
        }).join(''):'<div class="empty">No items yet.</div>')+
        '</div>'+
        '<div class="detail-card"><div class="section-tools"><h3>Evidence / Supporting Files</h3><button class="icon-btn" onclick=\'chooseAttachments("checklist",'+cid+')\'>+ Upload</button></div><div class="attach-drop" onclick=\'chooseAttachments("checklist",'+cid+')\' ondragover="event.preventDefault()" ondrop=\'handleEntityDrop(event,"checklist",'+cid+')\'>Attach photos, screenshots or reference files for this checklist</div><div id="attachments-checklist-'+esc(c.id)+'"></div></div>'+
      '</div><div>'+
        '<div class="detail-card"><div class="section-tools"><h3>Checklist Details</h3><button class="icon-btn" onclick=\'openChecklistModal('+cid+')\'>Edit</button></div><label>Purpose</label><div class="detail-text">'+esc(c.purpose||'—')+'</div><div class="detail-section"><label>Notes / Source</label><div class="detail-text">'+esc(c.notes||'—')+'</div></div></div>'+
        (sourceDoc?'<div class="detail-card"><h3>Source Document</h3><div class="kv click-row" onclick="openDocumentDetail('+Number(sourceDoc.id)+')"><span>'+esc(sourceDoc.name)+'</span><b>'+esc(sourceDoc.revision||'Open')+'</b></div></div>':'')+
        (pr?'<div class="detail-card"><h3>Linked Project</h3><div class="kv click-row" onclick="openProjectDetail('+Number(pr.id)+')"><span>'+esc(pr.title)+'</span>'+pill(pr.status)+'</div></div>':'')+
      '</div></div>',
      true
    );
    Promise.resolve(renderAttachments('checklist',c.id)).catch(e=>console.warn('Checklist attachments failed',e));
  }

  window.openChecklistDetail=function(id){
    const c=record(id);
    if(!c){
      toast('Checklist record could not be found.','bad');
      return;
    }
    if(isAnnual(c)&&typeof previousOpenChecklist==='function'){
      return previousOpenChecklist(c.id);
    }
    try{
      return openGenericChecklist(c);
    }catch(e){
      console.error('Checklist open failed',e);
      toast('Could not open checklist: '+(e?.message||e),'bad');
    }
  };

  window.renderChecklists=function(){
    if(typeof previousRenderChecklists==='function')previousRenderChecklists();
    const page=document.getElementById('page-checklists');if(!page)return;
    page.querySelectorAll('.checklist[data-checklist-id]').forEach(card=>{
      card.onclick=event=>{
        if(event.target.closest('input,button,a,select,textarea,label'))return;
        event.stopPropagation();
        window.openChecklistDetail(card.dataset.checklistId);
      };
      card.onkeydown=event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();event.stopPropagation();
        window.openChecklistDetail(card.dataset.checklistId);
      };
    });
  };
})();