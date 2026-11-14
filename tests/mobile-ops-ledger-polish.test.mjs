import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const legacy=read('app-33-aircraft-ops.js');
const stable=read('app-39-aircraft-ops-stable.js');
const css=read('mobile-ops-polish.css');
const report=read('app-72-consumption-report.js');
const index=read('index.html');

// Execute the real rich Consumables renderer with mixed units and HTML
// descriptions, not a separately reimplemented mock of the ledger.
const ledgerStart=legacy.indexOf('function renderOpsConsumables(){');
const ledgerEnd=legacy.indexOf('\n// ---------- COST ACCOUNTING ----------',ledgerStart);
assert.ok(ledgerStart>0&&ledgerEnd>ledgerStart,'rich Consumables renderer unavailable');
const htmlBox={innerHTML:''};
const db={
  parts:[
    {id:1,name:'Hose 5/8',description:'5 feet of sample hose',partType:'Consumable',unit:'ft',stockQty:10,system:'Cooling',vendor:'ACDelco',minQty:2},
    {id:2,name:'Oetiker clamp',description:'',partType:'Consumable',unit:'ea',stockQty:15,system:'Engine',vendor:'',minQty:4},
    {id:3,name:'Non consumable',partType:'Inventory',unit:'ea',stockQty:4}
  ],
  logs:[{consumedParts:[{partId:1,qty:3},{partId:2,qty:2},{partId:3,qty:5}]}]
};
const ctx={
  document:{getElementById:id=>id==='opsContent'?htmlBox:null},
  db,arr:v=>Array.isArray(v)?v:[],
  num:v=>Number(v)||0,esc:v=>String(v),
  partAvailable:p=>p.stockQty,partConsumedQty:id=>id===1?3:id===2?2:5,
};
vm.createContext(ctx);
vm.runInContext(legacy.slice(ledgerStart,ledgerEnd)+'\nrenderOpsConsumables();',ctx);
assert.match(htmlBox.innerHTML,/Consumables Ledger/);
assert.match(htmlBox.innerHTML,/id="opsConsumptionGoReport"/);
assert.match(htmlBox.innerHTML,/onclick="setOpsTab\('reports'\)"/);
assert.match(htmlBox.innerHTML,/ops-material-card/);
assert.match(htmlBox.innerHTML,/3 ft/);
assert.match(htmlBox.innerHTML,/2 ea/);
assert.match(htmlBox.innerHTML,/Work Log usage entries<\/span><b>2<\/b>/,
  'two consumption entries, not 3 feet + 2 each = five unrelated units');
assert.ok(!htmlBox.innerHTML.includes('Non consumable'),'ledger must only show Consumable part type');
assert.match(htmlBox.innerHTML,/ops-consumables-desktop/,'desktop table stays available');

// Exercise the actual stable shell renderer and inspect the mobile selector.
const stableStart=stable.indexOf('renderOps=function(){');
const stableEnd=stable.indexOf('\n// v5.1 inserted the status board',stableStart);
const stablePage={innerHTML:''};let rendered='';
const stableCtx={
  document:{getElementById:id=>id==='page-ops'?stablePage:null},
  window:{__n594zsStableOpsTab:'reports'},
  STABLE_OPS_TABS:[['status','Status / RTS'],['consumables','Consumables'],['reports','Reports']],
  esc:v=>String(v),stableRunRichTab:v=>{rendered=v;}
};
vm.createContext(stableCtx);
vm.runInContext(stable.slice(stableStart,stableEnd)+'\nrenderOps();',stableCtx);
assert.equal(rendered,'reports');
assert.match(stablePage.innerHTML,/id="opsWorkspaceSelect"/);
assert.match(stablePage.innerHTML,/<option value="reports" selected>Reports<\/option>/);
assert.match(stablePage.innerHTML,/ops-tabs-stable/,'desktop tabs stay available');
assert.match(stablePage.innerHTML,/ops-page-head/);
assert.match(stable,/!box.querySelector\('#opsConsumptionGoReport'\)/,
  'stable renderer must not duplicate the ledger own report button');

assert.match(css,/grid-template-areas:"brand status" "search search" "nav nav"/);
assert.match(css,/#page-ops \.ops-tabs-stable\{display:none!important\}/);
assert.match(css,/#page-ops \.ops-consumables-desktop\{display:none\}/);
assert.match(css,/#page-ops \.ops-consumables-mobile\{display:grid/);
assert.match(css,/#page-ops #consumptionReportPanel \.ops-report-mobile-cards/);
assert.match(report,/ops-report-mobile-cards/);
assert.match(report,/data-cr-group/);
assert.match(report,/ops-report-desktop-table/);
assert.match(index,/mobile-ops-polish\.css\?v=5\.19\.79/);
assert.match(index,/app-33-aircraft-ops\.js\?v=5\.19\.79/);
assert.match(index,/app-39-aircraft-ops-stable\.js\?v=5\.19\.79/);
assert.match(index,/app-72-consumption-report\.js\?v=5\.19\.79/);
console.log('PASS: mobile Ops layout, selectable Reports workspace, legible ledger cards and multi-unit accounting');