import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const partSource=read('app-30-part-descriptions.js');
const orderSource=read('app-08-orders.js');
const pickerSource=read('app-36-searchable-part-picker.js');
const comboSource=read('app-37-part-picker-combo.js');
const sortedSource=read('app-53-parts-sort.js');
const index=read('index.html');

const parts=[
  {id:501,name:'COTTER PIN 1/8 x 1-1/4',partNo:'MS24665-355',
   alternatePartNos:['AN380-4-5'],description:'Carbon steel 1/8 x 1-1/4',stockQty:0,
   unit:'ea',partType:'Inventory',status:'Order',system:'Hardware',vendor:'McFarlane Aviation',
   linkedProjectIds:[],updates:[]},
  {id:502,name:'Another cotter pin',partNo:'MS24665-283',stockQty:25,unit:'ea',
   system:'Hardware',status:'On Hand',linkedProjectIds:[],updates:[]}
];
const orders=[{id:601,item:'COTTER PIN 1/8 x 1-1/4',qty:10,status:'Ordered',partId:null,
  projectId:null,linkedProjectIds:[],unit:'ea',receivedQty:0,inventoryApplied:false}];
const db={parts,orders,logs:[],projects:[],settings:{showCosts:true}};
const controls=new Map();
const saved=[],alerts=[],modals=[];
const classSet=new Set();
function el(id,value=''){
  return {
    id,value,innerHTML:'',dataset:{},hidden:false,style:{},setAttribute(){},removeAttribute(){},
    addEventListener(){},focus(){},classList:{
      add:x=>classSet.add(id+':'+x),
      remove:x=>classSet.delete(id+':'+x),
      contains:x=>classSet.has(id+':'+x)
    },
    closest:()=>({insertAdjacentHTML:(_pos,content)=>{modals.push(content)}})
  };
}
const doc={
  createElement:()=>({textContent:'',id:'',style:{}}),
  head:{appendChild(){}},addEventListener(){},getElementById:id=>controls.get(id)||null
};
for(const id of ['modalBox','ptName','ptDescription','ptPN','ptAlternatePN','ptSystem','ptUnit','ptStock',
  'ptMin','ptStatus','ptVendor','ptUrl','ptCost','ptLocation','ptPurchase','ptNotes',
  'olSearch','olPartId','olResults','olSelected','partRows','partSearch','partSystem','partStatus']){
  controls.set(id,el(id));
}
const base={
  console,window:null,document:doc,db,Number,String,Math,JSON,Map,Set,Intl,Date,
  arr:v=>Array.isArray(v)?v:[],num:v=>Number(v)||0,uid:()=>800,
  normalizeDB(){},openPartModal(){},openPartDetail(){},savePart(){},
  partById:id=>parts.find(p=>Number(p.id)===Number(id)),
  orderById:id=>orders.find(o=>Number(o.id)===Number(id)),
  partAvailable:p=>p.stockQty,partConsumedQty:()=>0,partOnOrderQty:()=>10,
  openModal:markup=>modals.push(markup),closeModal(){},modalHeader:()=>'<h2>Part details</h2>',
  saveDB:reason=>saved.push(reason),alert:reason=>alerts.push(String(reason)),confirm:()=>true,
  esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  val:id=>String(controls.get(id)?.value??''),
  setTimeout:()=>0,partName:id=>parts.find(p=>p.id===id)?.name||'',
  projectName:()=>'',selectedNumber:()=>null,partOptions:()=>'',projectOptions:()=>'',systemOptions:()=>'',field:()=>'',textareaField:()=>'',pill:()=>'',fmtMoney:()=>'',unique:items=>[...new Set(items)],sessionStorage:{getItem:()=>null,setItem(){}}
};
base.window=base;
vm.createContext(base);
vm.runInContext(partSource,base,{filename:'app-30-part-descriptions.js'});
vm.runInContext(orderSource,base,{filename:'app-08-orders.js'});
vm.runInContext(pickerSource,base,{filename:'app-36-searchable-part-picker.js'});
vm.runInContext(comboSource,base,{filename:'app-37-part-picker-combo.js'});
vm.runInContext(sortedSource,base,{filename:'app-53-parts-sort.js'});

