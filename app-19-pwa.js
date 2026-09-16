// ---------- PWA / INSTALL / OFFLINE UX ----------
window.n594zsInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.n594zsInstallPrompt=e;if(currentPage==='system'&&typeof renderSystem==='function')renderSystem()});
async function installN594ZSApp(){const e=window.n594zsInstallPrompt;if(!e)return toast('Use your browser menu and choose Install app / Add to Home Screen.','good');e.prompt();await e.userChoice;window.n594zsInstallPrompt=null;if(currentPage==='system'&&typeof renderSystem==='function')renderSystem()}

// Always check the service worker from the network. Earlier builds could keep an
// older application shell active even after a successful Pages deployment.
if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=5.0.1',{updateViaCache:'none'});
      await reg.update();
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
    }catch(e){console.warn('Service worker registration failed',e)}
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(sessionStorage.getItem('n594zs_sw_reload_5_0_1')==='1')return;
    sessionStorage.setItem('n594zs_sw_reload_5_0_1','1');
    location.reload();
  });
}

function updateOfflineBanner(){let b=document.getElementById('offlineBanner');if(!navigator.onLine){if(!b){b=document.createElement('div');b.id='offlineBanner';b.className='offline-banner';b.textContent='Offline — changes stay on this device until connection returns';document.body.appendChild(b)}}else b?.remove()}
window.addEventListener('online',updateOfflineBanner);window.addEventListener('offline',updateOfflineBanner);updateOfflineBanner();
