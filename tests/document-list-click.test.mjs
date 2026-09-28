import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-05-views.js',import.meta.url),'utf8');
const start=source.indexOf("let docSort=");
const end=source.indexOf('\nfunction renderLogbook',start);
assert.ok(start>=0&&end>start,'Documents renderer section not found');
const renderSource=source.slice(start,end);

const rowTarget={innerHTML:'',querySelectorAll:()=>[]};
const controls={docSearch:'',docType:''};
const db={docs:[
  {id:301,name:'Zulu legacy document',type:'Manual',revision:'R1',system:'Engine',publisher:'Maker',location:'Add current revision / link',notes:'',linkedProjectIds:[]},
  {id:'earthx-etx-111017-ae',name:'Alpha stable string document',type:'Battery manual',revision:'111017_AE',system:'Electrical',publisher:'EarthX',location:'https://example.test/earthx.pdf',notes:'',linkedProjectIds:[101]},
  {id:'missing-source-doc',name:'Middle missing source',type:'As-built diagram',revision:'',system:'Fuel',publisher:'Owner',location:'Create / update final as-built schematic',notes:'',linkedProjectIds:[101,102]}
]};
const attachmentMap={
  'earthx-etx-111017-ae':[{id:'cloud/path/earthx.pdf',name:'earthx.pdf',type:'application/pdf',size:100}],
  '301':[],
  'missing-source-doc':[]
};
const doc={
  getElementById:id=>id==='docRows'?rowTarget:null,
  querySelectorAll:()=>[],
  querySelector:()=>null
};
const ctx={
  db,document:doc,window:{},console,
  arr:v=>Array.isArray(v)?v:[],
  val:id=>String(controls[id]??''),
  esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  isURL:value=>/^https?:\/\//i.test(String(value||'')),
  getAttachments:async(_type,id)=>attachmentMap[String(id)]||[],
  openDocumentDetail(){},openDocModal(){},openAttachment:async()=>{}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(renderSource,ctx);
ctx.renderDocRows();

let html=rowTarget.innerHTML;
assert.ok(html.indexOf('Alpha stable string document')<html.indexOf('Middle missing source'));
assert.ok(html.indexOf('Middle missing source')<html.indexOf('Zulu legacy document'),'default Document sort should be ascending by name');
assert.match(html,/data-doc-row="301"/,'numeric document row must carry a safe string data ID');
assert.match(html,/data-doc-row="earthx-etx-111017-ae"/,'stable string document row must carry its exact ID');
assert.match(html,/data-doc-open="earthx-etx-111017-ae"/,'document name must be an explicit clickable control');
assert.match(html,/data-doc-edit="earthx-etx-111017-ae"/,'Edit must be string-ID safe');
assert.doesNotMatch(html,/openDocumentDetail\(earthx-etx-111017-ae\)/,'string ID must never be emitted as a bare JavaScript expression');
assert.match(html,/href="https:\/\/example\.test\/earthx\.pdf"/,'Web link must be direct and immediately visible');
assert.match(html,/Checking files/);

const earthx=db.docs[1],missing=db.docs[2];
const earthxInfo=await ctx.documentSourceInfo(earthx);
const earthxFinal=ctx.finalDocumentSourceHTML(earthx,earthxInfo);
assert.match(earthxFinal,/PDF attached • Open PDF/);
assert.match(earthxFinal,/Web link/,'URL should remain available when a PDF is attached');

const missingInfo=await ctx.documentSourceInfo(missing);
const missingFinal=ctx.finalDocumentSourceHTML(missing,missingInfo);
assert.match(missingFinal,/Needs file \/ link/);
assert.match(missingFinal,/Create \/ update final as-built schematic/,'location/action note should remain visible beneath status');

ctx.setDocSort('projects');
html=rowTarget.innerHTML;
assert.ok(html.indexOf('Zulu legacy document')<html.indexOf('Alpha stable string document'),'first Linked projects click should sort ascending');
ctx.setDocSort('projects');
html=rowTarget.innerHTML;
assert.ok(html.indexOf('Middle missing source')<html.indexOf('Alpha stable string document'),'second Linked projects click should sort descending');

console.log('Documents sort, string-ID clickability, source status and direct-source regression tests passed');
