import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Real production outbox + trackerStore + Work Log modules, disposable fake
// journal and fake DOM. Nothing connects to the owner's live cloud records.
const sourceStore=fs.readFileSync(new URL('../app-17a-data-store.js',import.meta.url),'utf8');
const sourceOutbox=fs.readFileSync(new URL('../app-66-atomic-receipt-outbox.js',import.meta.url),'utf8');
const sourceLogbook=fs.readFileSync(new URL('../app-09-logbook.js',import.meta.url),'utf8');
const KEY='n594zs_atomic_receipt_outbox_v1';
const entries=new Map();
const storage={
  getItem:k=>entries.has(k)?entries.get(k):null,
  setItem:(k,v)=>entries.set(k,String(v)),
  removeItem:k=>entries.delete(k)
};
const pendingLog={
  id:888,date:'2026-09-26',system:'General',projectIds:[41],work:'Offline washer use',
  airframeHours:'',engineHours:'',laborHours:'',observations:'',blockers:'',
  nextStep:'',otherCost:'',notes:'Created by Reserve → Use',
  consumedParts:[{id:901,partId:21,qty:1,name:'TEST WASHER',unit:'ea',unitCost:''}],
  origin:'reserved-part-use'
};
const otherLog={...structuredClone(pendingLog),id:889,work:'Unrelated entry',projectIds:[],consumedParts:[]};
const db={
  logs:[structuredClone(pendingLog),structuredClone(otherLog)],
  parts:[{id:21,name:'TEST WASHER',linkedProjectIds:[41]}],
  projects:[{id:41,title:'TEST PROJECT',status:'Open',plannedParts:[],partsUsed:[]}],
  orders:[],purchases:[],docs:[],settings:{showCosts:true}
};
const journal={
  format:'N594ZS_ATOMIC_RECEIPT_V1',operationKind:'consumption',
  operationId:'test-op-1',workspaceId:'test-workspace',userId:'owner-1',
  createdAt:'2026-09-26T00:00:00Z',
  changes:[{record_type:'log',record_id:'888',data:structuredClone(pendingLog),
    expected_version:0,deleted_at:null,updated_client:'test'}],
  before:[{key:'log:888',data:null}]
};
storage.setItem(KEY,JSON.stringify(journal));
const alerts=[],modals=[],saves=[],confirmations=[];
let lastModal='',closed=0;
const formValues={lgDate:'2026-09-26',lgWork:'Edited unrelated entry'};
const ctx={
  console:{...console,warn(){}},window:null,structuredClone,JSON,Date,Map,Set,Array,Object,
  String,Number,Boolean,Math,Promise,Error,db,localStorage:storage,
  cloudWorkspaceId:'test-workspace',cloudSession:{user:{id:'owner-1'}},
  supa:{},cloudRecordSnapshot:new Map(),cloudRecordVersions:new Map(),
  cloudRecordKey:(type,id)=>type+':'+id,cloudStableJSON:JSON.stringify,
  CLOUD_CLIENT_ID:'test-client',DB_KEY:'test-cache',cloudDirty:false,
  RECORD_ARRAYS:{part:'parts',project:'projects',log:'logs',purchase:'purchases',order:'orders'},
  arr:x=>Array.isArray(x)?x:[],
  num:x=>Number(x)||0,clone:structuredClone,
  logById:id=>db.logs.find(x=>String(x.id)===String(id)),
  projectById:id=>db.projects.find(x=>String(x.id)===String(id)),
  partById:id=>db.parts.find(x=>String(x.id)===String(id)),
  consumedCost:()=>0,fmtMoney:x=>'$'+Number(x).toFixed(2),
  field:(label,id)=>'<input id="'+id+'">',textareaField:(label,id)=>'<textarea id="'+id+'"></textarea>',
  systemOptions:()=>'<option>General</option>',partOptions:()=>'<option>TEST WASHER</option>',
  pill:x=>String(x),esc:x=>String(x??''),partName:()=> 'TEST WASHER',
  val:id=>formValues[id]||'',selectedNumber:()=>21,
  modalHeader:(title)=>'<h2>'+title+'</h2>',
  openModal:html=>{lastModal=html;modals.push(html)},
  closeModal:()=>{closed++},saveDB:message=>{saves.push(message)},
  renderAttachments:()=>{},uid:()=>999,today:()=> '2026-09-26',
  alert:message=>alerts.push(String(message)),
  confirm:message=>{confirmations.push(String(message));return true},
  toast:()=>{},saveCloudState:async()=>({applied:[]}),
  loadCloudState:async()=>{},forceCloudReload:async()=>{},
  openCloudAccount:()=>{},cloudSignOut:async()=>{},cloudStatusLabel:()=>{},
  document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(sourceStore,ctx,{filename:'app-17a-data-store.js'});
vm.runInContext(sourceLogbook,ctx,{filename:'app-09-logbook.js'});
vm.runInContext(sourceOutbox,ctx,{filename:'app-66-atomic-receipt-outbox.js'});

// Precisely the new Work Log staged by the pending journal is frozen.
assert.equal(ctx.atomicReceiptOutbox.hasPending(),true);
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('log',888),true);
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('log',889),false);
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('part',21),false);

