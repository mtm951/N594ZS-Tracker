import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-20-workflow.js',import.meta.url),'utf8');
const start=source.indexOf('function projectQuickStepRow(');
const end=source.indexOf('const openProjectModalWorkflowBase=',start);
assert.ok(start>=0&&end>start,'quick-step helper block missing');
const helpers=source.slice(start,end);

function makeRow(id,text,done=false){
  const input={value:text,focused:false,focus(){this.focused=true},closest(sel){if(sel==='.project-quick-step-text')return this;return sel==='[data-project-step-row]'?row:null}};
  const check={checked:done};
  const row={
    dataset:{stepId:id==null?'':String(id)},parentElement:null,
    querySelector(sel){
      if(sel==='.project-quick-step-text')return input;
      if(sel==='.project-quick-step-check')return check;
      return null;
    }
  };
  return {row,input,check};
}

const a=makeRow(11,'Remove old broken connector',true);
const b=makeRow('step-b','Strip 1/4" insulation',false);
const blank=makeRow('', '', false);
let rows=[a.row,b.row,blank.row];
const list={querySelectorAll:sel=>sel==='[data-project-step-row]'?rows:[],addEventListener(){}};
rows.forEach(r=>r.parentElement=list);
let nextId=100;
const document={
  getElementById:id=>id==='prQuickSteps'?list:null,
  createElement:()=>({innerHTML:'',firstElementChild:null})
};
const ctx={
  console,document,window:null,
  esc:v=>String(v??''),
  uid:()=>++nextId,
  projectSteps:p=>Array.isArray(p?.steps)?[...p.steps].sort((x,y)=>(x.order||0)-(y.order||0)):[],
  Map,Array,String,Object
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(helpers,ctx,{filename:'quick-step-helpers.js'});

const project={steps:[
  {id:11,text:'Old text',done:false,note:'Keep this acceptance note',order:1,custom:'keep'},
  {id:'step-b',text:'Old second',done:true,note:'',order:2}
]};
const draft=ctx.projectQuickStepDraft(project);
assert.equal(draft.length,2,'trailing blank row must not become a saved task');
assert.deepEqual({...draft[0]},{
  id:11,text:'Remove old broken connector',done:true,note:'Keep this acceptance note',order:1,custom:'keep'
},'editing inline must preserve existing step metadata and ID');
assert.equal(draft[1].id,'step-b','string step IDs must be preserved');
assert.equal(draft[1].text,'Strip 1/4" insulation');
assert.equal(draft[1].done,false);
assert.equal(draft[1].order,2);

// Tab moves directly from one task text field to the next task text field,
// rather than forcing the owner through remove buttons or other controls.
let prevented=0;
ctx.projectQuickStepKeydown({
  target:a.input,key:'Tab',shiftKey:false,
  preventDefault(){prevented++}
});
assert.equal(prevented,1);
assert.equal(b.input.focused,true);

// Existing rows are rendered with checkbox + text input + remove affordance,
// and saved notes are visibly acknowledged without expanding the editor.
const rowHTML=ctx.projectQuickStepRow(project.steps[0]);
assert.match(rowHTML,/project-quick-step-check/);
assert.match(rowHTML,/project-quick-step-text/);
assert.match(rowHTML,/data-project-step-remove/);
assert.match(rowHTML,/details saved/);

assert.match(source,/press <b>Tab<\/b> or <b>Enter<\/b> to start the next line/);
assert.match(source,/Paste multiple lines to create multiple tasks/);
assert.match(source,/if\(input\.value\.trim\(\)\)\{event\.preventDefault\(\);return addProjectQuickStep\(row,true\)\}/,
  'Tab on the final filled row must create/focus a new line');
assert.match(source,/raw\.split\(\/\\r\?\\n\//,'multi-line paste must split into individual tasks');
assert.match(source,/document\.getElementById\('prPlan'\)\?\.parentElement/,'task builder should sit next to Plan / Notes');
assert.match(source,/p\.steps=stepDraft===null\?arr\(p\.steps\):stepDraft/,'Save Project must commit the inline task draft');

console.log('inline Project task builder draft, keyboard flow, metadata preservation and placement tests passed');
