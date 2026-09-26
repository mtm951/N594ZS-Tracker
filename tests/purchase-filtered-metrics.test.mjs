import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Test production purchase summary/metrics and drilldown modules against
// disposable in-memory fixtures. No production cloud data is read or modified.
const finance=fs.readFileSync(new URL('../app-25-multivendor.js',import.meta.url),'utf8');
const drill=fs.readFileSync(new URL('../app-46-purchase-metric-drilldowns.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../app-23-wb-purchases.js',import.meta.url),'utf8');

const p=(id,invoice,price,extra={})=>({id,invoice,order:invoice,pn:id,description:id,qty:1,
  unitPrice:price,priceKnown:true,shipDate:'2025-03-01',vendor:'Amazon',disposition:'On Hand',system:'Electrical',...extra});
const purchases=[
  p('a1','AM-A',12,{shipDate:'2024-02-01',description:'Alternator wire'}),
  p('a2','AM-A',8,{shipDate:'2024-02-01',description:'LED lamp',disposition:'Installed'}),
  p('mix','AM-MIX',20,{description:'Aircraft fuel fitting',system:'Fuel'}),
  p('gift','AM-GIFT',20,{description:'Gift-card-paid harness'}),
  p('refund','AM-REFUND',10,{description:'Returned electrical fitting',disposition:'Returned'}),
  p('edmo','EDMO-1',50,{vendor:'EDMO Distributors',description:'Radio test',system:'Avionics / Instruments',shipDate:'2021-01-12'}),
  p('private','PRIVATE-1',7,{vendor:'Private seller',description:'Uninvoiced item'}),
  p('unpriced','AM-UNPRICED',0,{description:'Unknown-priced adapter',priceKnown:false}),
];
const invoices=[
  {id:'AM-A',invoice:'AM-A',vendor:'Amazon',invoiceDate:'2024-02-01',subtotal:20,tax:1.6,total:21.6},
  {id:'AM-MIX',invoice:'AM-MIX',vendor:'Amazon',invoiceDate:'2025-03-01',
    subtotal:30,aircraftLineSubtotal:20,excludedNonAircraftLineSubtotal:10,total:32.4},
  {id:'AM-GIFT',invoice:'AM-GIFT',vendor:'Amazon',invoiceDate:'2025-03-01',
    subtotal:20,total:2.6,giftCardApplied:19},
  {id:'AM-REFUND',invoice:'AM-REFUND',vendor:'Amazon',invoiceDate:'2025-03-01',
    subtotal:10,total:5,rewardsPoints:5,refundTotal:10},
  {id:'EDMO-1',invoice:'EDMO-1',vendor:'EDMO Distributors',invoiceDate:'2021-01-12',
    subtotal:50,total:60,totalIsQuotedEstimate:true},
  {id:'AS-ONLY',invoice:'AS-ONLY',vendor:'Aircraft Spruce',invoiceDate:'2025-02-02',
    subtotal:4,total:4.32,partialItems:true},
  {id:'AM-UNPRICED',invoice:'AM-UNPRICED',vendor:'Amazon',invoiceDate:'2025-03-01',
    subtotal:6,total:6.48},
];
const db={purchases,invoices};
const byId={},nodes={};
function element(value=''){
  return {value,innerHTML:'',textContent:'',id:'',style:{},dataset:{},children:[],
    classList:{contains:()=>true,add(){},remove(){}},
    attributes:{},setAttribute(k,v){this.attributes[k]=v},
    appendChild(x){this.children.push(x);if(x.id)byId[x.id]=x},
    insertBefore(x){this.appendChild(x)},
    insertAdjacentElement(_,x){this.appendChild(x)},
    querySelectorAll(){return []},
    querySelector(){return null}};
}
const controls=element(),metricGroup=element(),note=element(),search=element();
note.id='purchaseScopeSummary';byId.purchaseScopeSummary=note;
const tiles=Array.from({length:6},()=>({
  b:element(),span:element(),setAttribute(){},classList:{add(){}},
  querySelector(selector){return selector==='b'?this.b:selector==='span'?this.span:null}
}));
const page=element();page.querySelector=x=>({
  '.purchase-controls':controls,'.segmented':element(),
  '.purchase-metrics':metricGroup,'#purchaseScopeSummary':note
}[x]||null);
page.querySelectorAll=x=>x==='.purchase-metrics > div'?tiles:[];
byId['page-purchases']=page;
for(const id of ['purchaseSearch','purchaseVendor','purchaseDisposition','purchaseSystem','purchaseFrom','purchaseTo']){
  byId[id]=element('');
}
byId.purchaseVendor.value='Amazon';
const metricBody=element();metricBody.querySelectorAll=()=>[];byId.purchaseMetricBody=metricBody;
byId.purchaseMetricSearch=element('');
const document={
  head:{appendChild(){}},body:{appendChild(){}},
  createElement:()=>element(),
  getElementById:id=>byId[id]||null,
  querySelector:x=>x==='#page-purchases .purchase-controls'?controls:null,
  querySelectorAll:()=>[]
};
let modal='';
const ctx={window:null,document,console,db,purchaseViewMode:'parts',Map,Set,JSON,Math,Number,String,Date,Array,
  arr:x=>Array.isArray(x)?x:[],num:x=>Number(x)||0,
  val:id=>String(byId[id]?.value||''),esc:x=>String(x??''),
  pill:x=>String(x),fmtMoney:x=>'$'+(Number(x)||0).toFixed(2),
  purchaseDateISO:x=>String(x||''),
  purchaseLineTotal:x=>Number(x.qty||0)*Number(x.unitPrice||0),
  purchaseMatches:x=>{
    const q=String(byId.purchaseSearch.value||'').toLowerCase();
    const d=byId.purchaseDisposition.value,sys=byId.purchaseSystem.value;
    return (!q||[x.description,x.pn,x.invoice,x.vendor].join(' ').toLowerCase().includes(q))&&
      (!d||x.disposition===d)&&(!sys||x.system===sys);
  },
  renderPurchases:()=>{},renderPurchaseRows:()=>{},
  openModal:html=>{modal=html},
  modalHeader:(title,subtitle)=>'<h2>'+title+'</h2><p>'+subtitle+'</p>',
  openInvoiceGroup:()=>{},openPurchaseDetail:()=>{}
};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(finance,ctx,{filename:'app-25-multivendor.js'});
vm.runInContext(drill,ctx,{filename:'app-46-purchase-metric-drilldowns.js'});
const summarise=(rows,filters={})=>ctx.purchaseFilteredFinancialSummary(purchases,invoices,rows,filters);
function moneyEq(actual,expected,msg=''){assert.ok(Math.abs(actual-expected)<0.001,(msg||'Money mismatch')+': '+actual+' != '+expected)}

