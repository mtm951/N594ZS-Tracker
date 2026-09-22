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

async function forceLatestAppVersion(){
  if(navigator.onLine===false){
    alert('A network connection is required to load the newest app version.');
    return false;
  }
  if(!confirm('Reload the newest N594ZS Tracker version now? Saved tracker data and attachments will be kept. Any unsaved text currently typed into a form will be lost.'))return false;

  if(trackerHasPendingCloudChanges()&&typeof window.saveCloudState==='function'){
    try{
      toast('Saving pending tracker changes before update…','good');
      await window.saveCloudState();
    }catch(e){
      console.warn('Pre-update cloud save failed',e);
    }
    if(trackerHasPendingCloudChanges()){
      alert('The tracker still has unsynced changes, so the app update was cancelled. Let sync finish and try again.');
      return false;
    }
  }

  const freshUrl=new URL(window.location.href);
  freshUrl.hash='';
  freshUrl.searchParams.set('forceUpdate',String(Date.now()));

  try{
    const response=await fetch(freshUrl.toString(),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error('HTTP '+response.status);
  }catch(e){
    console.warn('Newest-version check failed',e);
    alert('The newest app version could not be reached. Your current tracker was left unchanged.');
    return false;
  }

  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(r=>String(r.scope||'').includes('/N594ZS-Tracker/')).map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('n594zs-')).map(k=>caches.delete(k)));
    }
  }catch(e){
    console.warn('Force-update cache cleanup failed',e);
  }

  window.location.replace(freshUrl.toString());
  return true;
}
window.forceLatestAppVersion=forceLatestAppVersion;

function updateOfflineBanner(){let b=document.getElementById('offlineBanner');if(!navigator.onLine){if(!b){b=document.createElement('div');b.id='offlineBanner';b.className='offline-banner';b.textContent='Offline — cloud sync is unavailable until connection returns';document.body.appendChild(b)}}else b?.remove()}
window.addEventListener('online',updateOfflineBanner);window.addEventListener('offline',updateOfflineBanner);updateOfflineBanner();
