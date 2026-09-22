import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');

function makeContext(){
  const saves=[];
  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,
    structuredClone,
    RECORD_ARRAYS:{project:'projects'},
    db:{
      aircraft:{id:'singleton',registration:'N594ZS'},
      settings:{currency:'USD'},
      projects:[{id:1,title:'Old title',nested:{count:1}}]
    },
    saveDB:message=>saves.push(message)
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'app-17a-data-store.js'});
  return {context,saves};
}

{
  const h=makeContext();
  const row=h.context.trackerStore.read('project',1);
  row.title='Changed outside store';
  row.nested.count=99;
  assert.equal(h.context.db.projects[0].title,'Old title','read leaked a live record reference');
  assert.equal(h.context.db.projects[0].nested.count,1,'nested read leaked a live reference');
}

{
  const h=makeContext();
  const out=h.context.trackerStore.update('project',1,draft=>{
    draft.title='Updated safely';
    draft.nested.count=2;
  },{message:'Project updated.'});

  assert.equal(out.title,'Updated safely');
  assert.equal(h.context.db.projects[0].title,'Updated safely');
  assert.equal(h.context.db.projects[0].nested.count,2);
  assert.deepEqual(h.saves,['Project updated.']);
}

{
  const h=makeContext();
  h.context.trackerStore.write('project',2,{title:'Created through store'},{message:'Project created.'});
  assert.equal(h.context.db.projects.length,2);
  assert.equal(h.context.db.projects[1].id,2);
  assert.equal(h.context.db.projects[1].title,'Created through store');
  assert.deepEqual(h.saves,['Project created.']);

  const removed=h.context.trackerStore.remove('project',2,{message:'Project removed.'});
  assert.equal(removed,true);
  assert.equal(h.context.db.projects.length,1);
  assert.deepEqual(h.saves,['Project created.','Project removed.']);
}

{
  const h=makeContext();
  h.context.trackerStore.write('settings','singleton',{currency:'CAD'},{message:'Settings saved.'});
  assert.equal(h.context.db.settings.currency,'CAD');
  assert.deepEqual(h.saves,['Settings saved.']);
  assert.throws(()=>h.context.trackerStore.remove('settings','singleton'),/Singleton records cannot be removed/);
}

{
  const h=makeContext();
  // Record types can be registered after the store module loads. This is important
  // because later feature modules add purchase/equipment/etc. to RECORD_ARRAYS.
  h.context.RECORD_ARRAYS.equipment='equipment';
  h.context.db.equipment=[{id:901,name:'EarthX'}];
  h.context.trackerStore.update('equipment',901,draft=>{draft.name='EarthX ETX680'});
  assert.equal(h.context.db.equipment[0].name,'EarthX ETX680');
  assert.equal(h.saves.length,1);
}

{
  const h=makeContext();
  h.context.trackerStore.update('project',1,draft=>{draft.title='No persist'},{persist:false,message:'Should not save'});
  assert.equal(h.context.db.projects[0].title,'No persist');
  assert.equal(h.saves.length,0);
  h.context.trackerStore.commit('Explicit commit');
  assert.deepEqual(h.saves,['Explicit commit']);
}

console.log('tracker data store regression tests passed');
