import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Integration test of the REAL workflow-phase and project-editor modules.
// All form input, projects and Readiness lists are disposable VM fixtures;
// no production cloud records are touched.
const workflow=fs.readFileSync(new URL('../app-20-workflow.js',import.meta.url),'utf8');
const editor=fs.readFileSync(new URL('../app-52-project-editor-polish.js',import.meta.url),'utf8');

function harness(project){
  const db={projects:[{id:104,title:'Resolve airspeed indicator issue',
    status:'Open',priority:'Low',percent:33,steps:[],updates:[],...project}],
    orders:[],checklists:[],settings:{}};
  const nodes={},openViews=[],saves=[],formHTML=[];
  let editingId=null,modalHTML='';
  function element(value=''){
    return {value,innerHTML:'',textContent:'',style:{},dataset:{},parentElement:null,
      classList:{add(){},remove(){}},
      handlers:{},appendChild(node){(this.children??=[]).push(node)},
      addEventListener(name,cb){this.handlers[name]=cb},
      remove(){this.removed=true},querySelector(){return null},querySelectorAll(){return []}};
  }
  let prior='';
  const holder=element();
  Object.defineProperty(holder,'innerHTML',{
    get(){return this.markup||''},
    set(markup){
      this.markup=markup;
      nodes.prReadinessSelectSlot=element();
      nodes.prReadinessLinkHint=element();
      nodes.prTrigger=element(prior);
      const note=markup.match(/id="prTriggerNote" value="([^"]*)"/);
      nodes.prTriggerNote=element(note?.[1]||'');
    }
  });
  const workflowForm={
    appendChild(wrap){
      formHTML.push(wrap.innerHTML);
      const p=editingId==null?{phase:'build'}:
        db.projects.find(x=>String(x.id)===String(editingId));
      nodes.prPhase=element(p?.phase||'build');
      const parent=element();nodes.prPhase.parentElement=parent;
      nodes.prFocusToday={checked:false};
      nodes.prStepsDrive={checked:false};
      nodes.prCompletionCriteria=element('');
    }
  };
  const document={
    head:{appendChild(){}},
    createElement:()=>element(),
    getElementById:id=>nodes[id]||null,
    querySelector:selector=>selector==='#modalBox .form-grid'?workflowForm:null,
    querySelectorAll:()=>[]
  };
  let uid=900;
  const ctx={
    window:null,document,console,JSON,Number,Map,Set,Date,String,Array,Math,
    queueMicrotask:()=>{},setTimeout:()=>{},
    db,NAV:[['projects','Projects']],normalizeDB:()=>{},
    arr:x=>Array.isArray(x)?x:[],num:x=>Number(x)||0,
    uid:()=>++uid,esc:x=>String(x??''),pill:x=>String(x??''),
    val:id=>String(nodes[id]?.value??''),
    projectById:id=>db.projects.find(p=>String(p.id)===String(id)),
    isClosedOrder:o=>['Received','Cancelled'].includes(o.status),
    modalHeader:(title,subtitle='')=>'<h2>'+title+'</h2><small>'+subtitle+'</small>',
    openModal:html=>{modalHTML=html;openViews.push(html)},
    renderDashboard:()=>{},openProjectDetail:()=>{},
    saveDB:()=>saves.push('saved'),
    // Minimal base project editor/save; the REAL workflow save wrapper reads
    // the moved #prPhase, calls this base, and then persists phase.
    openProjectModal:id=>{
      editingId=id;
      const p=id==null?{trigger:'',phase:'build'}:
        db.projects.find(x=>String(x.id)===String(id));
      prior=p?.trigger||'';
      nodes.prTrigger=element(prior);
      nodes.prTrigger.parentElement=holder;
    },
    saveProject:id=>{
      let p=id==null?null:db.projects.find(x=>String(x.id)===String(id));
      if(!p){p={id:++uid,title:'New project',status:'Open',trigger:''};db.projects.push(p);}
      p.trigger=nodes.prTrigger.value;
    }
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(workflow,ctx,{filename:'app-20-workflow.js'});
  vm.runInContext(editor,ctx,{filename:'app-52-project-editor-polish.js'});
  return {ctx,db,nodes,holder,openViews,saves,formHTML,modal:()=>modalHTML};
}

