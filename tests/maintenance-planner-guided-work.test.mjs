import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('app-75-maintenance-planner-guided-work.js');
const index=read('index.html');
const seed=read('app-01-seed.js');
const perf=read('app-61-performance.js');
const make=()=>({
  projects:[
    {id:101,title:'Inspect coolant plumbing',phase:'engine-start',priority:'High',status:'Open',
      steps:[{id:1,text:'Inspect clamps',order:1,done:false},{id:2,text:'Record observations',order:2,done:false}],
      dependsOnIds:[],plannedParts:[{partId:201,qty:2}],stepsDriveProgress:true,percent:0,blockers:''},
    {id:102,title:'Oil system purge',phase:'engine-start',priority:'High',status:'Open',
      steps:[{id:11,text:'Review current manual',order:1,done:false}],dependsOnIds:[],
      plannedParts:[],blockers:'Need an air hose adapter',percent:0},
    {id:103,title:'First engine run / ground test',phase:'ground',priority:'High',
      status:'Open',dependsOnIds:[101,102],steps:[{id:12,text:'Start engine',done:false,order:1}],
      plannedParts:[],blockers:''},
    {id:104,title:'Inspect electrical ground',phase:'build',priority:'Medium',status:'In Progress',
      steps:[{id:50,text:'Check continuity',order:1,done:false}],plannedParts:[],dependsOnIds:[],
      blockers:''},
    {id:105,title:'Inspect fuel controls',phase:'flight',priority:'High',status:'Open',
      steps:[],plannedParts:[],dependsOnIds:[],blockers:''},
    {id:106,title:'Inspect fuel tank',phase:'build',priority:'Low',status:'Done',
      steps:[{id:61,text:'Done',done:true}],plannedParts:[]},
    {id:107,title:'First flight readiness',phase:'flight',priority:'Medium',status:'Open',
      dependsOnIds:[],steps:[{id:70,text:'Review flight readiness',done:false}],plannedParts:[]}
  ],
  parts:[{id:201,name:'Hose clamp',stockQty:4,unit:'ea'}],
  orders:[],
  logs:[],
  checklists:[
    {id:601,projectId:105,name:'Rotax fuel controls',items:[
      {id:'m1',text:'Inspect throttle cable security',done:false,sourcePage:25},
      {id:'m2',text:'Inspect full travel',done:false,sourcePage:26}
    ]}
  ]
});
const logs=[];
let db=make(),uid=7000,modalHTML='',closed=false,root=null,
  inputValues={notes:'',reading:'',unit:''},alerts=[],confirmValue=true,
  gate={clear:false,open:3},projectWrites=0,storeMessages=[],
  logModalCount=0,readyToOpenLog=false;
const doc={
  head:{appendChild(){}},
  createElement:()=>({textContent:'',style:{},dataset:{},addEventListener(){}}),
  getElementById(id){
    if(id==='guidedWorkSessionRoot')return root;
    if(id==='mpWorkNote')return {value:inputValues.notes};
    if(id==='mpReading')return {value:inputValues.reading};
    if(id==='mpUnits')return {value:inputValues.unit};
    if(readyToOpenLog){
      const fieldValues={lgWork:'',lgObservations:'',lgBlockers:'',lgNext:'',lgNotes:''};
      if(id in fieldValues)return fieldValues[id];
    }
    return null;
  },
  querySelector(){return null}
};
const ctx={
  console,document:doc,window:null,db,Date,Number,Math,String,JSON,Set,Map,
  partAvailable:p=>p.stockQty,
  partReservedQty:()=>2,
  uid:()=>++uid,
  trackerStore:{
    update(type,id,mutate,options){
      assert.equal(type,'project');const p=db.projects.find(x=>String(x.id)===String(id));
      assert.ok(p,'project record missing');
      const clone=structuredClone(p);
      mutate(clone);
      Object.assign(p,clone);projectWrites++;
      storeMessages.push(options?.message||'');
    }
  },
  canCloudEdit:()=>true,
  blockPendingProjectEdit:()=>false,
  atomicReceiptOutbox:{isPendingRecord:()=>false},
  commissioningGateInfo:()=>gate,
  modalHeader:(title,subtitle)=>'<header>'+title+' '+subtitle+'</header>',
  openModal:html=>{
    modalHTML=String(html);closed=false;
    root={innerHTML:'',handlers:{},addEventListener(ev,callback){this.handlers[ev]=callback;}};
  },
  closeModal:()=>{closed=true;root=null;},
  confirm:()=>confirmValue,
  alert:message=>{alerts.push(String(message));},
  openProjectDetail(){},
  renderDashboard(){},
  openLogModal(){logModalCount++;readyToOpenLog=true;},
  navTo(){},
  syncProjectProgressFromSteps:p=>{if(p.stepsDriveProgress)p.percent=Math.round(p.steps.filter(x=>x.done).length/p.steps.length*100);}
};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:'app-75-maintenance-planner-guided-work.js'});
const planner=ctx.N594ZSMaintenancePlanner;
assert.ok(planner);

let assessed=planner.collect(db,{
  onHand:p=>p.stockQty,reserved:()=>2
});
const coolant=assessed.find(a=>a.project.id===101);
assert.equal(coolant.actionable,true,'project reservation of two is not a shortage by itself');
const oil=assessed.find(a=>a.project.id===102);
assert.equal(oil.actionable,false,'project manually recorded blocker must count');
const first=assessed.find(a=>a.project.id===103);
assert.equal(first.gateBlocked,true,'first engine run is held by commissioning requirements');
assert.ok(first.blockers.some(x=>x.includes('First Start')));
const flight=assessed.find(a=>a.project.id===107);
assert.equal(flight.gateBlocked,true,'flight project cannot bypass missing flight gate');
assert.equal(assessed.length,6,'completed project omitted');

