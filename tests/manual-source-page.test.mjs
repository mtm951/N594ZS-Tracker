import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-13-attachments.js',import.meta.url),'utf8');
let signedArgs=null;
const opened=[];
const tab={location:{href:''},opener:{},close(){this.closed=true}};
const ctx={
  console,window:null,document:{getElementById:()=>null,body:{appendChild(){}}},
  indexedDB:{open(){throw new Error('IndexedDB should not be used for cloud signed-page test')}},
  WORKSPACE_SLUG:'n594zs',crypto:{randomUUID:()=> 'uuid'},uid:()=>1,
  cloudSession:{user:{id:'user-1'}},cloudWorkspaceId:'workspace-1',
  supa:{storage:{from(bucket){
    assert.equal(bucket,'n594zs-files');
    return {
      createSignedUrl:async(path,seconds)=>{
        signedArgs={path,seconds};
        return {data:{signedUrl:'https://private.example/signed.pdf?token=secret'},error:null};
      }
    };
  }}},
  URL:{createObjectURL(){throw new Error('Blob URL should not be used for shared cloud attachment')},revokeObjectURL(){}},
  setTimeout:()=>0,clearTimeout(){},alert:msg=>{throw new Error('Unexpected alert: '+msg)},
  objectUrls:[],formatBytes:()=>'',esc:String,reopenDetail(){},toast(){},renderStorageStats(){},
  windowOpen(url,target){opened.push({url,target});return tab}
};
ctx.window=ctx;
ctx.window.open=(url,target)=>{opened.push({url,target});return tab};
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'app-13-attachments.js'});

const path='n594zs/document/1789567365526/file__3_Newer_Engine_install_912_64825-000.pdf';
const ok=await ctx.openAttachmentPage(path,36);
assert.equal(ok,true);
assert.deepEqual(signedArgs,{path,seconds:900});
assert.equal(opened[0].url,'about:blank');
assert.equal(tab.location.href,'https://private.example/signed.pdf?token=secret#page=36');
assert.equal(tab.opener,null);

console.log('private attachment signed-page opener regression test passed');
