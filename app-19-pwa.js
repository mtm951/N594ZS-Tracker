// ---------- PWA / INSTALL / OFFLINE UX ----------
window.n594zsInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.n594zsInstallPrompt=e;if(currentPage==='system'&&typeof renderSystem==='function')renderSystem()});
async function installN594ZSApp(){const e=window.n594zsInstallPrompt;if(!e)return toast('Use your browser menu and choose Install app / Add to Home Screen.','good');e.prompt();await e.userChoice;window.n594zsInstallPrompt=null;if(currentPage==='system'&&typeof renderSystem==='function')renderSystem()}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Service worker registration failed',e)));
function updateOfflineBanner(){let b=document.getElementById('offlineBanner');if(!navigator.onLine){if(!b){b=document.createElement('div');b.id='offlineBanner';b.className='offline-banner';b.textContent='Offline — changes stay on this device until connection returns';document.body.appendChild(b)}}else b?.remove()}
window.addEventListener('online',updateOfflineBanner);window.addEventListener('offline',updateOfflineBanner);updateOfflineBanner();
