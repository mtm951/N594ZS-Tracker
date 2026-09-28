import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-69-commissioning-readiness.js',import.meta.url),'utf8');
let modal='';
const db={
  checklists:[
    {
      id:'pack-a',name:'Engine prerequisites',commissioningReadinessPack:true,
      items:[
        {id:'a1',text:'Completed prerequisite',done:true,requiredBefore:'first-start'},
        {id:'a2',text:'Open start blocker',done:false,requiredBefore:'first-start'},
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
  ]
};
const head={appendChild(){}};
const ctx={
  console,window:null,db,
  esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  modalHeader:(title,subtitle='')=>'<h2>'+title+'</h2><div>'+subtitle+'</div>',
  openModal:html=>{modal=html},
  closeModal(){},navTo(){},openChecklistDetail(){},
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

ctx.openCommissioningReadiness();
assert.deepEqual(ctx.pageTargets,['readiness'],'Readiness Overview did not use atomic modal-to-page navigation');

console.log('commissioning readiness cumulative gate regression tests passed');
