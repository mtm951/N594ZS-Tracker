import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../app-13-attachments.js',import.meta.url),'utf8');
let downloadPath=null,revokeCalls=[],modalHTML='',renderedPage=null;
const opened=[];
const fakeBlob={
  type:'application/pdf',size:1528649,
  arrayBuffer:async()=>new ArrayBuffer(16)
};
const tab={
  location:{href:'',replace(url){this.href=url}},
  opener:{},
  close(){this.closed=true}
};
const elements={
  manualPdfCanvas:{
    width:0,height:0,style:{},
    getContext(){return {}}
  },
  manualPdfViewport:{clientWidth:390,scrollTop:9,scrollLeft:7},
  manualPdfStatus:{textContent:''},
  manualPdfPageInput:{value:''},
  manualPdfPageCount:{textContent:''},
  manualPdfPrev:{disabled:false},
  manualPdfNext:{disabled:false}
};
const fakePdf={
  numPages:77,
  async getPage(pageNo){
    renderedPage=pageNo;
    return {
      getViewport({scale}){return {width:612*scale,height:792*scale}},
      render(){return {promise:Promise.resolve(),cancel(){}}}
    };
  },
  async destroy(){}
};

const ctx={
  console,window:null,
  navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
  document:{
    getElementById:id=>elements[id]||null,
    body:{appendChild(){}}
  },
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
      list:async prefix=>{
        if(prefix==='n594zs/document/301'){
          return {data:[{name:'uuid__IM_912_Series_Ed3_R0.pdf',metadata:{mimetype:'application/pdf',size:8899371},created_at:'2026-09-20T23:28:39Z'}],error:null};
        }
        return {data:[],error:null};
      },
      createSignedUrl:async()=>{throw new Error('Signed URL path must not be used for PDF page jumps')}
    };
  }}},
  pdfjsLib:{
    getDocument(){
      return {promise:Promise.resolve(fakePdf)};
    }
  },
  URL:{
    createObjectURL(blob){
      assert.equal(blob,fakeBlob);
      return 'blob:https://tracker.example/manual-pdf';
    },
    revokeObjectURL(url){revokeCalls.push(url)}
  },
  setTimeout:fn=>{fn();return 1},clearTimeout(){},
  alert:msg=>{throw new Error('Unexpected alert: '+msg)},
  objectUrls:[],formatBytes:()=>'',esc:String,reopenDetail(){},toast(){},renderStorageStats(){},
  openedDocument:null,
  openDocumentDetail(id){this.openedDocument=id},
  modalHeader:(title,subtitle='')=>'<h2>'+title+'</h2><div>'+subtitle+'</div>',
  openModal:html=>{modalHTML=html}
};
ctx.window=ctx;
ctx.window.innerWidth=1440;
ctx.window.devicePixelRatio=1;
ctx.window.matchMedia=()=>({matches:false});
ctx.window.open=(url,target)=>{opened.push({url,target});return tab};

vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'app-13-attachments.js'});

const path='n594zs/document/1789567365526/file__3_Newer_Engine_install_912_64825-000.pdf';

// Desktop keeps the native blob PDF path, which already passed owner acceptance.
const ok=await ctx.openAttachmentPage(path,36);
assert.equal(ok,true);
assert.equal(downloadPath,path);
assert.equal(opened[0].url,'about:blank');
assert.equal(tab.location.href,'blob:https://tracker.example/manual-pdf#page=36&zoom=page-width');
assert.equal(tab.opener,null);
assert.ok(ctx.objectUrls.includes('blob:https://tracker.example/manual-pdf'));
assert.deepEqual(revokeCalls,['blob:https://tracker.example/manual-pdf']);