// The select is the real #prPhase created from WORKFLOW_PHASES, moved
// physically into the Due/Trigger position. It is not a second unlinked
// static trigger menu.
{
  const h=harness({phase:'engine-start',trigger:'Before Engine Start'});
  h.ctx.openProjectModal(104);
  assert.match(h.holder.innerHTML,/Readiness list \/ when required/);
  assert.match(h.holder.innerHTML,/Additional due \/ trigger note/);
  assert.match(h.formHTML[0],/Before Flight/);
  assert.equal(h.nodes.prReadinessSelectSlot.children[0],h.nodes.prPhase);
  assert.equal(h.nodes.prPhase.parentElement.removed,true,
    'redundant second phase selector should be removed');
  assert.equal(h.nodes.prTriggerNote.value,'','existing canonical label is not a custom note');
  // Merely viewing the editor must not rewrite the stored Project.
  assert.equal(h.db.projects[0].phase,'engine-start');
  h.nodes.prPhase.value='flight';
  h.nodes.prPhase.handlers.change();
  assert.equal(h.nodes.prTrigger.value,'Before Flight');
  assert.match(h.nodes.prReadinessLinkHint.textContent,/Readiness → Before Flight/);
  h.ctx.saveProject(104);
  assert.equal(h.db.projects[0].phase,'flight');
  assert.equal(h.db.projects[0].trigger,'Before Flight');
  assert.equal(h.saves.length,1);
  // Both the actual Readiness phase list and its cumulative gate now include
  // the project; the unrelated engine-start phase list no longer does.
  h.ctx.openPhaseProjects('flight');
  assert.match(h.modal(),/Resolve airspeed indicator issue/);
  h.ctx.openPhaseProjects('engine-start');
  assert.doesNotMatch(h.modal(),/Resolve airspeed indicator issue/);
  assert.equal(h.ctx.phaseGateInfo('flight').open.length,1);
  assert.equal(h.ctx.phaseGateInfo('engine-start').open.length,0);
}

// Existing custom trigger notes must not be lost or silently treated as
// readiness categories. Selection still changes the actual phase.
{
  const h=harness({phase:'rts',trigger:'After independent inspector review'});
  h.ctx.openProjectModal(104);
  assert.equal(h.nodes.prPhase.value,'rts');
  assert.equal(h.nodes.prTriggerNote.value,'After independent inspector review');
  h.nodes.prPhase.value='flight';
  h.nodes.prPhase.handlers.change();
  assert.equal(h.nodes.prTrigger.value,'After independent inspector review');
  h.ctx.saveProject(104);
  assert.equal(h.db.projects[0].phase,'flight');
  assert.equal(h.db.projects[0].trigger,'After independent inspector review');
  assert.equal(h.ctx.phaseGateInfo('flight').open.length,1);
  h.nodes.prTriggerNote.value='';
  h.ctx.projectReadinessNoteChanged();
  assert.equal(h.nodes.prTrigger.value,'Before Flight');
}

// Legacy aliases (notably the previously typed "Before flight") still
// identify the matching stage and don't create a duplicate custom field.
{
  const h=harness({phase:'flight',trigger:'Before flight'});
  h.ctx.openProjectModal(104);
  assert.equal(h.nodes.prTriggerNote.value,'');
  assert.equal(h.nodes.prPhase.value,'flight');
  h.ctx.saveProject(104);
  assert.equal(h.db.projects[0].trigger,'Before flight',
    'opening and saving must not erase an existing valid legacy trigger');
  assert.equal(h.db.projects[0].phase,'flight');
}

// A contradictory legacy custom trigger is visible, not silently migrated
// to a different Readiness list. The user can explicitly correct the phase.
{
  const h=harness({phase:'later',trigger:'Before flight'});
  h.ctx.openProjectModal(104);
  assert.equal(h.nodes.prPhase.value,'later');
  assert.equal(h.nodes.prTriggerNote.value,'',
    'a known Readiness label must not masquerade as a custom deadline');
  assert.match(h.holder.innerHTML,/Your saved trigger says Before flight/);
  assert.match(h.holder.innerHTML,/currently in Later \/ Optional/);
  assert.equal(h.db.projects[0].phase,'later','opening the editor must not silently reassign an old Project');
  h.nodes.prPhase.value='flight';h.nodes.prPhase.handlers.change();
  assert.equal(h.nodes.prTrigger.value,'Before Flight');
  h.ctx.saveProject(104);
  assert.equal(h.db.projects[0].phase,'flight');
  assert.equal(h.db.projects[0].trigger,'Before Flight');
  h.ctx.openPhaseProjects('flight');
  assert.match(h.modal(),/Resolve airspeed indicator issue/);
}

// New projects also select the same canonical phase list and are available
// on that actual Readiness page after saving.
{
  const h=harness({phase:'ground',trigger:'Before Ground Test'});
  h.ctx.openProjectModal(null);
  assert.equal(h.nodes.prPhase.value,'build');
  h.nodes.prPhase.value='flight';
  h.nodes.prPhase.handlers.change();
  h.ctx.saveProject(null);
  assert.equal(h.db.projects.length,2);
  const added=h.db.projects.find(p=>p.title==='New project');
  assert.equal(added.phase,'flight');
  assert.equal(added.trigger,'Before Flight');
  h.ctx.openPhaseProjects('flight');
  assert.match(h.modal(),/New project/);
}

// The actual saved phase also remains linked in the project-detail workflow
// card, rather than presenting a second, static date label.
assert.match(workflow,/title="Open this Readiness list"/);
assert.match(workflow,/openPhaseProjects/);

console.log('Canonical Readiness dropdown, legacy notes, phase-save and actual-list integration tests passed');
