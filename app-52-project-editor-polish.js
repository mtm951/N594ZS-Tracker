'use strict';
// ---------- V5.19.31 LINK PROJECT READINESS TO CANONICAL PHASES ----------
// Full-width dependency choices, reusable Due/Trigger presets, and quicker field editing.

(function(){
  if(window.__n594zsProjectEditorPolishInstalled)return;
  window.__n594zsProjectEditorPolishInstalled=true;

  const T=v=>String(v??'').trim();

  // WORKFLOW_PHASES is the one canonical source for the *actual* Readiness
  // lists. The old trigger preset menu was just text and never moved a
  // Project into the corresponding Readiness list.
  function canonicalReadinessTrigger(id){
    return {
      'build':'','engine-start':'Before Engine Start',
      'ground':'Before Ground Test','flight':'Before Flight',
      'rts':'Before Return to Service','later':'Deferred / Later'
    }[id]??'';
  }
  function triggerIsStageText(value,phase){
    const text=T(value).toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ');
    if(!text)return true;
    const aliases={
      'build':['installation / build','installation','build'],
      'engine-start':['before engine start','before first engine start',
        'before first start','first engine run','before engine run'],
      'ground':['before ground test','before ground testing',
        'engine run / ground test','ground test','ground testing'],
      'flight':['before flight','preflight','before first flight','first flight'],
      'rts':['before return to service','return to service',
        'return to service closeout','before return to flight'],
      'later':['deferred / later','later / optional','later','as needed',
        'optional / mission dependent']
    };
    return (aliases[phase]||[]).includes(text);
  }
  function linkedReadinessPhaseName(id){
    return typeof phaseLabel==='function'?phaseLabel(id):
      (typeof WORKFLOW_PHASES!=='undefined'?
        WORKFLOW_PHASES.find(p=>p.id===id)?.label:'')||'Installation / Build';
  }
  window.projectReadinessStageChanged=function(){
    const phase=document.getElementById('prPhase');
    const trigger=document.getElementById('prTrigger');
    const note=document.getElementById('prTriggerNote');
    const hint=document.getElementById('prReadinessLinkHint');
    if(!phase||!trigger||!note)return;
    // A deliberately entered custom deadline remains untouched. Otherwise,
    // set the historic trigger text so old dashboard/priority filters still
    // recognize "Before Flight" etc as well as the true phase relationship.
    trigger.value=T(note.value)||canonicalReadinessTrigger(phase.value);
    if(hint)hint.textContent='Linked to Readiness → '+linkedReadinessPhaseName(phase.value)+
      '. Save the project to update its actual Readiness list.';
  };
  window.projectReadinessNoteChanged=window.projectReadinessStageChanged;

  function upgradeProjectTriggerField(){
    const old=document.getElementById('prTrigger');
    const phase=document.getElementById('prPhase');
    if(!old||!phase)return;
    const holder=old.parentElement;
    if(!holder||holder.querySelector?.('#prReadinessSelectSlot'))return;
    const stageParent=phase.parentElement;
    const current=T(old.value);
    const existingNote=triggerIsStageText(current,phase.value)?'':current;
    holder.classList.add('project-trigger-field');
    holder.innerHTML='<label for="prPhase">Readiness list / when required</label>'+
      '<div id="prReadinessSelectSlot"></div>'+
      '<div class="project-readiness-hint" id="prReadinessLinkHint">'+
        'Linked to Readiness → '+esc(linkedReadinessPhaseName(phase.value))+
        '. Save the project to update its actual Readiness list.</div>'+
      '<input id="prTrigger" type="hidden" value="'+esc(current)+'">'+
      '<label for="prTriggerNote" style="margin-top:11px">Additional due / trigger note (optional)</label>'+
      '<input id="prTriggerNote" value="'+esc(existingNote)+'"'+
      ' placeholder="e.g. Before first test flight"'+
      ' oninput="projectReadinessNoteChanged()">'+
      '<div class="tiny muted" style="margin-top:5px">The Readiness selection controls where the project appears. Additional notes do not change that list.</div>';
    // Move—not duplicate—the real workflow phase control. app-20-workflow
    // still reads #prPhase when saving and its normal Readiness gates use
    // the resulting project.phase. Leave all other workflow fields intact.
    document.getElementById('prReadinessSelectSlot')?.appendChild(phase);
    stageParent?.remove();
    phase.addEventListener('change',window.projectReadinessStageChanged);
  }

  const openProjectModalPolishBase=window.openProjectModal;
  window.openProjectModal=function(id=null){
    openProjectModalPolishBase(id);
    upgradeProjectTriggerField();
  };

  function decorateEditableProjectFields(id){
    const box=document.getElementById('modalBox');if(!box)return;
    const editableLabels=new Set(['Status','Priority','Progress']);
    box.querySelectorAll('.summary-strip .summary-cell').forEach(cell=>{
      const label=T(cell.querySelector('.lab')?.textContent);
      if(!editableLabels.has(label)||cell.dataset.projectEditable)return;
      cell.dataset.projectEditable='1';
      cell.classList.add('project-field-clickable');
      cell.setAttribute('role','button');
      cell.setAttribute('tabindex','0');
      cell.setAttribute('title','Edit '+label.toLowerCase());
      const go=()=>openProjectModal(Number(id));
      cell.addEventListener('click',go);
      cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
      cell.insertAdjacentHTML('beforeend','<span class="project-field-edit-hint">Edit</span>');
    });

    const head=box.querySelector('.modal-head');
    if(head&&!head.querySelector('.project-edit-all')){
      const btn=document.createElement('button');
      btn.className='icon-btn project-edit-all';
      btn.textContent='Edit fields';
      btn.onclick=()=>openProjectModal(Number(id));
      const close=head.querySelector('button');
      if(close)head.insertBefore(btn,close);else head.appendChild(btn);
    }
  }

  const openProjectDetailPolishBase=window.openProjectDetail;
  window.openProjectDetail=function(id){
    openProjectDetailPolishBase(id);
    decorateEditableProjectFields(Number(id));
  };

  const style=document.createElement('style');
  style.id='projectEditorPolishStyle';
  style.textContent=`
    .workflow-deps .chip-select{display:grid;grid-template-columns:1fr;gap:8px}
    .workflow-deps .chip{width:100%;box-sizing:border-box;border-radius:12px;min-height:48px;padding:10px 12px;justify-content:flex-start;font-size:12px;line-height:1.3}
    .workflow-deps .chip input{flex:0 0 auto;width:18px;height:18px;margin:0 8px 0 0}
    .project-trigger-field select,.project-trigger-field input{width:100%}
    .project-trigger-custom{box-sizing:border-box}
    .project-field-clickable{position:relative;cursor:pointer;transition:border-color .15s,background .15s}
    .project-field-clickable:hover{border-color:#8fb5d3;background:#f1f7fb}
    .project-field-clickable:focus{outline:3px solid rgba(45,127,209,.18);outline-offset:2px}
    .project-field-edit-hint{display:block;margin-top:4px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--blue,#2d7fd1)}
    .project-edit-all{white-space:nowrap;margin-left:auto}
    @media(max-width:700px){
      .workflow-deps .chip{min-height:52px;padding:11px 14px;border-radius:12px}
      .workflow-deps .chip-select{width:100%}
    }
  `;
  document.head.appendChild(style);
})();