import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const stable=fs.readFileSync(new URL('../app-39-aircraft-ops-stable.js',import.meta.url),'utf8');
const report=fs.readFileSync(new URL('../app-72-consumption-report.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=stable.indexOf('function stableRunRichTab(tab){');
const end=stable.indexOf('\nsetOpsTab=function(tab)',start);
assert.ok(start>0&&end>start,'Stable Ops renderer not found');
const extracted=stable.slice(start,end);
const order=[];
let shortcut='',errorCount=0,existingShortcut=false;
const opsBox={
  querySelector:()=>existingShortcut?{}:null,
  insertAdjacentHTML(_position,content){shortcut=content;existingShortcut=true;}
};
const ctx={
  window:null, console,
  stableOpsContent:()=>opsBox,
  stableOpsError:()=>{errorCount++;order.push('fallback');},
  stableRenderStatus:()=>order.push('status')
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(extracted,ctx,{filename:'stableOpsSource'});
ctx.N594ZSConsumptionReport={
  mount:()=>order.push('mount')
};

// Reproduce production race: app-72 loads before asynchronous legacy
// Aircraft Ops recovery. The old app-72 wrapper is replaced on recovery.
ctx.renderOpsReports=()=>order.push('legacy');
ctx.stableRunRichTab('reports');
assert.deepEqual(order,['legacy','mount'],
  'Stable Reports tab must mount the report even when runtime overwrites the earlier wrapper');
order.length=0;

// When legacy rich rendering has not finished, its fallback must still show
// a report once the data report is loaded.
delete ctx.renderOpsReports;
ctx.stableRunRichTab('reports');
assert.deepEqual(order,['fallback','mount'],
  'Even the fallback should mount the consumables report');
assert.equal(errorCount,1);
order.length=0;

// Existing direct mount wrapper remains idempotent; a non-report tab never
// mounts the Parts & Consumables report.
ctx.renderOpsConsumables=()=>order.push('consumables');
ctx.stableRunRichTab('consumables');
assert.deepEqual(order,['consumables']);
assert.match(shortcut,/Open Usage Report/);
assert.match(shortcut,/setOpsTab\('reports'\)/);
order.length=0;
ctx.renderOpsCosts=()=>order.push('costs');
ctx.stableRunRichTab('costs');
assert.deepEqual(order,['costs']);

assert.match(report,/window\.N594ZSConsumptionReport=Object\.freeze\(\{collect,aggregate,summary,csv,mount\}\)/);
assert.match(report,/document\.getElementById\('consumptionReportPanel'\)/,
  'Report mount must stay idempotent across rich renderer and lifecycle hooks');
assert.match(index,/app-39-aircraft-ops-stable\.js\?v=5\.19\.79/);
assert.match(index,/app-72-consumption-report\.js\?v=5\.19\.79/);
console.log('PASS: consumables report survives asynchronous runtime recovery, renders under Reports, and has a Consumables shortcut');