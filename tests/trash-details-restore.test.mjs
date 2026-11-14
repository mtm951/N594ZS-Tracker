import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-73-trash-details.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fakeDocument={
  head:{appendChild(){}},
  createElement:()=>({textContent:''}),
  getElementById:()=>null
};
const ctx={
  console,Date,Array,String,Number,Math,Object,Map,Set,
  document:fakeDocument,cloudRole:'owner',
  window:null,
  cloudSession:{user:{id:'test-user'}},cloudWorkspaceId:'workspace',cloudLoading:false,cloudDirty:false,
  CLOUD_PENDING_KEY:'pending',localStorage:{getItem:()=>null},
  navigator:{onLine:true},alert:()=>{},confirm:()=>true,
  supa:{},openModal:()=>{},closeModal:()=>{},modalHeader:()=>'',toast:()=>{},
  loadCloudState:async()=>{},cloudReadAllTrackerRecords:async()=>[],
  CLOUD_CLIENT_ID:'test'
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(source,ctx);
const helper=ctx.N594ZSTrashRecovery;
assert.ok(helper,'Trash restore feature did not register');
const fuelTrash={
  record_type:'log',record_id:'1794516225782',
  data:{id:1794516225782,date:'2026-11-12',origin:'assigned-part-use',projectIds:[115],
    consumedParts:[{id:1794516182167,partId:178959081331809,qty:2,name:'Oetiker 14.5mm'}]}
};
const active=[{
  id:1794515311822,date:'2026-11-12',projectIds:[115],
  consumedParts:[{id:1794515345664,partId:178959081331809,qty:2}]
}];
assert.equal(helper.automatic(fuelTrash),true);
assert.equal(helper.physical(fuelTrash),true);
assert.equal(helper.matchingUsage(fuelTrash,active).logId,1794515311822);
assert.equal(helper.matchingUsage(fuelTrash,[{...active[0],projectIds:[108]}]),null,
  'unrelated projects must not be considered duplicate');
assert.equal(helper.matchingUsage(fuelTrash,[{...active[0],date:'2026-09-01'}]),null,
  'distant maintenance events must not be considered duplicate');
assert.equal(helper.matchingUsage(fuelTrash,[{...active[0],consumedParts:[{partId:178959081331809,qty:1}]}]),null,
  'separate quantity must not be an exact duplicate');
assert.equal(helper.physical({record_type:'file',data:{}}),false);
assert.equal(helper.automatic({record_type:'log',data:{origin:'manual',consumedParts:[{qty:1}]}}),false);

assert.match(source,/sync_tracker_records_guarded/,'restore must use version-checked cloud RPC');
assert.match(source,/expected_version:Number\(latest\.record_version\)/);
assert.match(source,/cloudDirty\|\|localStorage\.getItem\(CLOUD_PENDING_KEY\)/,'must block pending sync');
assert.match(source,/atomicReceiptOutbox\?\.hasPending/,'must protect atomic transactions');
assert.match(source,/Restore blocked:/,'must block known duplicate automatic part use');
assert.match(source,/cloudReadAllTrackerRecords\(/,'must read paginated cloud data');
assert.match(source,/record_version/,'tombstone version is required');
assert.match(source,/data-trash-key/,'entries are clickable');
assert.match(index,/app-73-trash-details\.js\?v=5\.19\.77/,'feature module must load');
assert.match(index,/app-73-trash-details\.js[\s\S]*app-15-init\.js/,'module must load before initialization');
console.log('PASS: Trash detail UX, duplicate inventory safety, guarded cloud restore and release wiring');