ctx.openLogDetail(888);
assert.match(lastModal,/unsynced atomic transaction/i);
assert.doesNotMatch(lastModal,/onclick="openLogModal\(888\)"/);
assert.doesNotMatch(lastModal,/onclick="addConsumedPart\(888\)"/);
assert.doesNotMatch(lastModal,/onclick="removeConsumedPart\(888,901\)"/);
const old=JSON.stringify(db),startAlerts=alerts.length;
ctx.openLogModal(888);
ctx.saveLog(888);
ctx.deleteLog(888);
ctx.addConsumedPart(888);
ctx.saveConsumedPart(888);
ctx.removeConsumedPart(888,901);
assert.equal(alerts.length,startAlerts+6,'Every pending editor entry point warns');
assert.equal(JSON.stringify(db),old,'A protected log was edited during pending sync');
assert.equal(confirmations.length,0,'Deletion prompt must not bypass atomic lock');
assert.equal(saves.length,0,'Protected edits unexpectedly persisted');
assert.throws(()=>ctx.trackerStore.update('log',888,d=>{d.work='unsafe'}, {persist:false}),/pending/i);
assert.throws(()=>ctx.trackerStore.remove('log',888,{persist:false}),/pending/i);
assert.equal(JSON.stringify(db),old);

// Other Work Logs remain editable; a protected operation must not freeze all work.
ctx.openLogModal(889);
assert.match(lastModal,/Edit Work Entry/);
ctx.saveLog(889);
assert.equal(db.logs.find(x=>x.id===889).work,'Edited unrelated entry');
assert.equal(saves.length,1);
ctx.trackerStore.write('log',889,db.logs.find(x=>x.id===889),{persist:false});

// If a log editor was already open when an atomic operation became pending,
// saveLog must still reject it (not just hide the Edit button).
storage.removeItem(KEY);
ctx.openLogModal(888);
assert.match(lastModal,/Edit Work Entry/);
storage.setItem(KEY,JSON.stringify(journal));
const preserved=JSON.stringify(db.logs.find(x=>x.id===888));
ctx.saveLog(888);
assert.equal(JSON.stringify(db.logs.find(x=>x.id===888)),preserved);

// A corrupt or mismatched local journal must fail closed rather than silently
// letting a newer local edit make future recovery impossible.
storage.setItem(KEY,'not valid JSON');
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('log',888),true);
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('log',889),true);
storage.setItem(KEY,JSON.stringify({...journal,workspaceId:'different-workspace'}));
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('log',889),true);

// A fully acknowledged journal unlocks its Work Log immediately.
storage.removeItem(KEY);
assert.equal(ctx.atomicReceiptOutbox.isPendingRecord('log',888),false);
ctx.openLogModal(888);
assert.match(lastModal,/Edit Work Entry/);
ctx.saveLog(888);
assert.equal(db.logs.find(x=>x.id===888).work,'Edited unrelated entry');
assert.equal(ctx.trackerStore.update('log',888,d=>{d.work+=' after sync'},{persist:false}).work,
  'Edited unrelated entry after sync');
console.log('PASS: pending atomic log is read-only in UI and trackerStore, unrelated logs remain editable, corrupt journals fail closed, and acknowledgement unlocks editing.');
