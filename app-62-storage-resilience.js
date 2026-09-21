'use strict';
// ---------- V5.15.3 BROWSER STORAGE RESILIENCE ----------
// Keep the full working cache in IndexedDB when localStorage is tight.
// localStorage remains a fast bootstrap cache when there is room.

(function(){
  if(window.__n594zsStorageResilienceInstalled)return;
  window.__n594zsStorageResilienceInstalled=true;

  const IDB_NAME='n594zs-core-cache-v1';
  const IDB_STORE='kv';
  const REC_KEY='n594zs_local_recovery_v1';
  const SNAP_KEY='n594zs_record_snapshot_v4';
  const PENDING_KEY='n594zs_pending_cloud_v4';
  let warnedFallback=false;

  function openCoreCache(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('IndexedDB unavailable'));
      const req=indexedDB.open(IDB_NAME,1);
      req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(IDB_STORE))d.createObjectStore(IDB_STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Could not open browser cache'));
    });
  }
  async function idbPut(key,value){
    const d=await openCoreCache();
    try{
      await new Promise((resolve,reject)=>{
        const tx=d.transaction(IDB_STORE,'readwrite');
        tx.objectStore(IDB_STORE).put(value,key);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    }finally{d.close()}
  }
  async function idbGet(key){
    const d=await openCoreCache();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=d.transaction(IDB_STORE,'readonly'),req=tx.objectStore(IDB_STORE).get(key);
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
    }finally{d.close()}
  }
  function storageChars(){
    let n=0;
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';n+=k.length+(localStorage.getItem(k)||'').length}}catch(_e){}
    return n;
  }
  async function preserveAndRemove(key,idbKey){
    let raw='';
    try{raw=localStorage.getItem(key)||''}catch(_e){}
    if(!raw)return false;
    try{
      const parsed=JSON.parse(raw);
      await idbPut(idbKey,parsed);
      localStorage.removeItem(key);
      return true;
    }catch(_e){return false}
  }
  async function freeLegacySpace(){
    // v2 is only a migration source. At this point db is already loaded in memory,
    // so preserve the current v3 state before removing the obsolete duplicate.
    try{
      if(localStorage.getItem(OLD_DB_KEY)){
        await idbPut('core',structuredClone(db));
        localStorage.removeItem(OLD_DB_KEY);
      }
    }catch(_e){}

    // An old full recovery point can contain a legacy embedded aircraft photo and
    // consume several MB. Preserve it in IndexedDB if localStorage is crowded.
    if(storageChars()>3_600_000){
      try{
        const raw=localStorage.getItem(REC_KEY)||'';
        if(raw.length>700_000)await preserveAndRemove(REC_KEY,'recovery');
      }catch(_e){}
    }

    // The cloud record snapshot is reproducible after a successful cloud load.
    // Only discard it when there are no unsynced local changes.
    if(storageChars()>4_000_000){
      try{
        if(localStorage.getItem(PENDING_KEY)!=='1'&&localStorage.getItem(SNAP_KEY)){
          localStorage.removeItem(SNAP_KEY);
        }
      }catch(_e){}
    }
  }

  window.persistBrowserData=async function(value=db,opts={}){
    const copy=typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
    const idbPromise=idbPut('core',copy);
    const json=JSON.stringify(value);
    let localOK=false;
    try{localStorage.setItem(DB_KEY,json);localOK=true}
    catch(_e){
      await freeLegacySpace();
      try{localStorage.setItem(DB_KEY,json);localOK=true}catch(_e2){}
    }
    try{await idbPromise}catch(e){
      if(!localOK)throw e;
    }
    if(!localOK&&!warnedFallback&&!opts.quiet){
      warnedFallback=true;
      try{toast('Browser cache moved to larger local storage; cloud sync remains active.','good')}catch(_e){}
    }
    return {localStorage:localOK,indexedDB:true};
  };

  window.hydrateBrowserCacheIfNeeded=async function(){
    await freeLegacySpace();
    let hasLocal=false;
    try{hasLocal=!!localStorage.getItem(DB_KEY)}catch(_e){}
    if(hasLocal){
      // Mirror the currently loaded state into the larger cache in the background.
      idbPut('core',typeof structuredClone==='function'?structuredClone(db):JSON.parse(JSON.stringify(db))).catch(()=>{});
      return false;
    }
    try{
      const cached=await idbGet('core');
      if(cached&&cached.aircraft&&Array.isArray(cached.projects)){
        db=cached;normalizeDB();return true;
      }
    }catch(_e){}
    return false;
  };

  window.getBrowserStorageHealth=async function(){
    let estimate={};
    try{estimate=await navigator.storage?.estimate?.()||{}}catch(_e){}
    return {localChars:storageChars(),quota:estimate.quota||null,usage:estimate.usage||null};
  };

  // Preserve an oversized legacy recovery point before clearing space even if
  // no save happens immediately after this release loads.
  freeLegacySpace().catch(()=>{});
})();