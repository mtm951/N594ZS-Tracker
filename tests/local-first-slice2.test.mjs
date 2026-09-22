import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const aircraftUpdatesSource=fs.readFileSync(new URL('../app-12-aircraft-updates.js',import.meta.url),'utf8');

function makeHarness(values={}){
  let nextId=5000;
  const saves=[],opened=[],alerts=[];
  const db={
    aircraft:{
      id:'singleton',tail:'N594ZS',model:'Kitfox Model 4-1050',serial:'1442',base:'20N',
      engine:'Rotax 912 ULS',hp:'100',gross:'1050',emptyWeight:'',emptyCg:'',
      airframeHours:'1200',engineHours:'1930.7',annualDate:'',status:'Project',
      notes:'Existing notes',photoPath:'aircraft/photo.jpg',customField:'preserve-me'
    },
    projects:[{id:1,title:'Engine swap',updates:[{id:1,date:'2026-09-20',text:'Old update'}],nested:{keep:true}}],
    parts:[{id:2,name:'Fuel valve',updates:[]}],
    orders:[{id:3,item:'Hose',updates:[]}],
    docs:[{id:4,name:'Manual',updates:[]}],
    checklists:[],logs:[],settings:{currency:'USD'}
  };
  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,Date,Math,
    structuredClone,
    RECORD_ARRAYS:{project:'projects',part:'parts',order:'orders',document:'docs',checklist:'checklists',log:'logs'},
    db,
    arr:v=>Array.isArray(v)?v:[],
    uid:()=>++nextId,
    today:()=> '2026-09-21',
    val:id=>String(values[id]??''),
    saveDB:message=>saves.push(message),
    closeModal:()=>{},
    openModal:()=>{},
    modalHeader:()=>'',field:()=>'',textareaField:()=>'',esc:x=>String(x??''),
    alert:message=>alerts.push(message),
    projectById:id=>db.projects.find(x=>String(x.id)===String(id)),
    partById:id=>db.parts.find(x=>String(x.id)===String(id)),
    orderById:id=>db.orders.find(x=>String(x.id)===String(id)),
    docById:id=>db.docs.find(x=>String(x.id)===String(id)),
    openProjectDetail:id=>opened.push(['project',String(id)]),
    openPartDetail:id=>opened.push(['part',String(id)]),
    openOrderDetail:id=>opened.push(['order',String(id)]),
    openLogDetail:id=>opened.push(['log',String(id)]),
    openDocumentDetail:id=>opened.push(['document',String(id)]),
    openChecklistDetail:id=>opened.push(['checklist',String(id)])
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(storeSource,context,{filename:'app-17a-data-store.js'});
  vm.runInContext(aircraftUpdatesSource,context,{filename:'app-12-aircraft-updates.js'});
  return {context,db,saves,opened,alerts};
}

// Aircraft edit uses the store boundary, saves once, and preserves fields the form does not own.
{
  const values={
    acTail:'N594ZS',acModel:'Kitfox Model IV',acSerial:'1442',acBase:'20N',
    acEngine:'Rotax 912 ULS',acHp:'100',acGross:'1050',acEmpty:'650',
    acCg:'13.9',acAirframe:'1201.2',acEngineHours:'1931.4',acAnnual:'2026-09-21',
    acStatus:'Engine start prep',acNotes:'Updated configuration notes'
  };
  const h=makeHarness(values);
  h.context.saveAircraft();

  assert.equal(h.db.aircraft.model,'Kitfox Model IV');
  assert.equal(h.db.aircraft.emptyWeight,'650');
  assert.equal(h.db.aircraft.emptyCg,'13.9');
  assert.equal(h.db.aircraft.airframeHours,'1201.2');
  assert.equal(h.db.aircraft.status,'Engine start prep');
  assert.equal(h.db.aircraft.photoPath,'aircraft/photo.jpg','aircraft edit dropped unrelated photo metadata');
  assert.equal(h.db.aircraft.customField,'preserve-me','aircraft edit dropped unrelated fields');
  assert.deepEqual(h.saves,['Aircraft details updated.']);
}

// Generic entity notes now use the same store API and retain prior update history.
{
  const h=makeHarness({upText:'Installed new coolant hose',upDate:'2026-09-21'});
  h.context.saveEntityUpdate('project',1);

  assert.equal(h.db.projects[0].updates.length,2);
  assert.equal(h.db.projects[0].updates[0].text,'Old update');
  assert.equal(h.db.projects[0].updates[1].text,'Installed new coolant hose');
  assert.equal(h.db.projects[0].updates[1].date,'2026-09-21');
  assert.equal(h.db.projects[0].nested.keep,true);
  assert.deepEqual(h.saves,['Update added.']);
  assert.deepEqual(h.opened,[['project','1']]);
}

// The generic path also works for a later-registered record type such as documents.
{
  const h=makeHarness({upText:'Verified revision against current manual',upDate:'2026-09-21'});
  h.context.saveEntityUpdate('document',4);

  assert.equal(h.db.docs[0].updates.length,1);
  assert.equal(h.db.docs[0].updates[0].text,'Verified revision against current manual');
  assert.deepEqual(h.saves,['Update added.']);
  assert.deepEqual(h.opened,[['document','4']]);
}

// Validation still prevents empty notes from touching data or persistence.
{
  const h=makeHarness({upText:'',upDate:'2026-09-21'});
  h.context.saveEntityUpdate('part',2);
  assert.equal(h.db.parts[0].updates.length,0);
  assert.equal(h.saves.length,0);
  assert.equal(h.opened.length,0);
  assert.equal(h.alerts.length,1);
}

console.log('local-first slice 2 regression tests passed');
