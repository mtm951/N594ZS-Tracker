import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ui=fs.readFileSync(new URL('../app-68-kitfox-manual-checklists.js',import.meta.url),'utf8');
const script=fs.readFileSync(new URL('../app-11-checklists.js',import.meta.url),'utf8');
const src='kitfox-912-64825-000-dec2001';
const mk=(ch,name,items)=>({id:'manual-'+ch,kitfoxManualPack:src,manualChapter:ch,
  name,sourcePages:ch==='B'?'6–13':ch==='C'?'14–19':'66–75',notes:'Source PDF verified',
  items:items.map((i,n)=>({id:ch+'-'+(n+1),manualStep:ch+'.'+(n+1),sourcePage:12,
    text:i[0],manualInstruction:i[1],sourceGap:!!i[2],done:false,reviewStatus:'Pending',note:''}))});
const B=mk('B','B — Engine Mount',[
  ['Inspect mounting hardware','Install hardware per Fig. B-4; ream alignment and verify fit.'],
  ['Verify mount-to-fuselage contact','Correct mount bushings and do not use sheetmetal as a shim.']]);
const C=mk('C','C — Round Cowl',[['Fit lower round cowl','Trim round cowl per source page']]);
const L=mk('L','L — Electrical',[['Step 3 absent','L.3 not printed in supplied PDF',true]]);
const other={id:'other',name:'Owner existing checklist',items:[{id:'o',done:false}]};
const db={checklists:[B,C,L,other],docs:[{id:1789567365526,name:'Owner local Kitfox manual'}]};
for(const c of [B,C,L])c.documentId=1789567365526;
// Simulate a stale pre-v5.19.39 client that toggled only `done` without review metadata.
B.items[0].done=true;
const alerts=[],modal=[];let changes=0;
const root={
  console,window:null,db,Map,Set,Array,Date,String,Number,Math,Object,
  currentDetail:null,esc:s=>String(s??'').replace(/</g,'&lt;'),
  arr:a=>Array.isArray(a)?a:[],checklistById:id=>db.checklists.find(x=>x.id===id),
  docById:id=>db.docs.find(x=>x.id===id),projectById:()=>null,pill:s=>s,
  modalHeader:s=>'<h2>'+s+'</h2>',openModal:s=>modal.push(s),
  alert:msg=>alerts.push(msg),confirm:()=>true,today:()=> '2026-09-26',
  trackerStore:{update(type,id,mutator){assert.equal(type,'checklist');const c=db.checklists.find(x=>x.id===id);mutator(c);changes++}},
  document:{getElementById:()=>null,createElement:()=>({innerHTML:'',firstElementChild:null})},
  textareaField:()=>'<textarea id="kmReviewNote"></textarea>',val:()=> 'Reviewed Kitfox clarification',
  getAttachments:async(type,id)=>{
    assert.equal(type,'document');assert.equal(id,1789567365526);
    return [{id:'n594zs/document/1789567365526/file__3_Newer_Engine_install_912_64825-000.pdf',
      name:'3_Newer_Engine_install_912_64825-000.pdf',type:'application/pdf'}];
  },
  openAttachmentPage:async(id,page)=>{root.openedSource={id,page};return true},
  openDocumentDetail:id=>{root.openedDocument=id}
};root.window=root;
vm.createContext(root);
vm.runInContext(script,root);
vm.runInContext(ui,root);
assert.equal(root.kitfoxManualChecklistStats(B).verified,0,'Legacy done=true/Pending must not count as verified');
assert.equal(root.kitfoxManualChecklistStats(C).na,0);
assert.equal(root.kitfoxManualChecklistStats(other).total,1);
root.openKitfox912ManualChecklist('manual-B');
assert.match(modal.at(-1),/Section B/);
assert.match(modal.at(-1),/Manual p.12/);
assert.match(modal.at(-1),/Open PDF p.12/);
assert.match(modal.at(-1),/Open source PDF at this section/);
assert.match(modal.at(-1),/Fig. B-4/);
await root.openKitfoxManualSourcePage('manual-B','B-1');
assert.equal(root.openedSource.page,12);
assert.match(root.openedSource.id,/3_Newer_Engine_install_912_64825-000\.pdf$/);
assert.match(modal.at(-1),/not an airworthiness signoff/i);
root.setKitfoxManualStep('manual-B','B-1','verify');
assert.equal(B.items[0].done,true,'One click must normalize stale done=true/Pending into a real verification');
assert.equal(B.items[0].reviewStatus,'Verified');
assert.equal(B.items[0].reviewedDate,'2026-09-26');
root.setKitfoxManualStep('manual-B','B-2','attention');
assert.equal(B.items[1].reviewStatus,'Needs Attention');
assert.equal(root.kitfoxManualChecklistStats(B).attention,1);
root.setKitfoxManualStep('manual-B','B-2','na');
assert.equal(root.kitfoxManualChecklistStats(B).na,1);
assert.equal(root.kitfoxManualChecklistStats(B).percent,100);
root.setKitfoxManualStep('manual-L','L-1','verify');
assert.equal(L.items[0].done,false,'Missing manual step must NOT be marked verified without evidence');
assert.ok(alerts.at(-1).includes('L.3'));
root.setKitfoxManualStep('manual-L','L-1','na');
assert.equal(L.items[0].reviewStatus,'Pending','Source gap cannot be disguised as N/A');
L.items[0].note='Kitfox provided written clarification, filed separately';
root.setKitfoxManualStep('manual-L','L-1','verify');
assert.equal(L.items[0].reviewStatus,'Verified');
root.openKitfox912ManualChecklist('manual-C');
assert.match(modal.at(-1),/round/);
assert.match(modal.at(-1),/Mark alternate cowl chapter N\/A/);
assert.equal(other.items[0].done,false,'Never touch unrelated owner checklists');
assert.equal(changes,4);
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(html.includes('app-68-kitfox-manual-checklists.js?v=5.19.45'));
assert.ok(html.includes('app-11-checklists.js?v=5.19.40'));
assert.match(script,/isManual\?items\.filter\(i=>i\.reviewStatus==='Verified'\)\.length/,'Checklist list progress must also ignore stale done-only state');
console.log('PASS: source-backed manual chapter UI, direct private-PDF page routing, review/N-A/finding states, L.3 gap guard, unchanged other checklists and correct deployment references.');
