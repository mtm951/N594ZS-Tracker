import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-70-first-start-recorder.js',import.meta.url),'utf8');

function harness({gateClear=true}={}){
  let uidCounter=10000,lastModal='',alerts=[],messages=[];
  const elements=new Map();
  const mk=(id,value='')=>{const el={id,value:String(value),checked:false,dataset:{},classList:{toggle(){},add(){},remove(){}}};elements.set(id,el);return el};
  mk('crStartTach','12.3');mk('crStartNote','Initial commissioning');const pp=mk('crPostPurge','');pp.checked=true;

  const checklist={
    id:'c7c96b1e-56e0-40c5-b33c-ce6984a8f12d',name:'ROTAX 912 ULS — First Start / Initial Ground Run',
    items:[
      {id:'FS-P1',text:'Prerequisite',done:gateClear,requiredBefore:'first-start',group:'Gate'},
      {id:'1',text:'Fuel valve OPEN',done:false,requiredBefore:'full-power',group:'Start',sourceDocumentId:'om',sourcePage:'4-7',moreInfo:'Open the fuel valve.'},
      {id:'2',text:'Oil pressure response',done:false,requiredBefore:'flight',group:'Immediate after start',sourceDocumentId:'om',sourcePage:'4-7',moreInfo:'Observe pressure.'}
    ]
  };
  const db={
    aircraft:{airframeHours:'456.7',engineHours:'12.3'},
    checklists:[checklist],runs:[],squawks:[],logs:[],docs:[{id:'om',name:'ROTAX OM'}],projects:[{id:102,title:'912 install'}],
    settings:{showCosts:true}
  };
  const recordArrays={checklist:'checklists',run:'runs',squawk:'squawks',log:'logs'};
  const same=(a,b)=>String(a??'')===String(b??'');
  const copy=v=>structuredClone(v);
  const trackerStore={
    read(type,id){return copy(db[recordArrays[type]].find(x=>same(x.id,id))||null)},
    write(type,id,value,opts={}){const rows=db[recordArrays[type]],i=rows.findIndex(x=>same(x.id,id));const v=copy(value);if(i>=0)rows[i]=v;else rows.push(v);if(opts.message)messages.push(opts.message);return copy(v)},
    update(type,id,fn,opts={}){const rows=db[recordArrays[type]],i=rows.findIndex(x=>same(x.id,id));assert.ok(i>=0,'missing '+type+':'+id);const d=copy(rows[i]);fn(d);rows[i]=d;if(opts.message)messages.push(opts.message);return copy(d)},
    batch(fn,opts={}){fn(this);if(opts.message)messages.push(opts.message)}
  };

  const local=new Map();
  const ctx={
    console,window:null,db,RECORD_ARRAYS:recordArrays,trackerStore,
    Array,Object,String,Number,Boolean,Map,Set,Date,Math,Promise,JSON,
    structuredClone,
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
    document:{
      head:{appendChild(){}},
      createElement:()=>({id:'',textContent:'',className:'',style:{},innerHTML:'',appendChild(){},prepend(){}}),
      getElementById:id=>elements.get(id)||null
    },
    setTimeout:fn=>{fn();return 1},clearTimeout(){},setInterval:()=>1,clearInterval(){},queueMicrotask:fn=>fn(),
    alert:m=>alerts.push(String(m)),confirm:()=>true,
    esc:v=>String(v??''),today:()=> '2026-09-28',uid:()=>++uidCounter,
    nextNumericId:(rows,start)=>Math.max(start-1,...rows.map(x=>Number(x.id)||0))+1,
    checklistById:id=>db.checklists.find(x=>same(x.id,id)),
    docById:id=>db.docs.find(x=>same(x.id,id)),
    commissioningGateInfo:()=>({clear:gateClear,open:gateClear?0:1}),
    checklistReadinessGateLabel:g=>({'first-start':'Before First Start','full-power':'Before Full-Power','flight':'Before Flight'}[g]||g),
    modalHeader:(a,b='')=>'<h2>'+a+'</h2><div>'+b+'</div>',
    field:()=>'',textareaField:()=>'',openModal:html=>{lastModal=String(html)},closeModal(){},
    chooseAttachments(){},openDocumentDetail(){},openCommissioningGate(){},
    renderReadiness(){},openRunDetail(){},reopenDetail(){},
    currentDetail:null
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{filename:'app-70-first-start-recorder.js'});
  return {ctx,db,elements,alerts,messages,get modal(){return lastModal},setGate(v){gateClear=v;ctx.commissioningGateInfo=()=>({clear:v,open:v?0:1})}};
}

// Blocked First Start gate cannot create a production run, but offers preview.
{
  const h=harness({gateClear:false});
  h.ctx.openFirstStartRecorder();
  assert.equal(h.db.runs.length,0);
  assert.match(h.modal,/First Start gate is not clear/);
  assert.match(h.modal,/Preview Recorder/);
}

