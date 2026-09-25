// ---------- V4.1 AIRCRAFT WORKFLOW ----------
// Project phases, dependencies, focus, readiness gates, and per-project step checklists.

const WORKFLOW_PHASES=[
  {id:'build',label:'Installation / Build',short:'Build'},
  {id:'engine-start',label:'Before Engine Start',short:'Engine Start'},
  {id:'ground',label:'Engine Run / Ground Test',short:'Ground Test'},
  {id:'flight',label:'Before Flight',short:'Before Flight'},
  {id:'rts',label:'Return-to-Service Closeout',short:'RTS Closeout'},
  {id:'later',label:'Later / Optional',short:'Later'}
];
const WORKFLOW_PHASE_ORDER=Object.fromEntries(WORKFLOW_PHASES.map((p,i)=>[p.id,i]));

if(!NAV.some(x=>x[0]==='readiness')){
  const i=NAV.findIndex(x=>x[0]==='projects');NAV.splice(i<0?1:i,0,['readiness','Readiness']);
}

function deriveProjectPhase(p){
  const txt=`${p?.trigger||''} ${p?.title||''}`.toLowerCase();
  if(/optional|mission dependent|future|later/.test(txt))return 'later';
  if(/return to service|return-to-service|weight\s*&?\s*balance|records? closeout/.test(txt))return 'rts';
  if(/before flight|preflight|flight test/.test(txt))return 'flight';
  if(/ground test|ground testing|taxi|brake test/.test(txt))return 'ground';
  if(/before engine|first engine|engine run|engine start|first start|before first start/.test(txt))return 'engine-start';
  return 'build';
}
function phaseLabel(id){return WORKFLOW_PHASES.find(x=>x.id===id)?.label||'Installation / Build'}
function phaseShort(id){return WORKFLOW_PHASES.find(x=>x.id===id)?.short||'Build'}

const normalizeDBWorkflowBase=normalizeDB;
normalizeDB=function(){
  normalizeDBWorkflowBase();
  db.projects.forEach(p=>{
    p.phase=p.phase||deriveProjectPhase(p);
    p.focusToday=!!p.focusToday;
    p.dependsOnIds=arr(p.dependsOnIds).map(Number).filter(Number.isFinite);
    p.completionCriteria=p.completionCriteria||'';
    p.stepsDriveProgress=!!p.stepsDriveProgress;
    p.steps=arr(p.steps);
    p.steps.forEach((s,i)=>{s.id=s.id||uid();s.text=s.text||`Step ${i+1}`;s.done=!!s.done;s.note=s.note||'';s.order=Number.isFinite(Number(s.order))?Number(s.order):i+1});
    p.steps.sort((a,b)=>num(a.order)-num(b.order));
  });
};
normalizeDB();

function projectSteps(p){return arr(p?.steps).sort((a,b)=>num(a.order)-num(b.order))}
function projectStepProgress(p){const steps=projectSteps(p);return steps.length?Math.round(steps.filter(x=>x.done).length/steps.length*100):0}
function syncProjectProgressFromSteps(p){if(p?.stepsDriveProgress&&projectSteps(p).length)p.percent=projectStepProgress(p)}
function projectDependencies(p){return arr(p?.dependsOnIds).map(projectById).filter(Boolean)}
function projectOpenDependencies(p){return projectDependencies(p).filter(x=>x.status!=='Done')}
function projectOpenOrders(p){return db.orders.filter(o=>o.projectId===p.id&&!isClosedOrder(o))}
function projectWorkflowBlockers(p){
  const reasons=[];
  if(String(p.blockers||'').trim())reasons.push(p.blockers.trim());
  const deps=projectOpenDependencies(p);if(deps.length)reasons.push('Waiting on: '+deps.map(x=>x.title).join(', '));
  const orders=projectOpenOrders(p).filter(o=>['Need to Order','Backordered'].includes(o.status));if(orders.length)reasons.push('Parts/order: '+orders.map(x=>x.item).join(', '));
  return reasons;
}
function projectIsActionable(p){return p.status!=='Done'&&projectWorkflowBlockers(p).length===0}
function projectWorkflowScore(p){return [p.focusToday?0:1,projectIsActionable(p)?0:1,{High:0,Medium:1,Low:2}[p.priority]??3,WORKFLOW_PHASE_ORDER[p.phase]??9,100-num(p.percent)]}
function compareWorkflowProjects(a,b){const A=projectWorkflowScore(a),B=projectWorkflowScore(b);for(let i=0;i<A.length;i++)if(A[i]!==B[i])return A[i]-B[i];return String(a.title).localeCompare(String(b.title))}
function phaseGateInfo(phaseId){
  const target=WORKFLOW_PHASE_ORDER[phaseId]??0;
  const relevant=db.projects.filter(p=>p.phase!=='later'&&(WORKFLOW_PHASE_ORDER[p.phase]??0)<=target);
  const open=relevant.filter(p=>p.status!=='Done');
  return {total:relevant.length,done:relevant.length-open.length,open,clear:relevant.length>0&&open.length===0};
}
function workflowOverallPercent(){const p=db.projects.filter(x=>x.phase!=='later');return p.length?Math.round(p.reduce((s,x)=>s+num(x.percent),0)/p.length):0}

