// ---------- V5.2.1 AIRCRAFT OPS RUNTIME RECOVERY ----------
// Reloads the original rich Ops core inside an isolated function scope so
// cross-script lexical collisions cannot prevent its functions from registering.

(function(){
  const state=window.__n594zsOpsRuntime={ready:false,error:null,loading:true};
  const CORE_MARKER='// ---------- PART TYPE / CONSUMABLE CLASSIFICATION ----------';
  const EXCLUDE=new Set(['renderOps','setOpsTab']);

  function ensureOpsDataShape(){
    try{
      if(window.RECORD_ARRAYS){RECORD_ARRAYS.configuration='configurations';RECORD_ARRAYS.spec='specs';RECORD_ARRAYS.inspection='inspections';RECORD_ARRAYS.flightcard='flightCards'}
      if(window.SYNC_RECORD_TYPES){['configuration','spec','inspection','flightcard'].forEach(t=>SYNC_RECORD_TYPES.add(t))}
      if(window.SEED){SEED.configurations=SEED.configurations||[];SEED.specs=SEED.specs||[];SEED.inspections=SEED.inspections||[];SEED.flightCards=SEED.flightCards||[]}
      if(window.db){db.configurations=Array.isArray(db.configurations)?db.configurations:[];db.specs=Array.isArray(db.specs)?db.specs:[];db.inspections=Array.isArray(db.inspections)?db.inspections:[];db.flightCards=Array.isArray(db.flightCards)?db.flightCards:[]}
    }catch(e){console.warn('Ops data-shape recovery warning',e)}
  }

  async function recoverAircraftOpsRuntime(){
    ensureOpsDataShape();
    try{
      const res=await fetch(`app-33-aircraft-ops.js?runtime=${Date.now()}`,{cache:'no-store'});
      if(!res.ok)throw new Error(`Could not load Aircraft Ops source (${res.status})`);
      const source=await res.text();
      const core=source.includes(CORE_MARKER)?source.split(CORE_MARKER)[0]:source;
      const names=[...core.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]).filter(n=>!EXCLUDE.has(n));
      const unique=[...new Set(names)];
      const exportLine=`Object.assign(window,{${unique.map(n=>`${n}:${n}`).join(',')}});\n`;
      // Function declarations are hoisted within this generated function, so the
      // export runs before the legacy top-level initialization. Even if a later
      // initializer fails, the rich renderers and editors remain available.
      const runner=new Function('window',`${exportLine}\n${core}\n//# sourceURL=n594zs-aircraft-ops-recovered.js`);
      let initError=null;
      try{runner(window)}catch(e){initError=e;console.warn('Aircraft Ops legacy initialization partially failed after export',e)}
      ensureOpsDataShape();
      state.ready=typeof window.renderOpsFlightCards==='function'&&typeof window.renderOpsConfiguration==='function';
      state.error=state.ready?initError:(initError||new Error('Rich Aircraft Ops functions did not register.'));
      state.loading=false;
      if(state.ready){
        console.info(`Aircraft Ops runtime recovered (${unique.length} functions exported).`);
        if(typeof window.toast==='function')toast('Full Aircraft Ops workspace loaded.','good');
      }else console.error('Aircraft Ops recovery did not complete',state.error);
    }catch(e){state.loading=false;state.error=e;console.error('Aircraft Ops runtime recovery failed',e)}
    try{
      if(window.currentPage==='ops'&&typeof window.renderOps==='function')window.renderOps();
    }catch(e){console.error('Aircraft Ops post-recovery render failed',e)}
  }

  window.recoverAircraftOpsRuntime=recoverAircraftOpsRuntime;
  recoverAircraftOpsRuntime();
})();
