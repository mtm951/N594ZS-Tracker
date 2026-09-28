import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-05-views.js',import.meta.url),'utf8');
const start=source.indexOf('function renderDocRows(){');
const end=source.indexOf('\n\nfunction renderLogbook',start);
assert.ok(start>=0&&end>start,'renderDocRows function not found');
const renderSource=source.slice(start,end);

const rowTarget={innerHTML:''};
const controls={docSearch:'',docType:''};
const db={docs:[
  {id:301,name:'Legacy numeric document',type:'Manual',revision:'R1',system:'Engine',publisher:'Maker',location:'',notes:'',linkedProjectIds:[]},
  {id:'earthx-etx-111017-ae',name:'Stable string document',type:'Battery manual',revision:'111017_AE',system:'Electrical',publisher:'EarthX',location:'https://example.test/earthx.pdf',notes:'',linkedProjectIds:[101]}
]};
const ctx={
  db,
  document:{getElementById:id=>id==='docRows'?rowTarget:null},
  val:id=>String(controls[id]??''),
  esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  isURL:value=>/^https?:\/\//i.test(String(value||'')),
  console
};
vm.createContext(ctx);
vm.runInContext(renderSource,ctx);
ctx.renderDocRows();

const html=rowTarget.innerHTML;
assert.match(html,/openDocumentDetail\("301"\)/,'legacy numeric document row must still open');
assert.match(html,/openDocumentDetail\("earthx-etx-111017-ae"\)/,'string-ID document row must be safely quoted and open');
assert.match(html,/openDocModal\("earthx-etx-111017-ae"\)/,'string-ID Edit button must be safely quoted');
assert.doesNotMatch(html,/openDocumentDetail\(earthx-etx-111017-ae\)/,'string ID must never be emitted as a bare JavaScript expression');
assert.match(html,/href="https:\/\/example\.test\/earthx\.pdf"/,'Web link pill must be a real direct link');
assert.match(html,/target="_blank"/);
assert.match(html,/rel="noopener noreferrer"/);

console.log('document list string-ID clickability and direct web-link regression tests passed');
