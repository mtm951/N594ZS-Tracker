import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-11-checklists.js',import.meta.url),'utf8');
assert.match(src,/openSourceReference\(doc,item\?\.sourcePage/,'generic checklist Source no longer routes through direct source resolver');
const seed=fs.readFileSync(new URL('../app-01-seed.js',import.meta.url),'utf8');
assert.match(seed,/const docById=id=>db\.docs\.find\(x=>String\(x\.id\)===String\(id\)\)/);

let modal='';
const modalBox={
  querySelector(){return null},
  querySelectorAll(){return []}
};
const db={
  checklists:[{
    id:'rotax-first-start',
    name:'ROTAX 912 ULS — First Start / Initial Ground Run',
    purpose:'Source-backed first start',
    trigger:'First engine start',
    system:'Engine',projectId:null,notes:'Current source pack',
    documentId:'rotax-om-912-ed4-r2-2025',
    sourceDocumentIds:['rotax-om-912-ed4-r2-2025','1789574858345','rotax-si-912-018-r4-2021'],
    rotaxSourceManaged:true,sourcePack:'rotax-912-first-start-closeout-2026',commissioningReadinessPack:true,
    items:[
      {id:'FS-P2',done:false,note:'',group:'First-start gate',
       text:'Complete oil-system purge prerequisite when applicable.',
       sourceDocumentId:'rotax-si-912-018-r4-2021',sourcePage:'SI p.2–10',
       sourceSection:'Compliance / Accomplishment',requiredBefore:'first-start',
       moreInfo:'Separate critical prerequisite before first start.'},
      {id:'8',done:false,note:'Observed during run',group:'Immediate after start',
       text:'Verify oil pressure rises immediately.',
       sourceDocumentId:'rotax-si-912-018-r4-2021',sourcePage:'SI p.8',
       sourceSection:'3.5 Warming up period',requiredBefore:'full-power',
       moreInfo:'Use the stricter post-purge criterion when applicable.'}
    ]
  }],
  docs:[
    {id:'rotax-om-912-ed4-r2-2025',name:'ROTAX 912 Series Operators Manual — Ed.4 Rev.2',revision:'Ed.4 Rev.2'},
    {id:'1789574858345',name:'ROTAX 912 Series Maintenance Manual Line',revision:'Ed.04 Rev.2'},
    {id:'rotax-si-912-018-r4-2021',name:'ROTAX SI-912-018R4 — Purging of Lubrication System',revision:'R4'}
  ],
  projects:[],parts:[],orders:[],logs:[],settings:{}
};
const ctx={
  console,window:null,db,Array,Object,String,Number,Boolean,Map,Set,Date,Math,Promise,
  arr:v=>Array.isArray(v)?v:[],
  esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  checklistById:id=>db.checklists.find(x=>String(x.id)===String(id)),
  docById:id=>db.docs.find(x=>String(x.id)===String(id)),
  projectById:()=>null,
  pill:v=>String(v??''),
  modalHeader:(a,b='')=>'<h2>'+a+'</h2><div>'+b+'</div>',
  openModal:html=>{modal=html},
  document:{getElementById:id=>id==='modalBox'?modalBox:null},
  chooseAttachments(){},handleEntityDrop(){},renderAttachments:()=>Promise.resolve(),
  openDocumentDetail(){},openProjectDetail(){},openChecklistModal(){},
  addChecklistItem(){},editChecklistItem(){},toggleChecklistItem(){},
  currentDetail:null,toast(){},field(){return''},textareaField(){return''},systemOptions(){return''},projectOptions(){return''}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'app-11-checklists.js'});

const c=ctx.checklistById('rotax-first-start');
const docs=ctx.checklistSourceDocs(c);
assert.equal(docs.length,3);
assert.equal(docs[0].id,'rotax-om-912-ed4-r2-2025');
assert.equal(ctx.checklistItemSourceDoc(c,c.items[0]).id,'rotax-si-912-018-r4-2021');

ctx.openChecklistDetail('rotax-first-start');
assert.match(modal,/First-start gate/);
assert.match(modal,/Before First Start/);
assert.match(modal,/Before Full-Power/);
assert.match(modal,/ROTAX SI-912-018R4/);
assert.match(modal,/SI p\.2–10/);
assert.match(modal,/Compliance \/ Accomplishment/);
assert.match(modal,/Separate critical prerequisite before first start/);
assert.match(modal,/Review note:<\/b> Observed during run/);
assert.match(modal,/Source Documents/);
assert.match(modal,/ROTAX 912 Series Operators Manual — Ed\.4 Rev\.2/);
assert.match(modal,/ROTAX 912 Series Maintenance Manual Line/);
assert.match(modal,/data-detail-source/);

console.log('source-backed generic checklist UI regression tests passed');
