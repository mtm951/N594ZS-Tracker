import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-13-attachments.js',import.meta.url),'utf8');
let downloadPath=null,revokeCalls=[];
const opened=[];
const fakeBlob={type:'application/pdf',size:1528649};
const tab={
  location:{
    href:'',
    replace(url){this.href=url}
  },
  opener:{},
  close(){this.closed=true}
};
const ctx={
  console,window:null,document:{getElementById:()=>null,body:{appendChild(){}}},
  indexedDB:{open(){throw new Error('IndexedDB should not be used for cloud PDF page test')}},
  WORKSPACE_SLUG:'n594zs',crypto:{randomUUID:()=> 'uuid'},uid:()=>1,
  cloudSession:{user:{id:'user-1'}},cloudWorkspaceId:'workspace-1',
  supa:{storage:{from(bucket){
    assert.equal(bucket,'n594zs-files');
    return {
      download:async path=>{
        downloadPath=path;
        return {data:fakeBlob,error:null};
      },
      createSignedUrl:async()=>{throw new Error('Signed URL path must not be used for PDF page jumps')}
    };
  }}},
  URL:{
    createObjectURL(blob){
      assert.equal(blob,fakeBlob);
      return 'blob:https://tracker.example/manual-pdf';
    },
    revokeObjectURL(url){revokeCalls.push(url)}
  },
  setTimeout:fn=>{fn();return 1},clearTimeout(){},
  alert:msg=>{throw new Error('Unexpected alert: '+msg)},
  objectUrls:[],formatBytes:()=>'',esc:String,reopenDetail(){},toast(){},renderStorageStats(){}
};
ctx.window=ctx;
ctx.window.open=(url,target)=>{opened.push({url,target});return tab};
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'app-13-attachments.js'});

const path='n594zs/document/1789567365526/file__3_Newer_Engine_install_912_64825-000.pdf';
const ok=await ctx.openAttachmentPage(path,36);
assert.equal(ok,true);
assert.equal(downloadPath,path);
assert.equal(opened[0].url,'about:blank');
assert.equal(tab.location.href,'blob:https://tracker.example/manual-pdf#page=36&zoom=page-width');
assert.equal(tab.opener,null);
assert.ok(ctx.objectUrls.includes('blob:https://tracker.example/manual-pdf'));
assert.deepEqual(revokeCalls,['blob:https://tracker.example/manual-pdf']);

console.log('private attachment blob-page opener regression test passed');
