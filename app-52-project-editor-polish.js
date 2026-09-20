'use strict';
// ---------- V5.10.6 PROJECT EDITOR POLISH ----------
// Full-width dependency choices, reusable Due/Trigger presets, and quicker field editing.

(function(){
  if(window.__n594zsProjectEditorPolishInstalled)return;
  window.__n594zsProjectEditorPolishInstalled=true;

  const A=v=>Array.isArray(v)?v:[];
  const T=v=>String(v??'').trim();

  const COMMON_TRIGGERS=[
    'Before Engine Start',
    'Before Flight',
    'First Flight',
    'Return to Service',
    'Annual / Condition Inspection',
    'Next Maintenance',
    'As Needed',
    'Deferred / Later'
  ];

  function triggerChoices(current=''){
    const out=[];
    const add=v=>{const s=T(v);if(s&&!out.some(x=>x.toLowerCase()===s.toLowerCase()))out.push(s)};
    COMMON_TRIGGERS.forEach(add);
    A(db.projects).map(p=>p.trigger).filter(Boolean).forEach(add);
    add(current);
    return out;
  }

  function triggerSelectHTML(current){
    const cur=T(current);
    const opts=triggerChoices(cur).map(v=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(v)}</option>`).join('');
    const known=triggerChoices(cur).some(v=>v===cur);
    return `<label>Due / trigger</label>
      <select id="prTriggerPreset" onchange="projectTriggerPresetChanged()">
        <option value="" ${!cur?'selected':''}>— No trigger —</option>
        ${opts}
        <option value="__custom__" ${cur&&!known?'selected':''}>+ Add new trigger…</option>
      </select>
      <input id="prTrigger" type="hidden" value="${esc(cur)}">
      <input id="prTriggerCustom" class="project-trigger-custom" value="${cur&&!known?esc(cur):''}" placeholder="Type a new trigger…" oninput="projectTriggerCustomChanged()" style="display:${cur&&!known?'block':'none'};margin-top:8px">`;
  }

  window.projectTriggerPresetChanged=function(){
    const preset=document.getElementById('prTriggerPreset');
    const hidden=document.getElementById('prTrigger');
    const custom=document.getElementById('prTriggerCustom');
    if(!preset||!hidden||!custom)return;
    if(preset.value==='__custom__'){
      custom.style.display='block';
      hidden.value=custom.value;
      setTimeout(()=>custom.focus(),0);
    }else{
      custom.style.display='none';
      hidden.value=preset.value;
    }
  };

  window.projectTriggerCustomChanged=function(){
    const hidden=document.getElementById('prTrigger'),custom=document.getElementById('prTriggerCustom');
    if(hidden&&custom)hidden.value=custom.value;
  };

  function upgradeProjectTriggerField(){
    const old=document.getElementById('prTrigger');if(!old)return;
    const holder=old.parentElement;if(!holder)return;
    const current=old.value||'';
    holder.classList.add('project-trigger-field');
    holder.innerHTML=triggerSelectHTML(current);
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