assert.deepEqual(Array.from(base.partAlternateCodes(parts[0])),['AN380-4-5']);
assert.deepEqual(Array.from(base.parsePartAlternateCodes('AN380-4-5, MS24665-355\nan380-4-5','MS24665-355')),
  ['AN380-4-5'],'aliases must de-duplicate case-insensitively and exclude the primary PN');

// Order's linked inventory editor uses an actual searchable picker.
base.openOrderPartLinkModal(601);
assert.match(modals.at(-1),/id="olSearch"/);
assert.doesNotMatch(modals.at(-1),/<select id="olPart"/);
assert.match(modals.at(-1),/Save Part Link/);
controls.get('olSearch').value='AN380-4-5';
base.partPickerTyped('ol');
assert.match(controls.get('olResults').innerHTML,/MS24665-355/);
assert.match(controls.get('olResults').innerHTML,/AN380-4-5/);
assert.doesNotMatch(controls.get('olResults').innerHTML,/MS24665-283/);

// Typed text alone cannot silently change or unlink inventory.
base.saveOrderPartLink(601);
assert.equal(orders[0].partId,null);
assert.match(alerts.at(-1),/Choose a matching inventory part/);
assert.equal(saved.length,0);

// Picking a single cross-reference links the SAME existing Part, never adds stock.
base.choosePartPicker('ol',501);
assert.equal(base.partPickerId('ol'),501);
base.saveOrderPartLink(601);
assert.equal(orders[0].partId,501);
assert.equal(parts[0].stockQty,0);
assert.equal(parts.length,2);
assert.equal(orders[0].receivedQty,0);
assert.deepEqual(saved,['Order linked to inventory part.']);

// Native new-order suggestions and the global shared picker use the aliases.
assert.equal(base.orderItemMatches('AN380-4-5')[0].id,501);
assert.equal(base.partPickerSearchText(parts[0]).includes('an380-4-5'),true);

// Part editor exposes alternate numbers, and the save persists cross-references
// without modifying physical stock or creating a second Part.
modals.length=0;
base.openPartModal(501);
assert.match(modals.at(-1),/ptAlternatePN/);
controls.get('ptName').value=parts[0].name;
controls.get('ptDescription').value=parts[0].description;
controls.get('ptPN').value='MS24665-355';
controls.get('ptAlternatePN').value='AN380-4-5; AN380-4-5';
controls.get('ptSystem').value='Hardware';
controls.get('ptUnit').value='ea';
controls.get('ptStock').value='0';
controls.get('ptStatus').value='Order';
controls.get('ptVendor').value='McFarlane Aviation';
controls.get('ptCost').value='0.16';
base.savePart(501);
assert.deepEqual(Array.from(parts[0].alternatePartNos),['AN380-4-5']);
assert.equal(parts[0].stockQty,0);
assert.equal(parts.length,2);

// Reject aliases already belonging to another inventory part.
controls.get('ptName').value=parts[1].name;
controls.get('ptDescription').value='Other size';
controls.get('ptPN').value='MS24665-283';
controls.get('ptAlternatePN').value='AN380-4-5';
base.savePart(502);
assert.match(alerts.at(-1),/already assigned/);
assert.equal(parts[1].alternatePartNos,undefined);

// Parts table shows the alternate and supports searching by that PN.
controls.get('partSearch').value='AN380-4-5';
base.renderPartRows();
assert.match(controls.get('partRows').innerHTML,/MS24665-355/);
assert.match(controls.get('partRows').innerHTML,/Alt: AN380-4-5/);
assert.doesNotMatch(controls.get('partRows').innerHTML,/MS24665-283/);

assert.match(index,/app-08-orders\.js\?v=5\.19\.80/);
assert.match(index,/app-30-part-descriptions\.js\?v=5\.19\.80/);
assert.match(index,/app-36-searchable-part-picker\.js\?v=5\.19\.80/);
assert.match(index,/app-53-parts-sort\.js\?v=5\.19\.80/);
console.log('PASS: searchable Order part link, alternate PNs, shared inventory, duplicate protection and Parts search');