assert.match(core,/purchaseGroups\(db\.purchases\.filter\(purchaseMatches\)\)/,
  'Part-history groups must aggregate only the visible lines');
assert.match(core,/purchaseMatches\(p\)&&\(p\.pn\|\|p\.description\)===key/,
  'Opening filtered Part History must not show excluded transactions');

// Vendor-only: each invoice is counted once; mixed Amazon personal item excluded;
// gift cards restored to cost, rewards + complete refund net out to zero.
const amazon=purchases.filter(x=>x.vendor==='Amazon');
const am=summarise(amazon,{vendor:'Amazon'});
assert.equal(am.invoices,5);
moneyEq(am.spend,71.28,'Amazon economic spend');
moneyEq(am.itemSubtotal,70,'Amazon gross line subtotal');
assert.equal(am.allocatedInvoices,1);
assert.equal(am.unpriced,1);
assert.equal(am.unbilledCount,0);
assert.equal(am.quotedInvoices,0);

// Broad all-history view retains source-only invoice totals and tracks unmatched
// private purchases separately; it does NOT fabricate an invoice for those.
const all=summarise(purchases,{});
assert.equal(all.invoices,7);
moneyEq(all.spend,135.60,'All economic spend');
assert.equal(all.sourceOnlyInvoices,1);
assert.equal(all.unbilledCount,1);
moneyEq(all.unbilledSubtotal,7);

// Narrow search selects only one of two lines on a tax-inclusive invoice.
const searched=summarise(purchases.filter(x=>x.id==='a1'),{search:'alternator'});
assert.equal(searched.invoices,1);
moneyEq(searched.spend,12.96,'Search allocated invoice cost');
assert.equal(searched.allocatedInvoices,1);
moneyEq(searched.itemSubtotal,12);

// An all-lines invoice search is still precise if original source capture is
// incomplete (no automatic attribution of unknown line-item expenses).
const unpriced=summarise(purchases.filter(x=>x.id==='unpriced'),{search:'adapter'});
moneyEq(unpriced.spend,0,'Unpriced item must not receive guessed invoice cost');
assert.equal(unpriced.unpriced,1);

// Vendor/date subset, disposition and system combine without resetting vendor.
byId.purchaseFrom.value='2025-01-01';
byId.purchaseTo.value='2025-12-31';
assert.equal(ctx.purchaseMatches(purchases[0]),false,'Date rejects old Amazon line');
assert.equal(ctx.purchaseMatches(purchases[2]),true,'Date includes 2025 Amazon line');
assert.equal(ctx.purchaseMatches(purchases[5]),false,'Vendor rejects EDMO');
let matching=purchases.filter(ctx.purchaseMatches);
const dateScope=summarise(matching,{vendor:'Amazon',from:'2025-01-01',to:'2025-12-31'});
moneyEq(dateScope.spend,49.68,'Vendor and date keep gift/payment and refund accounting');

// Changing a visible filter recalculates six headline cards. The item-only
// modal must use the same selected scope, never an all-history reset.
ctx.purchaseRefreshMetricTiles();
moneyEq(Number(tiles[3].b.textContent.replace(/[^0-9.-]/g,'')),49.68);
byId.purchaseSearch.value='fuel';
ctx.renderPurchaseRows();
assert.equal(tiles[0].b.textContent,1);
assert.equal(tiles[1].b.textContent,1);
moneyEq(Number(tiles[3].b.textContent.replace(/[^0-9.-]/g,'')),21.60);
assert.match(note.textContent,/Filtered totals/);
ctx.openPurchaseMetricDrilldown('spend');
assert.match(modal,/\$21\.60/, 'Invoice drilldown should use active vendor/date/search');
assert.match(metricBody.innerHTML,/AM-MIX/);
assert.doesNotMatch(metricBody.innerHTML,/AM-A/, 'Filtered drilldown must not leak other invoices');

// Source-only invoices appear for the matching vendor only with broad filters.
const spruce=summarise([],{vendor:'Aircraft Spruce'});
assert.equal(spruce.invoices,1);
moneyEq(spruce.spend,4.32);
const spruceSearch=summarise([],{vendor:'Aircraft Spruce',search:'bolt'});
assert.equal(spruceSearch.invoices,0);

// Reset is local UI-only; no db data was modified by finance or drilldown.
const before=JSON.stringify(db);
ctx.purchaseClearFilters();
assert.equal(byId.purchaseVendor.value,'');
assert.equal(byId.purchaseSearch.value,'');
assert.equal(byId.purchaseFrom.value,'');
assert.equal(JSON.stringify(db),before);
console.log('PASS: real Purchases summary/drilldown modules, broad and narrow combined filters, refund/gift-card allocation, six live cards and scoped modal.');
