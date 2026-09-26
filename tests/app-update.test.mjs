import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pwaSource=fs.readFileSync(new URL('../app-19-pwa.js',import.meta.url),'utf8');
const reliabilitySource=fs.readFileSync(new URL('../app-45-reliability.js',import.meta.url),'utf8');
// Backup labels must reflect the installed build; a stale static label once
// made valid Sep 23 core exports claim app version 5.6.0.
const declaration=reliabilitySource.match(/const VER=([^,]+),REC=/);
assert.ok(declaration,'the reliability module lost its backup version expression');
const displayedVersion=vm.runInNewContext(declaration[1],{APP_VERSION:'5.19.21'});
assert.equal(displayedVersion,'5.19.21','backup manifest version did not follow the active build');
assert.match(reliabilitySource,/manifest=\{format:'N594ZS_BACKUP_MANIFEST_V1',appVersion:VER/);


function makeStorage(initial={}){
  const map=new Map(Object.entries(initial));
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key),
    dump:()=>Object.fromEntries(map)
  };
}

function makeHarness({online=true,pending=false,confirmResult=true,saveClears=true,fetchOk=true}={}){
  const listeners={};
  const unregisterCalls=[],deletedCaches=[],fetchCalls=[],replacements=[],alerts=[],toasts=[];
  const localStorage=makeStorage({
    n594zs_pending_cloud_v4:pending?'1':'0',
    n594zs_v3:'KEEP-TRACKER-DATA',
    other_key:'KEEP-ME'
  });

  const serviceWorker={
    async getRegistrations(){
      return [
        {scope:'https://mtm951.github.io/N594ZS-Tracker/',unregister:async()=>{unregisterCalls.push('tracker');return true}},
        {scope:'https://example.test/other-app/',unregister:async()=>{unregisterCalls.push('other');return true}}
      ];
    }
  };

  const context={
    console,Promise,Date,Map,Set,Object,Array,String,Number,Boolean,Error,URL,
    localStorage,
    navigator:{onLine:online,serviceWorker},
    caches:{
      async keys(){return ['n594zs-old-shell','other-app-cache','n594zs-temp']},
      async delete(key){deletedCaches.push(key);return true}
    },
    fetch:async(url,opts)=>{
      fetchCalls.push({url:String(url),opts});
      return {ok:fetchOk,status:fetchOk?200:503};
    },
    confirm:()=>confirmResult,
    alert:message=>alerts.push(String(message)),
    toast:(message,type)=>toasts.push({message,type}),
    currentPage:'settings',
    renderSystem:()=>{},
    document:{
      getElementById:()=>null,
      body:{appendChild(){}},
      createElement:()=>({remove(){},className:'',id:'',textContent:''})
    },
    location:{
      href:'https://mtm951.github.io/N594ZS-Tracker/?old=1#settings',
      replace:url=>replacements.push(String(url))
    },
    saveCloudState:async()=>{
      if(saveClears)localStorage.removeItem('n594zs_pending_cloud_v4');
    }
  };
  context.window=context;
  context.window.location=context.location;
  context.window.addEventListener=(name,fn)=>{listeners[name]=fn};
  vm.createContext(context);
  vm.runInContext(pwaSource,context,{filename:'app-19-pwa.js'});

  return {context,localStorage,listeners,unregisterCalls,deletedCaches,fetchCalls,replacements,alerts,toasts};
}

// A successful force-update keeps tracker data, checks the network without cache,
// clears only N594ZS app caches/service workers, and reloads with a cache-busting URL.
{
  const h=makeHarness();
  const before=h.localStorage.dump();
  const result=await h.context.forceLatestAppVersion();

  assert.equal(result,true);
  assert.equal(h.fetchCalls.length,1);
  assert.equal(h.fetchCalls[0].opts.cache,'no-store');
  assert.equal(h.fetchCalls[0].opts.credentials,'same-origin');
  assert.match(h.fetchCalls[0].url,/forceUpdate=/);
  assert.equal(h.replacements.length,1);
  assert.match(h.replacements[0],/forceUpdate=/);
  assert.equal(h.replacements[0].includes('#settings'),false,'force update preserved stale hash');
  assert.deepEqual(h.unregisterCalls,['tracker']);
  assert.deepEqual(h.deletedCaches.sort(),['n594zs-old-shell','n594zs-temp'].sort());
  assert.equal(h.localStorage.getItem('n594zs_v3'),before.n594zs_v3);
  assert.equal(h.localStorage.getItem('other_key'),before.other_key);
}

