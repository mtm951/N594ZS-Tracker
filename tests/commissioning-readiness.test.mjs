import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-69-commissioning-readiness.js',import.meta.url),'utf8');
let modal='';
const db={
  checklists:[
    {
      id:'pack-a',name:'Engine prerequisites',commissioningReadinessPack:true,projectId:77,
      items:[
        {id:'a1',text:'Completed prerequisite',done:true,requiredBefore:'first-start'},
        {id:'a2',text:'Open start blocker',done:false,requiredBefore:'first-start',group:'Fuel',sourceDocumentId:'manual-1',sourcePage:'p.7',moreInfo:'Verify the installed configuration before proceeding.',note:'Owner review still pending.'},
        {id:'a3',text:'Open ground blocker',done:false,requiredBefore:'full-power'}
      ]
    },
    {
      id:'pack-b',name:'Flight closeout',commissioningReadinessPack:true,
      items:[
        {id:'b1',text:'Open flight blocker',done:false,requiredBefore:'flight'}
      ]
    },
    {id:'ordinary',name:'Ordinary checklist',items:[{id:'x',done:false}]}
  ],
  projects:[{id:77,title:'912 installation closeout',status:'In Progress'}],
  docs:[{id:'manual-1',name:'Commissioning Source Manual'}]
};
const head={appendChild(){}};
const openedRequirements=[],openedProjects=[],openedSources=[],recorderStarts=[];
const ctx={
  console,window:null,db,
  esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  modalHeader:(title,subtitle='')=>'<h2>'+title+'</h2><div>'+subtitle+'</div>',
  openModal:html=>{modal=html},
  closeModal(){},navTo(){},openChecklistDetail(){},
  openChecklistDetailAtItem:(cid,iid)=>openedRequirements.push([String(cid),String(iid)]),
  projectById:id=>db.projects.find(x=>String(x.id)===String(id))||null,
  docById:id=>db.docs.find(x=>String(x.id)===String(id))||null,
  checklistItemSourceDoc:(checklist,item)=>ctx.docById(item?.sourceDocumentId||checklist?.sourceDocumentId||checklist?.documentId),
  openProjectDetail:id=>openedProjects.push(String(id)),
  openSourceReference:async(doc,citation)=>{openedSources.push([String(doc.id),String(citation)]);return true},
  openFirstStartRecorder:()=>recorderStarts.push('start'),
  pageTargets:[],
  goToTrackerPageFromModal(page){ctx.pageTargets.push(page);return true},
  renderReadiness(){},renderDashboard(){},
  setTimeout:fn=>{fn();return 1},
  document:{
    head,
    createElement:()=>({id:'',textContent:''}),
    getElementById:()=>null
  }
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'app-69-commissioning-readiness.js'});

assert.equal(ctx.commissioningPacks().length,2,'ordinary checklist leaked into commissioning readiness');

const overall=ctx.commissioningOverallInfo();
assert.deepEqual(JSON.parse(JSON.stringify(overall)),{total:4,done:1,open:3,pct:25});

const start=ctx.commissioningGateInfo('first-start');
assert.equal(start.total,2);
assert.equal(start.done,1);
assert.equal(start.open,1);
assert.equal(start.clear,false);
assert.equal(start.rows.length,1);
assert.equal(start.rows[0].next.id,'a2');
assert.deepEqual(start.rows[0].items.map(x=>x.id),['a1','a2']);

const ground=ctx.commissioningGateInfo('full-power');
assert.equal(ground.total,3,'full-power gate did not include first-start requirements');
assert.equal(ground.done,1);
assert.equal(ground.open,2);
assert.equal(ground.rows[0].open.length,2);

const flight=ctx.commissioningGateInfo('flight');
assert.equal(flight.total,4,'flight gate did not include all earlier requirements');
assert.equal(flight.done,1);
assert.equal(flight.open,3);
assert.equal(flight.rows.length,2);

ctx.openCommissioningGate('full-power');
assert.match(modal,/Full-Power Ground Run Gate/);
assert.match(modal,/1\/3 required items complete/);
assert.match(modal,/Dependency:/);
assert.match(modal,/First Start/);
assert.match(modal,/Engine prerequisites/);
assert.match(modal,/Open start blocker/);
assert.match(modal,/data-commissioning-checklist="pack-a"/);
assert.match(modal,/onclick="openChecklistDetail\('pack-a'\)"/);
assert.match(modal,/Requirements in this gate/);
assert.match(modal,/3 cumulative requirements/);
assert.match(modal,/Completed prerequisite/);
assert.match(modal,/Open ground blocker/);
assert.match(modal,/Complete/);
assert.match(modal,/Open/);
assert.match(modal,/Full-Power/);
assert.match(modal,/Expand all/);
assert.match(modal,/Collapse all/);
assert.match(modal,/Open checklist/);
assert.match(modal,/Pending verification/);
assert.match(modal,/Not yet checked complete in the source checklist/);
assert.match(modal,/Verify the installed configuration before proceeding/);
assert.match(modal,/Review note:<\/b> Owner review still pending/);
assert.match(modal,/Commissioning Source Manual/);
assert.match(modal,/Project: In Progress/);
assert.match(modal,/Open requirement →/);
assert.match(modal,/Open next requirement/);
assert.match(modal,/openChecklistDetailAtItem\(&quot;pack-a&quot;,&quot;a2&quot;\)/);
assert.match(modal,/openCommissioningRequirementSource\(&quot;pack-a&quot;,&quot;a2&quot;\)/);
assert.match(modal,/openProjectDetail\(77\)/);
await ctx.openCommissioningRequirementSource('pack-a','a2');
assert.deepEqual(openedSources,[['manual-1','p.7']],'requirement Source did not use the shared source resolver');

db.checklists[0].items.find(x=>x.id==='a2').done=true;
ctx.openCommissioningGate('first-start');
assert.match(modal,/Gate requirements complete/);
assert.match(modal,/Start \/ Resume First Start Recorder/,'clear First Start gate did not hand off to the guided recorder');
assert.match(src,/View requirements →/,'gate cards do not visibly advertise drill-down behavior');

ctx.openCommissioningReadiness();
assert.deepEqual(ctx.pageTargets,['readiness'],'Readiness Overview did not use atomic modal-to-page navigation');

console.log('commissioning readiness cumulative gate regression tests passed');
