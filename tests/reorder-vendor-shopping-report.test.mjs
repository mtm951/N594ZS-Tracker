import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const reportSource=read('app-74-reorder-report.js');
const stable=read('app-39-aircraft-ops-stable.js');
const partsPage=read('app-53-parts-sort.js');
const index=read('index.html');

const fixture={
  parts:[
    {id:1,name:'Oetiker clamp',partNo:'15-08418',alternatePartNos:['OME-145'],
      vendor:'Aircraft Spruce',system:'Fuel',unit:'ea',minQty:6,stockQty:10,
      inventoryAdjustments:[{delta:-2}],unitCost:.65},
    {id:2,name:'Steel washer',partNo:'AN960-816',vendor:'Aircraft Spruce',
      system:'Hardware',unit:'ea',stockQty:8,minQty:'',unitCost:.14},
    {id:3,name:'Tie wrap',partNo:'TX-001',vendor:'McFarlane Aviation',
      system:'Electrical',unit:'ea',stockQty:2,minQty:5,unitCost:0.1},
    {id:4,name:'Unknown quantity',partNo:'UH-0',vendor:'Aircraft Spruce',
      system:'Fuel',unit:'ea',stockQty:'',minQty:5},
    {id:5,name:'Under minimum but incoming',partNo:'MAT-500',vendor:'McFarlane Aviation',
      system:'Hardware',unit:'ea',stockQty:1,minQty:5},
    {id:6,name:'No reorder threshold',partNo:'HH-0',vendor:'Aircraft Spruce',
      unit:'ea',stockQty:0,minQty:0},
    {id:7,name:'Low oil hose',partNo:'LO-5',vendor:'Aircraft Spruce',
      system:'Engine',unit:'ft',stockQty:1.5,minQty:4},
    {id:8,name:'Valve with negative free',partNo:'VAL-0',vendor:'Aircraft Spruce',
      system:'Fuel',unit:'ea',stockQty:0,minQty:0}
  ],
  logs:[{id:101,consumedParts:[{partId:1,qty:3}]}],
  projects:[
    {id:111,status:'Open',plannedParts:[{partId:1,qty:2}]},
    {id:112,status:'Done',plannedParts:[{partId:1,qty:5}]},
    {id:113,status:'In Progress',plannedParts:[{partId:8,qty:1}]}
  ],
  orders:[
    {id:201,partId:1,qty:5,receivedQty:3,status:'Ordered',inventoryApplied:false},
    {id:202,partId:1,qty:4,receivedQty:0,status:'Need to Order'},
    {id:203,partId:1,qty:2,receivedQty:0,status:'Received',inventoryApplied:true},
    {id:204,partId:5,qty:10,receivedQty:0,status:'Shipped',inventoryApplied:false},
    {id:205,partId:3,qty:2,receivedQty:0,status:'Cancelled',inventoryApplied:false},
    {id:206,partId:7,qty:1,receivedQty:0,status:'Backordered',inventoryApplied:false}
  ]
};
const doc={
  createElement:()=>({textContent:'',addEventListener(){}}),
  head:{appendChild(){}},
  getElementById:()=>null,
};
const ctx={
  window:null,document:doc,console,Intl,Map,Set,JSON,Math,Number,String,Date,Array,
  db:structuredClone(fixture)
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(reportSource,ctx,{filename:'app-74-reorder-report.js'});
const report=ctx.N594ZSReorderReport;
assert.ok(report,'reorder report module missing');

const rows=report.collect(fixture);
const byId=id=>rows.find(r=>r.id===id);
assert.equal(byId(1).onHand,5,'baseline 10 - adjustment 2 - work-log use 3 = 5');
assert.equal(byId(1).reserved,2,'active project reservations only');
assert.equal(byId(1).free,3);
assert.equal(byId(1).shortfall,3);
assert.equal(byId(1).incoming,2,'only unreceived, actually ordered units count');
assert.equal(byId(1).need,1,'on-order quantity reduces but does not erase true shortage');
assert.equal(byId(1).below,true);
assert.equal(byId(5).below,true);
assert.equal(byId(5).incoming,10);
assert.equal(byId(5).need,0);
assert.equal(byId(5).covered,true);
assert.equal(byId(4).below,false,'unknown stock is not incorrectly taken as zero');
assert.equal(byId(2).below,false,'no minimum is not treated as low');
assert.equal(byId(6).below,false,'zero min and zero free are not under minimum');
assert.equal(byId(8).below,true,'negative free can be below a configured zero threshold');
assert.equal(byId(8).need,1);
assert.equal(byId(7).need,1.5,'fractional feet quantities should not be rounded up to individual pieces');
assert.equal(byId(3).need,3,'cancelled orders never cover shortfalls');

const below=report.filter(rows,{mode:'below',vendor:'all'});
assert.deepEqual(Array.from(below.map(r=>r.id)).sort((a,b)=>a-b),[1,3,5,7,8]);
const needs=report.filter(rows,{mode:'needs',vendor:'McFarlane Aviation'});
assert.deepEqual(Array.from(needs.map(r=>r.id)),[3]);
const supplier=report.filter(rows,{mode:'all',vendor:'Aircraft Spruce'});
assert.deepEqual(Array.from(supplier.map(r=>r.id)).sort((a,b)=>a-b),[1,2,4,6,7,8]);
assert.deepEqual(Array.from(report.filter(rows,{mode:'all',vendor:'all',search:'ome-145'}).map(r=>r.id)),[1],
  'alternate part numbers should be searchable');

const view={options:{vendor:'Aircraft Spruce',mode:'below',search:''},
  rows:report.filter(rows,{vendor:'Aircraft Spruce',mode:'below'}).map(r=>({...r,orderQty:r.need}))};
const pdf=report.printMarkup(view);
assert.match(pdf,/N594ZS · Reorder Report/);
assert.match(pdf,/Aircraft Spruce/);
assert.match(pdf,/OME-145/);
assert.match(pdf,/On order/);
assert.match(pdf,/Order qty/);
assert.match(pdf,/1\.5/);
assert.doesNotMatch(pdf,/McFarlane Aviation/,'print must honor vendor filter');
const csv=report.csvText(view);
assert.match(csv,/Alternate PNs/);
assert.match(csv,/OME-145/);
assert.doesNotMatch(csv,/Tie wrap/);

assert.match(partsPage,/Reorder Report/);
assert.match(partsPage,/N594ZSReorderReport\.openParts\(\)/);
assert.match(partsPage,/N594ZSReorderReport\.mountParts\(\)/);
assert.match(stable,/N594ZSReorderReport\.mountOps\(\)/);
assert.match(reportSource,/openOrderModal\(null,null,Number\(id\)\)/,
  'draft order must open existing order editor');
assert.match(reportSource,/qty\.value=fmt\(q\)/,'draft quantity not prefilled');
assert.doesNotMatch(reportSource,/saveOrder\(/,'reorder report must never create orders by itself');
assert.doesNotMatch(reportSource,/applyOrderReceipt\(/,'reorder report must never receive inventory');
assert.match(index,/app-74-reorder-report\.js\?v=5\.19\.81/);
assert.match(index,/app-53-parts-sort\.js\?v=5\.19\.81/);
assert.match(index,/app-39-aircraft-ops-stable\.js\?v=5\.19\.81/);
console.log('PASS: reorder threshold, reservations, incoming coverage, supplier list, interactive order draft, CSV and printable PDF');
