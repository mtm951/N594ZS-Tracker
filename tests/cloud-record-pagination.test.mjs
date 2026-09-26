import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the PRODUCTION cloud loader, version refresh and conflict reader
// with 1,040 active records: 40 beyond PostgREST's common 1,000-row limit.
// This is disposable fake data; no real Supabase connection or production writes.
const source=fs.readFileSync(new URL('../app-17-record-sync.js',import.meta.url),'utf8');
const reliability=fs.readFileSync(new URL('../app-45-reliability.js',import.meta.url),'utf8');
const remoteFunction=reliability.split('\n').find(x=>x.startsWith('async function remoteRows()'));
assert.ok(remoteFunction?.includes('cloudReadAllTrackerRecords'));

const active=[
  {record_type:'aircraft',record_id:'singleton',data:{name:'Test Aircraft'}},
  {record_type:'settings',record_id:'singleton',data:{}},
  {record_type:'invoice',record_id:'INV',data:{id:'INV',invoice:'INV',purchaseIds:['P1']}},
  {record_type:'purchase',record_id:'P1',data:{id:'P1',description:'Test item',inventoryPartId:1036,invoice:'INV'}}
];
for(let i=1;i<=1036;i++)active.push({
  record_type:'part',record_id:String(i),data:{id:i,name:'Part '+i,stockQty:0}
});
assert.equal(active.length,1040);
const deleted=Array.from({length:4},(_,i)=>({
  record_type:'part',record_id:'deleted-'+i,data:{id:'deleted-'+i,name:'Deleted'},
  deleted_at:'2025-01-01T00:00:00Z'
}));
const dataset=[...active,...deleted].map((r,i)=>({
  workspace_id:'workspace',deleted_at:null,record_version:i+1,updated_client:'remote-device',
  updated_at:'2026-09-26T00:00:00Z',...r
}));
let malformed=false,requests=[],writes=0,rendered=0,syncLabel='',pending=false;
const local=new Map(),session=new Map();
const localStorage={
  getItem:k=>local.has(k)?local.get(k):null,
  setItem:(k,v)=>local.set(k,String(v)),
  removeItem:k=>local.delete(k)
};
function fakeQuery(){
  const q={filters:[],orders:[],columns:'',opts:{}};
  const chain={
    select(columns,opts={}){q.columns=columns;q.opts=opts;return chain},
    eq(k,v){q.filters.push(row=>String(row[k])===String(v));return chain},
    in(k,v){q.filters.push(row=>v.includes(row[k]));return chain},
    is(k,v){q.filters.push(row=>row[k]===v);return chain},
    order(k){q.orders.push(k);return chain},
    async range(from,to){
      requests.push({from,to,types:q.filters.length,columns:q.columns});
      let rows=dataset.filter(row=>q.filters.every(test=>test(row)));
      rows.sort((a,b)=>String(a.record_type).localeCompare(String(b.record_type))||
        String(a.record_id).localeCompare(String(b.record_id)));
      // Simulate the server cap even if callers ask for more than 1,000.
      const count=rows.length;
      rows=rows.slice(from,Math.min(to+1,from+1000));
      if(malformed&&from>=500)rows=[];
      return {data:rows,count,error:null};
    }
  };
  return chain;
}
const ctx={
  window:null,sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},
  localStorage,crypto:{randomUUID:()=> 'test-client'},navigator:{onLine:true},
  console,Map,Set,JSON,Math,Number,String,Date,Array,
  db:{aircraft:{},settings:{},parts:[],purchases:[],invoices:[]},
  SEED:{aircraft:{},settings:{}},cloudWorkspaceId:'workspace',cloudSession:{user:{id:'owner'}},
  cloudLoading:false,supa:{from:t=>{assert.equal(t,'tracker_records');return fakeQuery()}},
  clone:v=>JSON.parse(JSON.stringify(v)),arr:v=>Array.isArray(v)?v:[],
  canCloudEdit:()=>false,normalizeDB:()=>{},persistCloudCache:()=>{},
  cloudStatusLabel:label=>{syncLabel=label},renderAll:()=>{rendered++},
  toast:()=>{},setTimeout:()=>{},clearTimeout:()=>{},
  closeModal:()=>{},saveDB:()=>{writes++}
};
ctx.window=ctx;ctx.window.addEventListener=()=>{};
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:'app-17-record-sync.js'});
vm.runInContext("RECORD_ARRAYS.invoice='invoices';SYNC_RECORD_TYPES.add('invoice');RECORD_ARRAYS.purchase='purchases';SYNC_RECORD_TYPES.add('purchase');const originalBlank=blankCloudDB;blankCloudDB=()=>({...originalBlank(),invoices:[],purchases:[]});",ctx);
vm.runInContext(remoteFunction,ctx,{filename:'app-45-reliability.js'});

// A full initial cloud read must page all 1,040 active records and may
// NOT label the truncated first page as Synced.
await vm.runInContext('loadCloudState(true)',ctx);
assert.equal(ctx.db.parts.length,1036);
assert.equal(ctx.db.purchases.length,1);
assert.equal(ctx.db.invoices.length,1);
assert.equal(ctx.db.purchases[0].inventoryPartId,1036);
assert.equal(ctx.db.parts.find(x=>x.id===1036).name,'Part 1036');
assert.equal(vm.runInContext('cloudRecordSnapshot.size',ctx),1040);
assert.equal(vm.runInContext('cloudRecordVersions.size',ctx),1040);
assert.equal(syncLabel,'Synced');
assert.equal(rendered,1);
assert.equal(writes,0);
assert.ok(requests.some(x=>x.from===1000));
assert.ok(requests.every(x=>x.to-x.from+1<=500));

// The version-map and field-level conflict reader must also not truncate
// once deleted records push the remote set above 1,000.
requests=[];
await vm.runInContext('refreshCloudRecordVersions()',ctx);
assert.equal(vm.runInContext('cloudRecordVersions.size',ctx),1044);
assert.ok(requests.some(x=>x.from===1000));
requests=[];
const remote=await vm.runInContext('remoteRows()',ctx);
assert.equal(remote.length,1044);
assert.equal(remote.filter(x=>x.deleted_at).length,4);
assert.ok(requests.some(x=>x.from===1000));

// A short/error page must never replace a good local dataset with an
// incomplete one or report falsely that it is Synced.
malformed=true;requests=[];const oldDB=JSON.stringify(ctx.db);rendered=0;
await assert.rejects(vm.runInContext('loadCloudState(true)',ctx),/incomplete page/i);
assert.equal(JSON.stringify(ctx.db),oldDB);
assert.equal(rendered,0);
assert.equal(requests.filter(x=>x.from===500).length,2,
  'Transient incomplete page retries once, then fails closed');
assert.equal(writes,0);
console.log('PASS: production cloud loader fully reads 1,040 records, refreshes 1,044 versions, reads complete conflict state and fails closed on truncated pages.');
