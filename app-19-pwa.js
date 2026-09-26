// ---------- RELEASE / PWA SAFETY ----------
window.n594zsInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.n594zsInstallPrompt=e;if(currentPage==='system'&&typeof renderSystem==='function')renderSystem()});
async function installN594ZSApp(){const e=window.n594zsInstallPrompt;if(!e)return toast('Browser install is temporarily disabled while the tracker update path is being simplified.','good');e.prompt();await e.userChoice;window.n594zsInstallPrompt=null;if(currentPage==='system'&&typeof renderSystem==='function')renderSystem()}

// v5.0.2: favor release correctness over offline shell caching.
// Retire any existing N594ZS service workers/caches so a newly deployed index and
// JavaScript bundle are fetched normally on every browser/device.
if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(r=>String(r.scope||'').includes('/N594ZS-Tracker/')).map(r=>r.unregister()));
      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>k.startsWith('n594zs-')).map(k=>caches.delete(k)));
      }
    }catch(e){console.warn('Tracker cache cleanup failed',e)}
  });
}

function trackerHasPendingCloudChanges(){
  try{
    const key=typeof CLOUD_PENDING_KEY==='string'?CLOUD_PENDING_KEY:'n594zs_pending_cloud_v4';
    return localStorage.getItem(key)==='1';
  }catch(_e){return false}
}

// Updating must show progress or a concrete failure. A hung SW/cache promise
// must never leave the button apparently inert forever.
let trackerUpdateBusy=false;
function trackerUpdateFeedback(message,busy=false){
  document.querySelectorAll?.('[data-tracker-update-status]').forEach(el=>{el.textContent=message;});
  document.querySelectorAll?.('[data-tracker-update-button]').forEach(button=>{
    button.disabled=busy;button.textContent=busy?'Updating…':'Force Latest Version';
  });
}
function trackerUpdateWithTimeout(promise,ms,label){
  if(typeof setTimeout!=='function')return Promise.resolve(promise);
  let timeoutId;
  const timeout=new Promise((_,reject)=>{timeoutId=setTimeout(
    ()=>reject(new Error(label+' timed out')),ms);
  });
  return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timeoutId));
}
async function forceLatestAppVersion(){
  if(trackerUpdateBusy)return false;
  if(navigator.onLine===false){
    trackerUpdateFeedback('You are offline. Connect before updating.');
    alert('A network connection is required to load the newest app version.');
    return false;
  }
  if(!confirm('Load the newest N594ZS Tracker version? Saved data and attachments are preserved. Unsaved text currently typed into a form will be lost.'))return false;
  trackerUpdateBusy=true;
  trackerUpdateFeedback('Checking unsynced changes…',true);
  try{
    if(trackerHasPendingCloudChanges()){
      if(typeof window.saveCloudState!=='function')
        throw new Error('Local changes are pending and cannot be synced yet.');
      trackerUpdateFeedback('Saving pending cloud changes…',true);
      await trackerUpdateWithTimeout(window.saveCloudState(),8000,'Cloud save');
      if(trackerHasPendingCloudChanges())
        throw new Error('Changes are still unsynced. The update was cancelled to protect them.');
    }
    const freshUrl=new URL(window.location.href);
    freshUrl.hash='';
    freshUrl.searchParams.set('forceUpdate',String(Date.now()));
    trackerUpdateFeedback('Checking the latest published version…',true);
    let controller=null;
    try{
      controller=typeof AbortController==='function'?new AbortController():null;
      const opts={cache:'no-store',credentials:'same-origin'};
      if(controller)opts.signal=controller.signal;
      const response=await trackerUpdateWithTimeout(fetch(freshUrl.toString(),opts),8000,'App download');
      if(!response.ok)throw new Error('Server returned HTTP '+response.status);
      // GitHub Pages HTML must carry a versioned JavaScript entry point.
      // Do not reload into a broken/stale non-tracker response.
      if(typeof response.text==='function'){
        const html=await trackerUpdateWithTimeout(response.text(),4000,'Release verification');
        if(!html.includes('app-01-seed.js?v='))
          throw new Error('The server response does not contain the tracker release.');
      }
    }finally{if(controller)controller.abort()}
    // The older updater waited indefinitely when a stale service worker
    // or cache subsystem stalled. Cache cleanup is best effort; never erase
    // browser storage or IndexedDB, which may hold local tracker recovery.
    trackerUpdateFeedback('Clearing old N594ZS app caches…',true);
    if('serviceWorker' in navigator){
      try{
        const regs=await trackerUpdateWithTimeout(navigator.serviceWorker.getRegistrations(),3000,'Service worker lookup');
        await trackerUpdateWithTimeout(Promise.allSettled(regs.filter(
          r=>String(r.scope||'').includes('/N594ZS-Tracker/')).map(r=>r.unregister())),3000,'Service worker cleanup');
      }catch(e){console.warn('Service worker cleanup skipped',e)}
    }
    if('caches' in window){
      try{
        const keys=await trackerUpdateWithTimeout(caches.keys(),3000,'App cache lookup');
        await trackerUpdateWithTimeout(Promise.allSettled(keys.filter(
          k=>k.startsWith('n594zs-')).map(k=>caches.delete(k))),3000,'App cache cleanup');
      }catch(e){console.warn('App cache cleanup skipped',e)}
    }
    trackerUpdateFeedback('Latest version found. Reloading now…',true);
    window.location.replace(freshUrl.toString());
    return true;
  }catch(e){
    console.warn('Tracker update cancelled',e);
    const message='Update did not complete: '+(e?.message||String(e))+
      '. Your current tracker remains open. You can use the Fresh version link instead once Synced.';
    trackerUpdateFeedback(message,false);
    alert(message);
    return false;
  }finally{
    trackerUpdateBusy=false;
  }
}
window.forceLatestAppVersion=forceLatestAppVersion;

function updateOfflineBanner(){let b=document.getElementById('offlineBanner');if(!navigator.onLine){if(!b){b=document.createElement('div');b.id='offlineBanner';b.className='offline-banner';b.textContent='Offline — cloud sync is unavailable until connection returns';document.body.appendChild(b)}}else b?.remove()}
window.addEventListener('online',updateOfflineBanner);window.addEventListener('offline',updateOfflineBanner);updateOfflineBanner();
