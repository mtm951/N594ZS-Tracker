import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const checklistSource=fs.readFileSync(new URL('../app-11-checklists.js',import.meta.url),'utf8');

function fakeDocument(modalBox){
  return {
    getElementById:id=>id==='modalBox'?modalBox:null,
    querySelectorAll:()=>[]
  };
}
function makeHarness(values={}){
  let nextId=700;
  const saves=[],opened=[],alerts=[];
  const modalBox={scrollTop:0};
  const db={
    checklists:[
      {
        id:'uuid-check-1',
        name:'Preflight',
        purpose:'Before flight',
        system:'General',
        trigger:'Before Flight',
        projectId:null,
        notes:'Source note',
        sourceDocumentId:88,
        customMetadata:{authority:'owner'},
        items:[
          {id:'item-a',text:'Fuel on',note:'Verify valve',done:false,history:[{date:'2026-09-20'}]},
          {id:'item-b',text:'Controls free',note:'',done:true}
        ]
      }
    ],
    projects:[],parts:[],orders:[],logs:[],docs:[],settings:{}
  };
  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,Date,Math,Promise,
    structuredClone,
    window:null,
    document:fakeDocument(modalBox),
    RECORD_ARRAYS:{checklist:'checklists'},
    db,
    arr:v=>Array.isArray(v)?v:[],
    uid:()=>++nextId,
    val:id=>String(values[id]??''),
    selectedNumber:id=>{
      const raw=values[id];
      if(raw===undefined||raw===null||raw==='')return null;
      const n=Number(raw);return Number.isFinite(n)?n:null;
    },
    saveDB:message=>saves.push(message),
    alert:message=>alerts.push(message),
    confirm:()=>true,
    closeModal:()=>{},
    openModal:()=>{},
    modalHeader:()=>'',field:()=>'',textareaField:()=>'',systemOptions:()=>'',projectOptions:()=>'',esc:x=>String(x??''),
    checklistById:id=>db.checklists.find(x=>String(x.id)===String(id)),
    projectById:()=>null,docById:()=>null,
    chooseAttachments:()=>{},handleEntityDrop:()=>{},renderAttachments:()=>Promise.resolve(),
    toast:()=>{},pill:x=>String(x??''),
    currentDetail:null,
    requestAnimationFrame:fn=>{fn();return 1},
    setTimeout:fn=>{fn();return 1}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(storeSource,context,{filename:'app-17a-data-store.js'});
  vm.runInContext(checklistSource,context,{filename:'app-11-checklists.js'});
  context.openChecklistDetail=id=>{opened.push(String(id));modalBox.scrollTop=0};
  return {context,db,saves,opened,alerts,modalBox};
}

// Edit the checklist shell through trackerStore and preserve specialized/source metadata and nested items.
{
  const h=makeHarness({
    ckName:'Preflight / Before Start',
    ckPurpose:'Before engine start',
    ckSystem:'Engine',
    ckTrigger:'Before Start',
    ckProject:'42',
    ckNotes:'Updated source note'
  });
  h.context.saveChecklist('uuid-check-1');

  const c=h.db.checklists[0];
  assert.equal(c.name,'Preflight / Before Start');
  assert.equal(c.system,'Engine');
  assert.equal(c.projectId,42);
  assert.equal(c.sourceDocumentId,88,'editing checklist dropped source linkage');
  assert.equal(c.customMetadata.authority,'owner','editing checklist dropped unrelated metadata');
  assert.equal(c.items.length,2,'editing checklist replaced nested items');
  assert.deepEqual(h.saves,['Checklist updated.']);
}

// Create a new checklist through the store boundary.
{
  const h=makeHarness({
    ckName:'First Engine Run',
    ckPurpose:'Ground run',
    ckSystem:'Engine',
    ckTrigger:'Before first start',
    ckProject:'',
    ckNotes:'New checklist'
  });
  h.context.saveChecklist(null);

  assert.equal(h.db.checklists.length,2);
  const c=h.db.checklists[1];
  assert.equal(c.id,701);
  assert.equal(c.name,'First Engine Run');
  assert.deepEqual(c.items,[]);
  assert.deepEqual(h.saves,['Checklist created.']);
}

// Add a nested item without changing existing items.
{
  const h=makeHarness({ckiText:'Master ON',ckiNote:'Observe battery fault lamp'});
  h.context.saveChecklistItem('uuid-check-1',null);

  const c=h.db.checklists[0];
  assert.equal(c.items.length,3);
  assert.equal(c.items[2].text,'Master ON');
  assert.equal(c.items[2].done,false);
  assert.deepEqual(h.saves,['Checklist item saved.']);
  assert.deepEqual(h.opened,['uuid-check-1']);
}

// Edit an existing item while preserving its completion state and item-specific history.
{
  const h=makeHarness({ckiText:'Fuel valve ON',ckiNote:'Confirm detent'});
  h.context.saveChecklistItem('uuid-check-1','item-a');

  const item=h.db.checklists[0].items[0];
  assert.equal(item.text,'Fuel valve ON');
  assert.equal(item.note,'Confirm detent');
  assert.equal(item.done,false);
  assert.deepEqual(item.history,[{date:'2026-09-20'}]);
  assert.deepEqual(h.saves,['Checklist item saved.']);
}

// Toggle only the intended nested item, persist once, and keep the checklist
// at the same scroll position after the detail modal re-renders.
{
  const h=makeHarness();
  h.context.currentDetail={type:'checklist',id:'uuid-check-1'};
  h.modalBox.scrollTop=842;
  h.context.toggleChecklistItem('uuid-check-1','item-a',true);

  const c=h.db.checklists[0];
  assert.equal(c.items[0].done,true);
  assert.equal(c.items[1].done,true);
  assert.equal(c.items[0].text,'Fuel on');
  assert.equal(h.saves.length,1);
  assert.equal(h.saves[0],'');
  assert.deepEqual(h.opened,['uuid-check-1']);
  assert.equal(h.modalBox.scrollTop,842,'checking an item jumped the checklist back to the top');
}

// Delete one nested item without deleting the checklist.
{
  const h=makeHarness();
  h.context.deleteChecklistItem('uuid-check-1','item-a');

  assert.equal(h.db.checklists.length,1);
  assert.equal(h.db.checklists[0].items.length,1);
  assert.equal(h.db.checklists[0].items[0].id,'item-b');
  assert.deepEqual(h.saves,['Checklist item deleted.']);
  assert.deepEqual(h.opened,['uuid-check-1']);
}

// Delete the checklist through trackerStore.
{
  const h=makeHarness();
  h.context.deleteChecklist('uuid-check-1');
  assert.equal(h.db.checklists.length,0);
  assert.deepEqual(h.saves,['Checklist deleted.']);
}

// Existing validation remains intact.
{
  const h=makeHarness({ckName:'',ckPurpose:'',ckSystem:'',ckTrigger:'',ckProject:'',ckNotes:''});
  h.context.saveChecklist('uuid-check-1');
  assert.equal(h.db.checklists[0].name,'Preflight');
  assert.equal(h.saves.length,0);
  assert.equal(h.alerts.length,1);
}

console.log('checklist tracker-store regression tests passed');
