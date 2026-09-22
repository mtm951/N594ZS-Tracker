import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const projectSource=fs.readFileSync(new URL('../app-06-projects.js',import.meta.url),'utf8');

function fakeElement(){
  return {
    id:'',textContent:'',innerHTML:'',value:'',
    appendChild(){},remove(){},addEventListener(){},insertAdjacentHTML(){},
    querySelector(){return null},querySelectorAll(){return []},
    classList:{add(){},remove(){},toggle(){}}
  };
}
function makeHarness(values={}){
  let nextId=900;
  const saves=[],alerts=[],closeouts=[];
  const db={
    projects:[{
      id:109,
      title:'Electrical final inspection',
      system:'Electrical',
      priority:'High',
      status:'In Progress',
      trigger:'Before engine start',
      percent:65,
      summary:'Existing summary',
      plan:'Existing plan',
      blockers:'Waiting on light',
      nextStep:'Install warning light',
      partsUsed:[{id:1,partId:206,name:'EarthX',qty:1}],
      plannedParts:[{id:2,partId:300,name:'LED',qty:1}],
      updates:[{id:3,date:'2026-09-20',text:'Prior update'}],
      steps:[{id:4,text:'Test',done:false}],
      completionCriteria:'Lamp works',
      linkedSomething:['keep'],
      customMetadata:{owner:'Mike'}
    }],
    parts:[],orders:[],logs:[],docs:[],checklists:[],
    settings:{showCosts:true}
  };
  const document={
    head:{appendChild(){}},
    createElement:()=>fakeElement(),
    getElementById:()=>null,
    querySelectorAll:()=>[]
  };
  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,Date,Math,Promise,
    structuredClone,
    window:null,document,
    RECORD_ARRAYS:{project:'projects'},
    db,
    arr:v=>Array.isArray(v)?v:[],
    num:v=>Number(v)||0,
    uid:()=>++nextId,
    today:()=> '2026-09-21',
    val:id=>String(values[id]??''),
    selectedNumber:()=>null,
    saveDB:message=>saves.push(message),
    alert:message=>alerts.push(message),
    confirm:()=>true,
    closeModal:()=>{},
    openModal:()=>{},
    modalHeader:()=>'',field:()=>'',textareaField:()=>'',systemOptions:()=>'',esc:x=>String(x??''),
    pill:x=>String(x??''),fmtMoney:x=>String(x??''),projectCost:()=>0,consumedCost:()=>0,
    isClosedOrder:()=>false,
    projectById:id=>db.projects.find(x=>String(x.id)===String(id)),
    partById:()=>null,partName:()=>'',logById:()=>null,docById:()=>null,
    partAvailable:()=>null,partOptions:()=>'',selectOptions:()=>'',projectName:()=>'',orderTotal:()=>0,
    chooseAttachments:()=>{},handleEntityDrop:()=>{},renderAttachments:()=>Promise.resolve(),
    openPartDetail:()=>{},openLogDetail:()=>{},openDocumentDetail:()=>{},openChecklistDetail:()=>{},
    openOrderDetail:()=>{},openOrderModal:()=>{},openLogModal:()=>{},openDocModal:()=>{},
    addEntityUpdate:()=>{},
    currentDetail:null
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(storeSource,context,{filename:'app-17a-data-store.js'});
  vm.runInContext(projectSource,context,{filename:'app-06-projects.js'});
  context.openProjectCloseoutReview=(id,pending)=>closeouts.push({id,pending:structuredClone(pending)});
  return {context,db,saves,alerts,closeouts};
}

