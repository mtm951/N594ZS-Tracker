import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const full=fs.readFileSync(new URL('../app-18-enhancements.js',import.meta.url),'utf8');
const match=full.match(/let maintenanceSort=\{key:'status',dir:'asc'\};[\s\S]*?function sortMaintenanceRows\(rows\)\{[\s\S]*?\n\}/);
assert.ok(match,'maintenance sort helper block not found');

const db={aircraft:{engineHours:'100',airframeHours:'200'}};
let renderCalls=0;
const ctx={
  console,db,Intl,Date,Number,String,Math,
  esc:v=>String(v??''),
  document:{
    querySelectorAll:()=>[]
  },
  maintenanceDueInfo:m=>({
    status:m.dueStatus,
    dueDate:m.dueDate||'',
    dueHours:m.dueHours??'',
    reason:''
  }),
  renderMaintenanceRows:()=>{renderCalls++}
};
vm.createContext(ctx);
vm.runInContext(match[0],ctx,{filename:'maintenance-sort-helpers.js'});

const rows=[
  {id:1,title:'Carb sync',system:'Engine',basis:'hours',meter:'engine',dueStatus:'Due Soon',dueHours:105},
  {id:2,title:'Annual inspection',system:'Airframe',basis:'date',meter:'airframe',dueStatus:'OK',dueDate:'2099-01-01'},
  {id:3,title:'Oil change',system:'Engine',basis:'hours',meter:'engine',dueStatus:'Due',dueHours:95},
  {id:4,title:'Mystery item',system:'General',basis:'hours',meter:'engine',dueStatus:'OK',dueHours:''}
];

// Default preserves the existing urgent-first Status ordering.
let sorted=ctx.sortMaintenanceRows(structuredClone(rows));
assert.deepEqual(sorted.map(x=>x.id),[3,1,2,4]);

// Next Due ascending uses actual urgency relative to the current meter.
// Overdue first, then nearest upcoming, distant date, unset last.
ctx.setMaintenanceSort('next');
sorted=ctx.sortMaintenanceRows(structuredClone(rows));
assert.deepEqual(sorted.map(x=>x.id),[3,1,2,4]);
assert.equal(renderCalls,1);

// Reverse Next Due keeps unset values at the bottom.
ctx.setMaintenanceSort('next');
sorted=ctx.sortMaintenanceRows(structuredClone(rows));
assert.deepEqual(sorted.map(x=>x.id),[2,1,3,4]);

// Item and System are normal bidirectional text sorts.
ctx.setMaintenanceSort('item');
sorted=ctx.sortMaintenanceRows(structuredClone(rows));
assert.deepEqual(sorted.map(x=>x.title),['Annual inspection','Carb sync','Mystery item','Oil change']);
ctx.setMaintenanceSort('system');
sorted=ctx.sortMaintenanceRows(structuredClone(rows));
assert.deepEqual(sorted.map(x=>x.system),['Airframe','Engine','Engine','General']);

// Basis presents friendly labels and is sortable.
ctx.setMaintenanceSort('basis');
sorted=ctx.sortMaintenanceRows(structuredClone(rows));
assert.deepEqual(sorted.map(x=>ctx.maintenanceBasisLabel(x)),['Date','Hours','Hours','Hours']);

// Headers are actual buttons with arrows/aria sorting.
const head=ctx.maintenanceSortHead('Next due','next');
assert.match(head,/maintenance-sort-button/);
assert.match(head,/setMaintenanceSort\('next'\)/);
assert.match(head,/↕|▲|▼/);

assert.match(full,/maintenanceSortHead\('Item','item'\)/);
assert.match(full,/maintenanceSortHead\('System','system'\)/);
assert.match(full,/maintenanceSortHead\('Basis','basis'\)/);
assert.match(full,/maintenanceSortHead\('Next due','next'\)/);
assert.match(full,/maintenanceSortHead\('Status','status'\)/);

console.log('maintenance sortable-column and due-urgency regression tests passed');
