import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const checklistSource=fs.readFileSync(new URL('../app-11-checklists.js',import.meta.url),'utf8');
const start=checklistSource.indexOf('function openChecklistDetailAtItem(');
const end=checklistSource.indexOf('\nfunction addChecklistItem',start);
assert.ok(start>=0&&end>start,'focused checklist navigation helper missing');
const helper=checklistSource.slice(start,end);

const classes=[];
const attrs={};
let opened=null,scrolled=false,focused=false;
const target={
  dataset:{checklistItemId:'item-a'},
  classList:{add:name=>classes.push(name)},
  setAttribute:(k,v)=>{attrs[k]=v},
  scrollIntoView:()=>{scrolled=true},
  focus:()=>{focused=true}
};
const box={querySelectorAll:selector=>selector==='[data-checklist-item-id]'?[target]:[]};
const ctx={
  console,window:null,String,Array,
  openChecklistDetail:id=>{opened=String(id)},
  document:{getElementById:id=>id==='modalBox'?box:null},
  requestAnimationFrame:fn=>fn(),
  setTimeout:fn=>fn()
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(helper,ctx,{filename:'focused-checklist-navigation.js'});

ctx.openChecklistDetailAtItem('pack-a','item-a');
assert.equal(opened,'pack-a');
assert.deepEqual(classes,['commissioning-focus']);
assert.equal(attrs.tabindex,'-1');
assert.equal(scrolled,true);
assert.equal(focused,true);

assert.match(checklistSource,/data-checklist-item-id=/,'checklist item rows do not expose focus targets');

const core=fs.readFileSync(new URL('../app-03-core.js',import.meta.url),'utf8');
assert.match(core,/openChecklistDetailAtItem/,'nested modal history does not recognize focused checklist navigation');
assert.match(core,/openCommissioningRequirementSource/,'nested modal history does not recognize commissioning source navigation');
assert.match(core,/openCommissioningGate/,'nested modal history does not recognize recorder-to-gate navigation');

console.log('focused commissioning requirement navigation and modal-history regression tests passed');