// Pending cloud changes are flushed before the version reload.
{
  const h=makeHarness({pending:true,saveClears:true});
  let saveCalls=0;
  h.context.saveCloudState=async()=>{
    saveCalls++;
    h.localStorage.removeItem('n594zs_pending_cloud_v4');
  };
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,true);
  assert.equal(saveCalls,1);
  assert.equal(h.fetchCalls.length,1);
  assert.equal(h.replacements.length,1);
}

// If pending changes remain after a save attempt, updating is cancelled instead of risking a reload.
{
  const h=makeHarness({pending:true,saveClears:false});
  let saveCalls=0;
  h.context.saveCloudState=async()=>{saveCalls++};
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,false);
  assert.equal(saveCalls,1);
  assert.equal(h.fetchCalls.length,0);
  assert.equal(h.replacements.length,0);
  assert.equal(h.deletedCaches.length,0);
  assert.ok(h.alerts.some(x=>/unsynced changes/i.test(x)));
}

// Offline devices do not throw away their current app shell in a futile update attempt.
{
  const h=makeHarness({online:false});
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,false);
  assert.equal(h.fetchCalls.length,0);
  assert.equal(h.replacements.length,0);
  assert.equal(h.deletedCaches.length,0);
  assert.ok(h.alerts.some(x=>/network connection/i.test(x)));
}

// Cancelling the confirmation is a no-op.
{
  const h=makeHarness({confirmResult:false});
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,false);
  assert.equal(h.fetchCalls.length,0);
  assert.equal(h.replacements.length,0);
}

// A stale SW API must not leave the update button hanging indefinitely.
{
  const h=makeHarness();
  h.context.navigator.serviceWorker.getRegistrations=()=>new Promise(()=>{});
  h.context.setTimeout=(fn,ms)=>ms===3000?(queueMicrotask(fn),0):setTimeout(fn,ms);
  h.context.clearTimeout=id=>clearTimeout(id);
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,true,'Timed-out service-worker cleanup must not block a verified reload');
  assert.equal(h.replacements.length,1);
}

// Network preflight is time-bounded and fails safely with a visible error.
{
  const h=makeHarness();
  h.context.fetch=()=>new Promise(()=>{});
  h.context.setTimeout=(fn,ms)=>ms===8000?(queueMicrotask(fn),0):setTimeout(fn,ms);
  h.context.clearTimeout=id=>clearTimeout(id);
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,false);
  assert.equal(h.replacements.length,0);
  assert.ok(h.alerts.some(x=>/timed out/i.test(x)));
}

// An untrusted/non-tracker HTML response must never replace a working session.
{
  const h=makeHarness();
  h.context.fetch=async()=>({ok:true,status:200,text:async()=>'<h1>Not a tracker page</h1>'});
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,false);
  assert.equal(h.deletedCaches.length,0);
  assert.equal(h.replacements.length,0);
  assert.ok(h.alerts.some(x=>/tracker release/i.test(x)));
}

// A valid latest tracker HTML produces a genuine forceUpdate navigation.
{
  const h=makeHarness();
  const updates=[],buttons=[{disabled:false,textContent:''}],labels=[{textContent:''}];
  h.context.document.querySelectorAll=selector=>selector==='[data-tracker-update-button]'?buttons:
    selector==='[data-tracker-update-status]'?labels:[];
  h.context.fetch=async()=>({ok:true,status:200,text:async()=>
    '<script src="app-01-seed.js?v=5.19.35"></script>'});
  const result=await h.context.forceLatestAppVersion();
  assert.equal(result,true);
  assert.equal(h.replacements.length,1);
  assert.match(labels[0].textContent,/Reloading/i,'No visible update progress');
  assert.equal(buttons[0].disabled,true);
}

console.log('force latest app version regression tests passed');