// Gate-clear start creates a durable Run/Test with guided steps only (not prerequisites).
{
  const h=harness({gateClear:true});
  h.ctx.createFirstStartRun();
  assert.equal(h.db.runs.length,1);
  const run=h.db.runs[0];
  assert.equal(run.type,'Engine Run');
  assert.equal(run.projectIds[0],102);
  assert.equal(run.commissioningRun.kind,'first-start');
  assert.equal(run.commissioningRun.runNumber,1);
  assert.equal(run.commissioningRun.postPurgeFirstStart,true);
  assert.deepEqual(run.commissioningRun.steps.map(x=>x.itemId),['1','2']);
  assert.ok(h.messages.some(x=>/Run #1 started/.test(x)));

  // Save Progress persists the current working state without advancing the checklist,
  // creating a formal reading snapshot, squawk, or Work Log.
  for(const [id,v] of [['crRpm','1800'],['crOilP','48'],['crFuelP','4.1'],['crBusV','13.9'],['crStepNote','Warm-up looks normal']]){
    let el=h.elements.get(id);if(!el){el={id,value:'',checked:false,dataset:{},classList:{toggle(){},add(){},remove(){}}};h.elements.set(id,el)}
    el.value=v;
  }
  h.ctx.saveCommissioningProgress(run.id);
  assert.equal(h.db.checklists[0].items.find(x=>x.id==='1').done,false);
  assert.equal(h.db.runs[0].commissioningRun.steps[0].status,'pending');
  assert.equal(h.db.runs[0].commissioningRun.steps[0].note,'Warm-up looks normal');
  assert.equal(h.db.runs[0].commissioningRun.currentReadings.rpm,'1800');
  assert.equal(h.db.runs[0].commissioningRun.currentReadings.oilPressure,'48');
  assert.equal(h.db.runs[0].commissioningRun.measurements.length,0);
  assert.equal(h.db.runs[0].rpmMax,'');
  assert.equal(h.db.squawks.length,0);
  assert.equal(h.db.logs.length,0);
  assert.ok(h.db.runs[0].commissioningRun.lastSavedAt);
  assert.match(h.modal,/Save Progress/);
  assert.match(h.modal,/Log Reading/);

  // Complete saves the current reading, Run/Test state and checklist state together.
  for(const [id,v] of [['crRpm','2500'],['crOilP','55'],['crFuelP','4.2'],['crBusV','14.1'],['crStepNote','Normal start']]){
    let el=h.elements.get(id);if(!el){el={id,value:'',checked:false,dataset:{},classList:{toggle(){},add(){},remove(){}}};h.elements.set(id,el)}
    el.value=v;
  }
  h.ctx.completeCommissioningStep(run.id);
  assert.equal(h.db.checklists[0].items.find(x=>x.id==='1').done,true);
  assert.equal(h.db.runs[0].commissioningRun.steps[0].status,'complete');
  assert.equal(h.db.runs[0].rpmMax,'2500');
  assert.equal(h.db.runs[0].oilPressureMin,'55');
  assert.equal(h.db.runs[0].fuelPressureMin,'4.2');
  assert.equal(h.db.runs[0].fuelPressureMax,'4.2');
  assert.equal(h.db.runs[0].busVoltageMin,'14.1');

  // A finding creates an unresolved Before Flight squawk and does NOT check the item off.
  h.elements.get('crStepNote').value='Oil-pressure indication flickered.';
  h.ctx.recordCommissioningFinding(run.id);
  assert.equal(h.db.squawks.length,1);
  assert.equal(h.db.squawks[0].status,'Open');
  assert.equal(h.db.squawks[0].severity,'Before Flight');
  assert.equal(h.db.squawks[0].sourceRunId,run.id);
  assert.equal(h.db.checklists[0].items.find(x=>x.id==='2').done,false);
  assert.equal(h.db.runs[0].commissioningRun.steps[1].status,'finding');

  // Finishing with an open finding creates exactly one linked Work Log and preserves follow-up status.
  h.ctx.finishCommissioningRun(run.id);
  assert.equal(h.db.logs.length,1);
  assert.equal(h.db.logs[0].origin,'commissioning-run');
  assert.equal(h.db.logs[0].sourceRunId,run.id);
  assert.equal(h.db.runs[0].commissioningRun.workLogId,h.db.logs[0].id);
  assert.equal(h.db.runs[0].commissioningRun.status,'Completed');
  assert.equal(h.db.runs[0].outcome,'Follow-up Needed');

  // Calling Finish again cannot duplicate the Work Log.
  h.ctx.finishCommissioningRun(run.id);
  assert.equal(h.db.logs.length,1);
}

// Abort path creates an unresolved squawk + one Work Log immediately.
{
  const h=harness({gateClear:true});
  h.ctx.createFirstStartRun();
  const run=h.db.runs[0];
  let note=h.elements.get('crStepNote');if(!note){note={id:'crStepNote',value:'',checked:false,dataset:{},classList:{toggle(){},add(){},remove(){}}};h.elements.set('crStepNote',note)}
  note.value='Aborted for unexpected fuel smell.';
  h.ctx.abortCommissioningRun(run.id);
  assert.equal(h.db.runs[0].commissioningRun.status,'Aborted');
  assert.equal(h.db.runs[0].outcome,'Aborted');
  assert.equal(h.db.squawks.length,1);
  assert.equal(h.db.squawks[0].status,'Open');
  assert.equal(h.db.logs.length,1);
  assert.equal(h.db.logs[0].sourceRunId,run.id);
  assert.equal(h.db.runs[0].commissioningRun.workLogId,h.db.logs[0].id);
}

console.log('first-start recorder persistence/finding/finalization regression tests passed');
