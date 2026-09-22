import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storeSource=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const docsSource=fs.readFileSync(new URL('../app-10-documents.js',import.meta.url),'utf8');

function makeHarness(values={}){
  let nextId=800;
  const saves=[],alerts=[];
  const db={
    docs:[{
      id:77,
      name:'ROTAX Manual',
      type:'Manual',
      revision:'Rev 0',
      issueDate:'2024-01-01',
      system:'Engine',
      publisher:'ROTAX',
      location:'https://example.test/manual',
      notes:'Existing notes',
      linkedProjectIds:[109],
      linkedPartIds:[206],
      linkedLogIds:[404],
      updates:[{id:1,date:'2026-09-20',text:'Verified source'}],
      sourceKey:'rotax-mml-912-100h-annual',
      authority:'manufacturer'
    }],
    projects:[],parts:[],orders:[],logs:[],checklists:[],settings:{}
  };
  const context={
    console,JSON,Object,Array,String,Number,Boolean,Map,Set,Error,Date,Math,Promise,
    structuredClone,
    window:null,
    document:{getElementById:()=>null},
    RECORD_ARRAYS:{document:'docs'},
    db,
    arr:v=>Array.isArray(v)?v:[],
    uid:()=>++nextId,
    val:id=>String(values[id]??''),
    saveDB:message=>saves.push(message),
    alert:message=>alerts.push(message),
    confirm:()=>true,
    closeModal:()=>{},
    openModal:()=>{},
    modalHeader:()=>'',field:()=>'',textareaField:()=>'',systemOptions:()=>'',esc:x=>String(x??''),
    docById:id=>db.docs.find(x=>String(x.id)===String(id)),
    projectById:()=>null,partById:()=>null,logById:()=>null,
    isURL:()=>false,pill:x=>String(x??''),
    chooseAttachments:()=>{},handleEntityDrop:()=>{},renderAttachments:()=>Promise.resolve(),
    addEntityUpdate:()=>{},
    currentDetail:null
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(storeSource,context,{filename:'app-17a-data-store.js'});
  vm.runInContext(docsSource,context,{filename:'app-10-documents.js'});
  return {context,db,saves,alerts};
}

// Edit through trackerStore and preserve relationship/provenance metadata not owned by the form.
{
  const h=makeHarness({
    dcName:'ROTAX 912 Series Maintenance Manual',
    dcType:'Maintenance Manual',
    dcRevision:'Rev 1',
    dcIssue:'2026-09-01',
    dcSystem:'Engine',
    dcPublisher:'BRP-Rotax',
    dcLocation:'https://example.test/new-manual',
    dcNotes:'Current source-backed manual'
  });
  h.context.saveDoc(77);

  const d=h.db.docs[0];
  assert.equal(d.name,'ROTAX 912 Series Maintenance Manual');
  assert.equal(d.revision,'Rev 1');
  assert.equal(d.publisher,'BRP-Rotax');
  assert.deepEqual(d.linkedProjectIds,[109]);
  assert.deepEqual(d.linkedPartIds,[206]);
  assert.deepEqual(d.linkedLogIds,[404]);
  assert.equal(d.updates.length,1);
  assert.equal(d.sourceKey,'rotax-mml-912-100h-annual');
  assert.equal(d.authority,'manufacturer');
  assert.deepEqual(h.saves,['Document updated.']);
}

// Create a new linked document through the store boundary.
{
  const h=makeHarness({
    dcName:'EarthX ETX680 Manual',
    dcType:'Manual',
    dcRevision:'',
    dcIssue:'2026-09-21',
    dcSystem:'Electrical',
    dcPublisher:'EarthX',
    dcLocation:'',
    dcNotes:'Battery reference'
  });
  h.context.saveDoc(null,109);

  assert.equal(h.db.docs.length,2);
  const d=h.db.docs[1];
  assert.equal(d.id,801);
  assert.equal(d.name,'EarthX ETX680 Manual');
  assert.deepEqual(d.linkedProjectIds,[109]);
  assert.deepEqual(d.linkedPartIds,[]);
  assert.deepEqual(d.linkedLogIds,[]);
  assert.deepEqual(d.updates,[]);
  assert.deepEqual(h.saves,['Document added.']);
}

// Delete through trackerStore.
{
  const h=makeHarness();
  h.context.deleteDoc(77);
  assert.equal(h.db.docs.length,0);
  assert.deepEqual(h.saves,['Document deleted.']);
}

// Validation still prevents blank document names from writing.
{
  const h=makeHarness({
    dcName:'',dcType:'Manual',dcRevision:'Rev X',dcIssue:'',dcSystem:'Engine',
    dcPublisher:'',dcLocation:'',dcNotes:''
  });
  h.context.saveDoc(77);
  assert.equal(h.db.docs[0].name,'ROTAX Manual');
  assert.equal(h.saves.length,0);
  assert.equal(h.alerts.length,1);
}

console.log('document tracker-store regression tests passed');