// The actual PDF.js viewer renders the exact requested page and exposes
// mobile-friendly Previous / page / Next navigation.
ctx.window.innerWidth=390;
ctx.window.devicePixelRatio=2;
const rendered=await ctx.openMobilePdfViewer(fakeBlob,36,'Kitfox 912 Install Manual');
assert.equal(rendered,true);
assert.equal(renderedPage,36);
assert.match(modalHTML,/Mobile source viewer/);
assert.match(modalHTML,/Previous/);
assert.match(modalHTML,/Next/);
assert.equal(elements.manualPdfPageInput.value,'36');
assert.equal(elements.manualPdfPageCount.textContent,'of 77');
assert.equal(elements.manualPdfStatus.textContent,'Page 36 of 77');
assert.equal(elements.manualPdfViewport.scrollTop,0);
assert.equal(elements.manualPdfViewport.scrollLeft,0);
assert.ok(elements.manualPdfCanvas.width>0);
assert.ok(elements.manualPdfCanvas.height>0);

// Phone dispatch must use the in-app renderer and must NOT open a native PDF tab.
ctx.navigator.userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
ctx.window.matchMedia=()=>({matches:true});
opened.length=0;
let mobileDispatch=null;
ctx.openMobilePdfViewer=async(blob,page,label)=>{
  mobileDispatch={blob,page,label};
  return true;
};
const mobileOk=await ctx.openAttachmentPage(path,52);
assert.equal(mobileOk,true);
assert.equal(opened.length,0,'mobile page jump opened the native PDF viewer');
assert.equal(mobileDispatch.blob,fakeBlob);
assert.equal(mobileDispatch.page,52);
assert.equal(mobileDispatch.label,'Kitfox 912 Install Manual');

// Generic source resolver maps ROTAX chapter/page citations to physical PDF pages.
const rotaxDoc={
  id:301,name:'Rotax 912 ULS Installation Manual',
  pdfPageMap:{
    '10-10-00':31,'24-00-00':45,'61-00-00':67,
    '73-00-00':101,'78-00-00':165,'79-00-00':179,'80-00-00':207
  }
};
assert.equal(ctx.sourcePdfPageFromCitation(rotaxDoc,'73-00-00 p.7'),107);
assert.equal(ctx.sourcePdfPageFromCitation(rotaxDoc,'78–00–00 p.5'),169);
assert.equal(ctx.sourcePdfPageFromCitation(rotaxDoc,'10-10-00 p.12–13'),42);

mobileDispatch=null;opened.length=0;
const rotaxOpened=await ctx.openSourceReference(rotaxDoc,'73-00-00 p.7');
assert.equal(rotaxOpened,true);
assert.equal(downloadPath,'n594zs/document/301/uuid__IM_912_Series_Ed3_R0.pdf');
assert.equal(mobileDispatch.page,107);
assert.equal(mobileDispatch.label,'Rotax 912 ULS Installation Manual');
assert.equal(opened.length,0,'attached mobile ROTAX source opened a native/external tab');

// URL-only manufacturer sources open directly rather than dead-ending at Document detail.
ctx.navigator.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
ctx.window.matchMedia=()=>({matches:false});
opened.length=0;
ctx.openedDocument=null;
const earthUrl='https://earthxbatteries.com/manual.pdf';
const earthOpened=await ctx.openSourceReference({id:'earthx',name:'EarthX Manual',sourceUrl:earthUrl},'p.13');
assert.equal(earthOpened,true);
assert.equal(opened.at(-1).url,earthUrl);
assert.equal(opened.at(-1).target,'_blank');
assert.equal(ctx.openedDocument,null);

// A source with neither attachment nor manufacturer URL falls back to its tracker Document.
opened.length=0;ctx.openedDocument=null;
const mmlOpened=await ctx.openSourceReference({id:'mml-current',name:'ROTAX MML'},'12-20-00 p.14');
assert.equal(mmlOpened,true);
assert.equal(ctx.openedDocument,'mml-current');
assert.equal(opened.length,0);

console.log('desktop/mobile PDF and generic source-document access regression tests passed');
