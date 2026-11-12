import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the actual read-only reconciliation helpers extracted from production,
// not a reimplementation of the source-of-truth/deduplication logic.
const source=fs.readFileSync(new URL('../app-42-inventory-workflow.js',import.meta.url),'utf8');
const start=source.indexOf('  function projectLinkedLogUses(projectId){');
const end=source.indexOf('  function projectPartStageClass(stage){',start);
assert.ok(start>=0&&end>start,'production Project Parts reconciliation missing');
const logic=source.slice(start,end);

const data={
  parts:[
    {id:19,name:'19.8mm clamp',unit:'ea',stockQty:15,linkedProjectIds:[108]},
    {id:25,name:'25.6mm clamp',unit:'ea',stockQty:10,linkedProjectIds:[108]},
    {id:14,name:'14.5mm clamp',unit:'ea',stockQty:20,linkedProjectIds:[115]}
  ],
  projects:[
    {id:108,title:'Cooling',partsUsed:[{id:999,partId:25,qty:3,unit:'ea',logId:200,consumedItemId:201,consumptionRecorded:true}],plannedParts:[]},
    {id:115,title:'Fuel',partsUsed:[{id:995,partId:14,qty:2,unit:'ea',logId:400,consumedItemId:401,consumptionRecorded:true}],plannedParts:[]}
  ],
  logs:[
    {id:100,date:'2026-11-12',projectIds:[108],consumedParts:[{id:101,partId:19,qty:1,unit:'ea',unitCost:'0.36'}]},
    {id:200,date:'2026-10-09',projectIds:[108],consumedParts:[{id:201,partId:25,qty:3,unit:'ea'}]},
    {id:300,date:'2026-11-12',projectIds:[115],consumedParts:[{id:301,partId:14,qty:2,unit:'ea'}]},
    {id:400,date:'2026-11-11',projectIds:[115],consumedParts:[{id:401,partId:14,qty:2,unit:'ea'}]},
    {id:600,date:'2026-11-12',projectIds:[108],consumedParts:[{id:601,partId:null,name:'Uncatalogued sealant',qty:0.1,unit:'tube'}]},
    {id:700,date:'2026-11-12',projectIds:[115],consumedParts:[{id:701,partId:19,qty:2,unit:'ea'}]}
  ]
};
const state={
  db:data,
  window:null,
  arr:v=>Array.isArray(v)?v:[],
  num:v=>Number(v)||0,
  projectById:id=>data.projects.find(p=>String(p.id)===String(id)),
  partById:id=>data.parts.find(p=>String(p.id)===String(id)),
  partName:id=>data.parts.find(p=>String(p.id)===String(id))?.name||'Unknown',
  projectLinkedInventoryParts:pid=>data.parts.filter(p=>(p.linkedProjectIds||[]).some(id=>String(id)===String(pid))),
  partAvailable:p=>p.stockQty,
  partFreeQty:p=>p.stockQty
};
state.window=state;
vm.runInNewContext(logic,state);
const helper=state.N594ZSProjectConsumption;
assert.ok(helper,'helper not exported after evaluation');

const cooling=helper.workspaceRows(108);
assert.equal(cooling.find(r=>r.part?.id===19).stage,'Used','logged clamp should be Used, not Assigned');
assert.equal(cooling.find(r=>r.part?.id===19).usedQty,1,'Work Log clamp should show exactly 1 physical use');
assert.equal(cooling.find(r=>r.part?.id===25).usedQty,3,'linked project/work-log use should be counted once');
assert.equal(cooling.filter(r=>!r.part&&r.custom.name==='Uncatalogued sealant').length,1,'unlinked consumable should be visible');
assert.equal(data.projects[0].partsUsed.length,1,'read-only view must not mutate saved Project partsUsed');
assert.equal(data.parts[0].stockQty,15,'view must not modify stock');

const fuel=helper.workspaceRows(115);
assert.equal(fuel.find(r=>r.part?.id===14).usedQty,4,
  'separate Work Logs for the same physical part must remain visible; do not silently merge duplicates');
assert.equal(fuel.find(r=>r.part?.id===19).usedQty,2,'part not assigned beforehand must still appear on linked Project');
assert.equal(helper.linkedWorkLogUses(115).filter(u=>u.partId===14).length,1,
  'usage linked to a matching Project.partsUsed entry should not be added twice');
assert.match(source,/This action creates a NEW Work Log and an ADDITIONAL inventory deduction/,
  'Assigned->Use must explicitly warn when part is already marked used');
assert.match(source,/x\.fromWorkLog\?'':/, 'read-only usage entries must not offer Project removal');
assert.match(source,/var hasUse=.*projectLinkedLogUses\(project\.id\)/,
  'project unassignment must respect usage recorded solely in Work Logs');
console.log('PASS: Work Log consumption appears in Project Used, linked events dedupe, inventory untouched, duplicate-use warning');