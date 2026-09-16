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

function updateOfflineBanner(){let b=document.getElementById('offlineBanner');if(!navigator.onLine){if(!b){b=document.createElement('div');b.id='offlineBanner';b.className='offline-banner';b.textContent='Offline — cloud sync is unavailable until connection returns';document.body.appendChild(b)}}else b?.remove()}
window.addEventListener('online',updateOfflineBanner);window.addEventListener('offline',updateOfflineBanner);updateOfflineBanner();