// Ordinary edit uses trackerStore and preserves project relationships/nested workflow state.
{
  const h=makeHarness({
    prTitle:'Electrical final inspection / first start',
    prSystem:'Electrical',
    prPriority:'High',
    prStatus:'In Progress',
    prTrigger:'Before first engine start',
    prPercent:'80',
    prSummary:'Updated summary',
    prPlan:'Updated plan',
    prBlockers:'',
    prNext:'Function-test EarthX lamp'
  });
  h.context.saveProject(109);

  const p=h.db.projects[0];
  assert.equal(p.title,'Electrical final inspection / first start');
  assert.equal(p.percent,80);
  assert.equal(p.blockers,'');
  assert.equal(p.nextStep,'Function-test EarthX lamp');
  assert.deepEqual(p.partsUsed,[{id:1,partId:206,name:'EarthX',qty:1}]);
  assert.deepEqual(p.plannedParts,[{id:2,partId:300,name:'LED',qty:1}]);
  assert.deepEqual(p.updates,[{id:3,date:'2026-09-20',text:'Prior update'}]);
  assert.deepEqual(p.steps,[{id:4,text:'Test',done:false}]);
  assert.equal(p.completionCriteria,'Lamp works');
  assert.deepEqual(p.linkedSomething,['keep']);
  assert.equal(p.customMetadata.owner,'Mike');
  assert.deepEqual(h.saves,['Project updated.']);
}

// New project creation goes through the store boundary and keeps the existing record shape.
{
  const h=makeHarness({
    prTitle:'First ground run cleanup',
    prSystem:'Engine',
    prPriority:'Medium',
    prStatus:'Open',
    prTrigger:'After first start',
    prPercent:'10',
    prSummary:'Capture follow-up work',
    prPlan:'Inspect after run',
    prBlockers:'',
    prNext:'Run engine'
  });
  h.context.saveProject(null);

  assert.equal(h.db.projects.length,2);
  const p=h.db.projects[1];
  assert.equal(p.id,901);
  assert.equal(p.title,'First ground run cleanup');
  assert.equal(p.system,'Engine');
  assert.equal(p.percent,10);
  assert.deepEqual(p.partsUsed,[]);
  assert.deepEqual(p.updates,[]);
  assert.deepEqual(h.saves,['Project created.']);
}

// Moving an active project to Done still goes through the dedicated closeout review,
// with no record mutation or persistence before the user confirms closeout.
{
  const h=makeHarness({
    prTitle:'Electrical final inspection',
    prSystem:'Electrical',
    prPriority:'High',
    prStatus:'Done',
    prTrigger:'Before engine start',
    prPercent:'90',
    prSummary:'Ready',
    prPlan:'Done',
    prBlockers:'',
    prNext:''
  });
  const before=structuredClone(h.db.projects[0]);
  h.context.saveProject(109);

  assert.deepEqual(h.db.projects[0],before);
  assert.equal(h.saves.length,0);
  assert.equal(h.closeouts.length,1);
  assert.equal(h.closeouts[0].id,109);
  assert.equal(h.closeouts[0].pending.status,'Done');
}

// Editing a project that is already Done remains an ordinary edit, forces 100%, and preserves history.
{
  const h=makeHarness({
    prTitle:'Completed electrical inspection',
    prSystem:'Electrical',
    prPriority:'High',
    prStatus:'Done',
    prTrigger:'Completed',
    prPercent:'50',
    prSummary:'Final notes edited',
    prPlan:'Archived',
    prBlockers:'',
    prNext:''
  });
  h.db.projects[0].status='Done';
  h.db.projects[0].percent=100;
  h.context.saveProject(109);

  const p=h.db.projects[0];
  assert.equal(p.status,'Done');
  assert.equal(p.percent,100);
  assert.equal(p.summary,'Final notes edited');
  assert.equal(p.updates.length,1);
  assert.equal(p.steps.length,1);
  assert.equal(h.closeouts.length,0);
  assert.deepEqual(h.saves,['Project updated.']);
}

// Existing validation still blocks blank project titles.
{
  const h=makeHarness({
    prTitle:'',prSystem:'Electrical',prPriority:'High',prStatus:'In Progress',
    prTrigger:'',prPercent:'50',prSummary:'',prPlan:'',prBlockers:'',prNext:''
  });
  const before=structuredClone(h.db.projects[0]);
  h.context.saveProject(109);
  assert.deepEqual(h.db.projects[0],before);
  assert.equal(h.saves.length,0);
  assert.equal(h.alerts.length,1);
}

console.log('project tracker-store regression tests passed');