// ---------- PROJECT EDITOR WORKFLOW FIELDS ----------
const openProjectModalWorkflowBase=openProjectModal;
openProjectModal=function(id=null){
  openProjectModalWorkflowBase(id);
  const p=id?projectById(id):{phase:'build',focusToday:false,dependsOnIds:[],completionCriteria:'',stepsDriveProgress:true};
  const form=document.querySelector('#modalBox .form-grid');if(!form)return;
  const deps=new Set(arr(p.dependsOnIds).map(Number));
  const wrap=document.createElement('div');wrap.className='full workflow-project-editor';
  wrap.innerHTML=`<div class="workflow-editor-grid">
    <div><label>Workflow phase</label><select id="prPhase">${WORKFLOW_PHASES.map(x=>`<option value="${x.id}" ${p.phase===x.id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
    <label class="focus-toggle"><input id="prFocusToday" type="checkbox" ${p.focusToday?'checked':''}> <span>Focus today</span></label>
    <label class="focus-toggle"><input id="prStepsDrive" type="checkbox" ${p.stepsDriveProgress?'checked':''}> <span>Use checklist completion as project progress</span></label>
    <div class="workflow-deps"><label>Depends on / blocked by another project</label><div class="chip-select">${db.projects.filter(x=>x.id!==id&&x.status!=='Done').map(x=>`<label class="chip"><input type="checkbox" class="pr-dependency" value="${x.id}" ${deps.has(x.id)?'checked':''}> ${esc(x.title)}</label>`).join('')||'<span class="muted small">No other open projects.</span>'}</div></div>
    <div class="workflow-criteria"><label>Definition of done / verification</label><textarea id="prCompletionCriteria" placeholder="What has to be checked, verified or documented before this project is truly complete?">${esc(p.completionCriteria||'')}</textarea></div>
  </div>`;
  form.appendChild(wrap);
};
const saveProjectWorkflowBase=saveProject;
saveProject=function(id){
  const existingIds=new Set(db.projects.map(x=>x.id));
  const extras={phase:val('prPhase')||'build',focusToday:!!document.getElementById('prFocusToday')?.checked,stepsDriveProgress:!!document.getElementById('prStepsDrive')?.checked,dependsOnIds:[...document.querySelectorAll('.pr-dependency:checked')].map(x=>Number(x.value)).filter(Number.isFinite),completionCriteria:val('prCompletionCriteria')};
  saveProjectWorkflowBase(id);
  const p=id?projectById(id):db.projects.find(x=>!existingIds.has(x.id));
  if(p){Object.assign(p,extras);p.steps=arr(p.steps);syncProjectProgressFromSteps(p);saveDB();}
};

// ---------- PROJECT DETAIL: WORKFLOW + STEP-BY-STEP CHECKLIST ----------
const openProjectDetailWorkflowBase=openProjectDetail;
openProjectDetail=function(id){openProjectDetailWorkflowBase(id);queueMicrotask(()=>injectProjectWorkflowDetail(id))};
function injectProjectWorkflowDetail(id){
  const p=projectById(id);if(!p)return;const grid=document.querySelector('#modalBox .detail-grid');if(!grid)return;
  const left=grid.children[0],right=grid.children[1]||left;if(!left||!right)return;
  const steps=projectSteps(p),done=steps.filter(x=>x.done).length,pct=projectStepProgress(p);
  const stepCard=document.createElement('div');stepCard.className='detail-card project-steps-card';
  stepCard.innerHTML=`<div class="section-tools"><div><h3>Step-by-Step Tasks</h3><div class="muted tiny">${done}/${steps.length} complete${p.stepsDriveProgress?' • drives project progress':''}</div></div><button class="icon-btn" onclick="openProjectStepEditor(${id})">+ Step</button></div>
    ${steps.length?`<div class="project-step-progress"><div style="width:${pct}%"></div></div><div class="project-steps">${steps.map((s,i)=>projectStepRow(p,s,i)).join('')}</div>`:'<div class="empty project-step-empty">No project steps yet. Add the individual tasks you want to work through in order.</div>'}
    ${steps.length&&!p.stepsDriveProgress?`<div class="action-row" style="margin-top:9px"><button class="secondary" onclick="applyChecklistProgress(${id})">Set project progress to ${pct}%</button></div>`:''}`;
  left.insertBefore(stepCard,left.firstChild);
  const deps=projectDependencies(p),openDeps=deps.filter(x=>x.status!=='Done');
  const wf=document.createElement('div');wf.className='detail-card workflow-detail-card';
  wf.innerHTML=`<div class="section-tools"><h3>Workflow</h3><button class="icon-btn" onclick="toggleProjectFocus(${id})">${p.focusToday?'Remove Focus':'Focus Today'}</button></div><div class="kv"><span>Readiness list</span><button class="linkbtn" onclick="openPhaseProjects('${esc(p.phase)}')" title="Open this Readiness list">${esc(phaseLabel(p.phase))} ↗</button></div><div class="kv"><span>Actionable now</span><b>${projectIsActionable(p)?'Yes':'No'}</b></div>${deps.length?`<div class="detail-section"><label>Dependencies</label>${deps.map(d=>`<div class="kv click-row" onclick="openProjectDetail(${d.id})"><span>${esc(d.title)}</span>${pill(d.status)}</div>`).join('')}</div>`:''}${openDeps.length?`<div class="danger-note">Waiting on ${openDeps.length} linked project${openDeps.length===1?'':'s'}.</div>`:''}<div class="detail-section"><label>Definition of done / verification</label><div class="detail-text">${esc(p.completionCriteria||'Not defined yet.')}</div></div>`;
  right.insertBefore(wf,right.firstChild);
}
function projectStepRow(p,s,index){return `<div class="project-step ${s.done?'is-done':''}"><input type="checkbox" ${s.done?'checked':''} onchange="toggleProjectStep(${p.id},${s.id},this.checked)"><button class="step-body" onclick="openProjectStepEditor(${p.id},${s.id})"><b>${index+1}. ${esc(s.text)}</b>${s.note?`<small>${esc(s.note)}</small>`:''}</button><div class="step-actions"><button class="icon-btn" title="Move up" onclick="moveProjectStep(${p.id},${s.id},-1)" ${index===0?'disabled':''}>↑</button><button class="icon-btn" title="Move down" onclick="moveProjectStep(${p.id},${s.id},1)" ${index===projectSteps(p).length-1?'disabled':''}>↓</button></div></div>`}
function openProjectStepEditor(projectId,stepId=null){
  const p=projectById(projectId);if(!p)return;const s=stepId?projectSteps(p).find(x=>x.id===stepId):{text:'',note:'',done:false};
  openModal(`${modalHeader(stepId?'Edit Project Step':'Add Project Step',p.title)}<div class="form-grid"><div class="full"><label>Task / step</label><input id="stepText" value="${esc(s.text||'')}" autofocus></div>${textareaField('Notes / details / acceptance criteria','stepNote',s.note||'')}<label class="focus-toggle full"><input id="stepDone" type="checkbox" ${s.done?'checked':''}> <span>Completed</span></label></div><div class="modal-actions">${stepId?`<button class="danger" onclick="deleteProjectStep(${projectId},${stepId})">Delete Step</button>`:''}<button class="secondary" onclick="openProjectDetail(${projectId})">Cancel</button><button class="primary" onclick="saveProjectStep(${projectId},${stepId||'null'})">Save Step</button></div>`);
}
function saveProjectStep(projectId,stepId){const p=projectById(projectId);if(!p)return;const text=val('stepText').trim();if(!text)return alert('Step text is required.');const existing=stepId?projectSteps(p).find(x=>x.id===stepId):null;if(existing){existing.text=text;existing.note=val('stepNote');existing.done=!!document.getElementById('stepDone')?.checked}else{const max=Math.max(0,...projectSteps(p).map(x=>num(x.order)));p.steps.push({id:uid(),text,note:val('stepNote'),done:!!document.getElementById('stepDone')?.checked,order:max+1})}syncProjectProgressFromSteps(p);saveDB('Project checklist saved.');openProjectDetail(projectId)}
function toggleProjectStep(projectId,stepId,done){const p=projectById(projectId),s=projectSteps(p).find(x=>x.id===stepId);if(!p||!s)return;s.done=done;syncProjectProgressFromSteps(p);saveDB();openProjectDetail(projectId)}
function deleteProjectStep(projectId,stepId){const p=projectById(projectId);if(!p||!confirm('Delete this project step?'))return;p.steps=p.steps.filter(x=>x.id!==stepId);projectSteps(p).forEach((x,i)=>x.order=i+1);syncProjectProgressFromSteps(p);saveDB('Project step deleted.');openProjectDetail(projectId)}
function moveProjectStep(projectId,stepId,dir){const p=projectById(projectId);if(!p)return;const steps=projectSteps(p),i=steps.findIndex(x=>x.id===stepId),j=i+dir;if(i<0||j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];steps.forEach((x,k)=>x.order=k+1);p.steps=steps;saveDB();openProjectDetail(projectId)}
function applyChecklistProgress(projectId){const p=projectById(projectId);if(!p)return;p.percent=projectStepProgress(p);saveDB('Project progress updated from checklist.');openProjectDetail(projectId)}
function toggleProjectFocus(id){const p=projectById(id);if(!p)return;p.focusToday=!p.focusToday;saveDB(p.focusToday?'Added to today’s focus.':'Removed from today’s focus.');openProjectDetail(id)}

// ---------- READINESS PAGE ----------
function readinessGateCard(label,info,phase,icon){return `<button class="gate-card ${info.clear?'gate-clear':'gate-open'}" onclick="openReadinessGate('${phase}')"><span class="gate-icon">${icon}</span><div><b>${esc(label)}</b><small>${info.clear?'Project gate clear':`${info.open.length} open of ${info.total}`}</small></div></button>`}
function workflowProjectRow(p){const reasons=projectWorkflowBlockers(p),steps=projectSteps(p);return `<div class="workflow-row click-row" onclick="openProjectDetail(${p.id})"><div class="workflow-row-main"><b>${p.focusToday?'⭐ ':''}${esc(p.title)}</b><small>${esc(phaseShort(p.phase))} • ${esc(p.nextStep||'No next step')}${steps.length?` • checklist ${steps.filter(x=>x.done).length}/${steps.length}`:''}</small></div><div class="workflow-row-end">${pill(p.priority)}${reasons.length?'<span class="mini-badge warn">Waiting</span>':'<span class="mini-badge good">Actionable</span>'}</div></div>`}
function renderReadiness(){
  const page=document.getElementById('page-readiness');if(!page)return;
  const next=[...db.projects].filter(p=>p.status!=='Done').sort(compareWorkflowProjects).slice(0,8),focus=[...db.projects].filter(p=>p.status!=='Done'&&p.focusToday).sort(compareWorkflowProjects),blocked=[...db.projects].filter(p=>p.status!=='Done'&&projectWorkflowBlockers(p).length).sort(compareWorkflowProjects);
  const beforeStart=phaseGateInfo('engine-start'),beforeFlight=phaseGateInfo('flight'),rts=phaseGateInfo('rts');
  page.innerHTML=`<div class="readiness-page"><div class="card readiness-hero"><div><div class="eyebrow">N594ZS PROJECT READINESS</div><h1>${workflowOverallPercent()}% project closeout</h1><div class="muted">Use this as a work-planning view. A clear project gate is not an airworthiness determination.</div></div><div class="quick-actions"><button class="primary" onclick="openProjectModal()">+ Project</button><button class="secondary" onclick="openLogModal()">Log Work</button><button class="secondary" onclick="openOrderModal()">Add Order</button></div></div><div class="gate-grid">${readinessGateCard('Before Engine Start',beforeStart,'engine-start','🔥')}${readinessGateCard('Before Flight',beforeFlight,'flight','🛫')}${readinessGateCard('Return-to-Service Closeout',rts,'rts','✅')}</div><div class="workflow-phase-strip">${WORKFLOW_PHASES.map(ph=>{const ps=db.projects.filter(p=>p.phase===ph.id),done=ps.filter(p=>p.status==='Done').length,pct=ps.length?Math.round(done/ps.length*100):100;return `<button onclick="openPhaseProjects('${ph.id}')" class="phase-step ${ps.length&&done===ps.length?'phase-done':''}"><span>${esc(ph.short)}</span><b>${done}/${ps.length}</b><div class="mini-progress"><i style="width:${pct}%"></i></div></button>`}).join('')}</div><div class="grid"><div class="card span-7"><div class="section-head"><div><h2>Next Best Work</h2><div class="muted small">Pinned work first, then actionable projects by priority and phase.</div></div><button class="linkbtn" onclick="navTo('projects')">All projects</button></div>${next.map(workflowProjectRow).join('')||'<div class="empty">No open projects.</div>'}</div><div class="card span-5"><div class="section-head"><h2>Today’s Focus</h2></div>${focus.map(workflowProjectRow).join('')||'<div class="empty">Nothing pinned. Open a project and choose Focus Today.</div>'}</div><div class="card span-12"><div class="section-head"><h2>Blocked / Waiting</h2><button class="linkbtn" onclick="openProjectsView({status:'Held Up'})">View held-up projects</button></div><div class="workflow-blocker-grid">${blocked.slice(0,10).map(p=>`<button class="workflow-blocker-card" onclick="openProjectDetail(${p.id})"><b>${esc(p.title)}</b><small>${esc(projectWorkflowBlockers(p).join(' • '))}</small></button>`).join('')||'<div class="empty">Nothing is recorded as blocked right now.</div>'}</div></div></div></div>`;
}
function openPhaseProjects(phase){const ps=db.projects.filter(p=>p.phase===phase).sort(compareWorkflowProjects);openModal(`${modalHeader(phaseLabel(phase),`${ps.length} project${ps.length===1?'':'s'} in this phase`)}<div class="workflow-modal-list">${ps.map(p=>`<button class="workflow-modal-row" onclick="openProjectDetail(${p.id})"><span><b>${esc(p.title)}</b><small>${esc(p.nextStep||p.summary||'')}</small></span>${pill(p.status)}</button>`).join('')||'<div class="empty">No projects in this phase.</div>'}</div>`,true)}
function openReadinessGate(phase){const target=WORKFLOW_PHASE_ORDER[phase]??0,ps=db.projects.filter(p=>p.phase!=='later'&&(WORKFLOW_PHASE_ORDER[p.phase]??0)<=target&&p.status!=='Done').sort(compareWorkflowProjects);openModal(`${modalHeader(`${phaseLabel(phase)} Gate`,`${ps.length} open item${ps.length===1?'':'s'} at or before this gate`)}<div class="workflow-modal-list">${ps.map(p=>`<button class="workflow-modal-row" onclick="openProjectDetail(${p.id})"><span><b>${esc(p.title)}</b><small>${esc(phaseShort(p.phase))} • ${esc(p.nextStep||'No next step')}</small></span>${pill(p.priority)}</button>`).join('')||'<div class="empty">No open project items in this gate.</div>'}</div>`,true)}

// Dashboard gets a compact workflow shortcut without replacing the existing dashboard.
const renderDashboardWorkflowBase=renderDashboard;
renderDashboard=function(){renderDashboardWorkflowBase();const page=document.getElementById('page-dashboard');if(!page)return;const start=phaseGateInfo('engine-start'),flight=phaseGateInfo('flight'),focus=db.projects.filter(p=>p.status!=='Done'&&p.focusToday).length;const strip=document.createElement('div');strip.className='card dashboard-readiness-strip';strip.innerHTML=`<button onclick="navTo('readiness')"><span>Project Readiness</span><b>${workflowOverallPercent()}%</b></button><button onclick="openReadinessGate('engine-start')"><span>Before Engine Start</span><b>${start.open.length} open</b></button><button onclick="openReadinessGate('flight')"><span>Before Flight</span><b>${flight.open.length} open</b></button><button onclick="navTo('readiness')"><span>Today’s Focus</span><b>${focus}</b></button>`;page.insertBefore(strip,page.firstChild)};

// Readiness rendering/navigation is coordinated centrally by app-61-performance.