let recommended=planner.recommend(db,30,{onHand:p=>p.stockQty,reserved:()=>2});
assert.equal(recommended.all[0].actionable,true);
assert.ok(recommended.blocked.some(x=>x.project.id===103));
assert.equal(recommended.budget,30);
assert.equal(planner.cards(db.projects.find(p=>p.id===105),db).length,2,'use actual source Checklist when no Project steps');
assert.equal(planner.cards(db.projects.find(p=>p.id===105),db)[0].sourcePage,25);
assert.equal(planner.cards(db.projects.find(p=>p.id===102),db)[0].text,'Review current manual');

const shortage=planner.partShortages(db.projects[0],db,{onHand:()=>2,reserved:()=>4});
assert.ok(shortage[0].includes('Insufficient'), 'other project reservations produce shortage');
assert.equal(planner.partShortages(db.projects[0],db,{onHand:()=>4,reserved:()=>2}).length,0);
assert.equal(projectWrites,0,'recommendations are entirely read-only');

// Actual session begins only when requested; writes new durable project session.
planner.start(101);
assert.equal(projectWrites,1);
assert.match(modalHTML,/Guided Work Session/);
assert.match(root.innerHTML,/Inspect clamps/);
assert.match(root.innerHTML,/Save Progress/);
assert.match(root.innerHTML,/Flag Finding/);
assert.match(root.innerHTML,/Complete Task &amp; Next|Complete Task & Next/);
assert.equal(db.projects[0].steps[0].done,false,'starting a session does not complete tasks');
const sessionId=db.projects[0].guidedWorkSessions[0].id;
function click(action){
  assert.ok(root?.handlers.click,'session click handler missing');
  root.handlers.click({target:{closest:selector=>selector==='[data-gws-action]'?({
    getAttribute:name=>name==='data-gws-action'?action:null
  }):null}});
}
inputValues={notes:'Observed intact clamp',reading:'1.2',unit:'in. clearance'};
click('save');
assert.equal(db.projects[0].guidedWorkSessions[0].cards['project:1'].notes,'Observed intact clamp');
assert.equal(db.projects[0].guidedWorkSessions[0].cards['project:1'].reading,'1.2');
assert.equal(db.projects[0].steps[0].done,false,'Save Progress does not complete project steps');
click('complete');
assert.equal(db.projects[0].steps[0].done,true);
assert.equal(db.projects[0].percent,50);
assert.equal(db.projects[0].guidedWorkSessions[0].cursor,1);
assert.match(root.innerHTML,/Record observations/);
assert.equal(logModalCount,0,'completing card cannot auto-write a Work Log');
assert.equal(db.parts[0].stockQty,4,'no physical inventory changes');

// Flag a finding, ensure it blocks future suggested work, and pause/resume it.
inputValues={notes:'Sender reading inconsistent',reading:'13',unit:'psi engine off'};
click('flag');
assert.equal(db.projects[0].guidedWorkSessions[0].cards['project:2'].status,'finding');
assert.ok(planner.collect(db).find(x=>x.project.id===101).blockers.some(x=>x.includes('unresolved finding')));
click('pause');
assert.equal(db.projects[0].guidedWorkSessions[0].status,'paused');
assert.equal(closed,true);
planner.start(101);
assert.equal(db.projects[0].guidedWorkSessions.length,1,'resume existing session; no duplicate');
assert.equal(db.projects[0].guidedWorkSessions[0].id,sessionId);
inputValues={notes:'Correction documented',reading:'0',unit:'psi engine off'};
click('resolve');
assert.equal(db.projects[0].guidedWorkSessions[0].cards['project:2'].status,'open');
assert.ok(!planner.collect(db).find(x=>x.project.id===101).blockers.some(x=>x.includes('unresolved finding')));
click('worklog');
assert.equal(logModalCount,1,'Work Log draft opens only by user action');
assert.equal(db.parts[0].stockQty,4);
assert.equal(db.logs.length,0);

// Source-backed inspection session may record review, but must NOT sign off source items.
planner.start(105);
assert.match(root.innerHTML,/source page 25/);
assert.match(root.innerHTML,/not verified/);
inputValues={notes:'Inspected; needs formal sign-off',reading:'',unit:''};
click('review');
assert.equal(db.checklists[0].items[0].done,false,'source-backed checklist must remain unverified');
assert.equal(db.projects.find(p=>p.id===105).guidedWorkSessions[0].cards['checklist:601:m1'].status,'completed');

// Guard First Start with missing/unverified cumulative gate: fail closed.
const initialCount=projectWrites;
gate=null;
planner.start(103);
assert.equal(projectWrites,initialCount,'no first-run work session when gate is unavailable');
assert.match(alerts.at(-1),/Commissioning prerequisite gate/);

assert.match(index,/id="page-planner"/);
assert.match(index,/app-75-maintenance-planner-guided-work\.js\?v=5\.19\.82/);
assert.match(perf,/planner:\['renderMaintenancePlanner'\]/);
assert.match(seed,/\['planner','Planner'\]/);
assert.match(seed,/APP_VERSION='5\.19\.82'/);
assert.doesNotMatch(source,/addConsumedPart\(|applyOrderReceipt\(/,'guided workflow cannot duplicate inventory transactions');
assert.doesNotMatch(source,/saveLog\(/,'Work Log must be explicitly reviewed and saved in canonical editor');
console.log('PASS: dependency-aware planner, commissioning fail-closed, parts reservations, guided project and source checklist cards, finding, resume, and no double-consumption');
