// ---------- v5.19.16 EXPERIMENTAL ATOMIC RECEIPT OUTBOX ----------
// An opt-in, one-at-a-time, crash-recoverable queue for linked Order+Part
// receipts. Enabled per device from Cloud Account. Existing sync stays the
// default until cross-device failure testing proves this path end to end.
(function(){
  'use strict';
  if(window.atomicReceiptOutbox)return;
  const KEY='n594zs_atomic_receipt_outbox_v1';
  const OPT='n594zs_atomic_receipts_opt_in_v1';
  const SNAP='n594zs_record_snapshot_v4';
  const VERS='n594zs_record_versions_v1';
  const PENDING='n594zs_pending_cloud_v4';
  let inFlight=null, syncInFlight=null;

  function copy(x){return typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x))}
  function stable(x){return cloudStableJSON(x)}
  function key(t,id){return cloudRecordKey(t,id)}
  function read(){
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    let e;
    try{e=JSON.parse(raw)}catch(_e){throw new Error('Pending receipt journal is unreadable; do not reload shared data.')}
    if(e?.format!=='N594ZS_ATOMIC_RECEIPT_V1'||!e.operationId||
       !e.workspaceId||!e.userId||!Array.isArray(e.changes)||!e.changes.length||
       !Array.isArray(e.before))throw new Error('Pending receipt journal failed validation.');
    return e;
  }
  function write(e){
    const json=JSON.stringify(e);
    localStorage.setItem(KEY,json);
    if(localStorage.getItem(KEY)!==json)throw new Error('Browser did not retain the receipt journal.');
  }
  function pending(){return !!localStorage.getItem(KEY)}
  function enabled(){return localStorage.getItem(OPT)==='1'}
  function shouldHandle(){
    // Opting out must never let a new receipt bypass an older queued one.
    return pending()||(enabled()&&!!supa&&!!cloudSession&&!!cloudWorkspaceId);
  }
  function snapshot(){
    const out=new Map();
    for(const [type,arrayKey] of [['order','orders'],['part','parts']])
      for(const row of arr(db[arrayKey])){
        const k=key(type,row.id);
        out.set(k,{key:k,record_type:type,record_id:String(row.id),data:copy(row)});
      }
    return out;
  }
  function restore(old){
    Object.keys(db).forEach(k=>delete db[k]);
    Object.assign(db,copy(old));
  }
  function validateIdentity(e){
    if(e.workspaceId!==cloudWorkspaceId||e.userId!==cloudSession?.user?.id)
      throw new Error('A pending receipt belongs to a different workspace or account. Do not discard it.');
  }
  function stage(work,message){
    if(!shouldHandle())throw new Error('Atomic receipts require an authenticated, connected workspace.');
    if(!canCloudEdit())throw new Error('This workspace is read-only.');
    if(pending())throw new Error('An earlier receipt is still pending. Sync or review it before receiving more stock.');
    if(localStorage.getItem(PENDING)==='1')
      throw new Error('Other changes are waiting to sync. Wait for Synced or resolve the conflict before receiving.');
    if(!cloudRecordSnapshot?.size)throw new Error('Cloud baseline is not available. Wait until the tracker finishes loading.');
    if(typeof crypto?.randomUUID!=='function')throw new Error('Secure receipt operation IDs are unavailable.');
    const before=snapshot(),old=copy(db);
    let result,journalWritten=false;
    try{
      // The scoped store rolls back an intermediate mutation error before we
      // ever create a journal. Do not use live captured Part/Order references.
      result=trackerStore.batch(work,{persist:false});
      const after=snapshot(),changes=[],originals=[];
      for(const [k,r] of after){
        const prior=before.get(k);
        if(!prior||stable(prior.data)===stable(r.data))continue;
        if(!cloudRecordSnapshot.has(k)||cloudRecordSnapshot.get(k)!==stable(prior.data))
          throw new Error('The '+r.record_type+' has unverified local edits; sync first.');
        changes.push({
          record_type:r.record_type,record_id:r.record_id,data:r.data,
          deleted_at:null,expected_version:Number(cloudRecordVersions.get(k))||0,
          updated_client:CLOUD_CLIENT_ID
        });
        originals.push({key:k,data:prior.data});
      }
      if(!changes.length||!changes.some(r=>r.record_type==='order'))
        throw new Error('Receipt did not produce a changed Order record.');
      if(changes.length>50)throw new Error('A receipt can change at most 50 records.');
      const afterKeys=new Set(changes.map(r=>key(r.record_type,r.record_id)));
      for(const k of before.keys())if(!after.has(k))
        throw new Error('Receipt unexpectedly removed a Part or Order.');
      if([...after.keys()].some(k=>!before.has(k)&&!afterKeys.has(k)))
        throw new Error('Receipt unexpectedly created a Part or Order.');
      const e={
        format:'N594ZS_ATOMIC_RECEIPT_V1',
        operationId:crypto.randomUUID(),workspaceId:cloudWorkspaceId,
        userId:cloudSession.user.id,createdAt:new Date().toISOString(),
        changes, before:originals
      };
      // Durable journal BEFORE saveDB() queues the old general cloud sync.
      // If local cache persistence is interrupted, boot recovery replays the
      // identical staged Part+Order data before the cloud fetch can run.
      write(e);journalWritten=true;
      localStorage.setItem(PENDING,'1');
      cloudDirty=true;
      trackerStore.commit(message);
      cloudStatusLabel('Receipt pending');
      return result;
    }catch(error){
      if(!journalWritten)restore(old);
      // After the journal is written, retain staged data and the journal even
      // if saveDB() throws: its browser or network side effects may have run.
      throw error;
    }
  }
  async function recoverLocal(){
    const e=read();
    if(!e)return false;
    if(!cloudSession||!cloudWorkspaceId)throw new Error('Connect to the workspace before recovering a receipt.');
    validateIdentity(e);
    let changed=false;
    const current=snapshot();
    for(const r of e.changes){
      const k=key(r.record_type,r.record_id);
      const now=current.get(k)?.data||null;
      const original=e.before.find(x=>x.key===k)?.data||null;
      if(stable(now)===stable(r.data))continue;
      if(!original||stable(now)!==stable(original)){
        throw new Error('A pending receipt has newer local edits. Do not reload cloud data; review the receipt first.');
      }
      const array=r.record_type==='part'?db.parts:db.orders;
      const index=array.findIndex(x=>String(x.id)===String(r.record_id));
      if(index<0)throw new Error('Pending receipt record is missing from the local cache.');
      array[index]=copy(r.data);changed=true;
    }
    localStorage.setItem(PENDING,'1');cloudDirty=true;
    if(changed){
      if(typeof persistBrowserData==='function')await persistBrowserData(db,{quiet:true});
      else localStorage.setItem(DB_KEY,JSON.stringify(db));
      renderAll();
    }
    return changed;
  }
  function retain(message,kind){
    cloudDirty=true;
    try{localStorage.setItem(PENDING,'1')}catch(_e){}
    cloudStatusLabel(kind||'Receipt pending');
    if(message)console.warn('Atomic receipt is still pending:',message);
    return {pending:true,error:message||null};
  }
  async function flush(){
    if(inFlight)return inFlight;
    const job=async()=>{
      let e;
      try{e=read();if(!e)return {empty:true};validateIdentity(e)}
      catch(error){return retain(error.message,'Receipt needs review')}
      if(!supa||!cloudSession||!cloudWorkspaceId)return retain('Not signed in');
      if(!navigator.onLine)return retain('Offline');
      if(e.blocked)return retain('Receipt has a version conflict; review before retrying.','Receipt conflict');
      let data,error;
      try{
        ({data,error}=await supa.rpc('sync_tracker_records_atomic',{
          target_workspace:e.workspaceId,operation_id:e.operationId,changes:e.changes
        }));
      }catch(err){return retain(err?.message||String(err))}
      if(error)return retain(error.message||'Atomic RPC failed');
      if(arr(data?.conflicts).length){
        try{write({...e,blocked:true,conflicts:data.conflicts})}
        catch(err){return retain('Conflict journal could not be saved: '+err.message,'Receipt conflict')}
        toast('Receipt stopped safely: another device changed the same record. Review the pending receipt.','bad');
        return retain('Cloud version conflict','Receipt conflict');
      }
      const applied=arr(data?.applied);
      const required=new Set(e.changes.map(r=>key(r.record_type,r.record_id)));
      const ack=new Map(applied.map(r=>[key(r.record_type,r.record_id),r]));
      if(ack.size!==required.size||[...required].some(k=>!ack.has(k)||!(Number(ack.get(k).record_version)>0)))
        return retain('Atomic server receipt is incomplete; retry with the same operation ID.');
      // Preserve the EXACT staged payload in the synced baseline, not a newer
      // local edit made after the receipt. General guarded sync handles later
      // edits only after the atomic receipt is acknowledged.
      for(const r of e.changes){
        const k=key(r.record_type,r.record_id);
        cloudRecordSnapshot.set(k,stable(r.data));
        cloudRecordVersions.set(k,Number(ack.get(k).record_version));
      }
      try{
        const snapshots=JSON.stringify(Object.fromEntries(cloudRecordSnapshot));
        const versions=JSON.stringify(Object.fromEntries(cloudRecordVersions));
        localStorage.setItem(SNAP,snapshots);
        localStorage.setItem(VERS,versions);
        if(localStorage.getItem(SNAP)!==snapshots||localStorage.getItem(VERS)!==versions)
          throw new Error('Could not verify synced baseline');
        localStorage.removeItem(KEY);
        if(localStorage.getItem(KEY))throw new Error('Could not clear acknowledged receipt journal');
      }catch(err){return retain('Cloud received the receipt, but the local acknowledgement must be retried: '+err.message)}
      return {success:true,replayed:!!data?.replayed,applied};
    };
    inFlight=job().finally(()=>{inFlight=null});
    return inFlight;
  }

  function openSettings(){
    let e=null,corrupt='';
    try{e=read()}catch(err){corrupt=err.message}
    const detail=e?'<div class="notice"><b>Pending receipt</b><br>Operation '+esc(e.operationId)+
      '<br>Created '+esc(e.createdAt)+(e.blocked?'<br><b>Version conflict — no automatic retry.</b>':'')+
      '<br>'+e.changes.map(r=>esc(r.record_type+' '+r.record_id)).join(', ')+'</div>':'';
    openModal(modalHeader('Atomic receipt testing','One pending receipt per device; experimental')+
      '<div class="notice">When enabled on this device, Orders-tab receipts are journaled locally before cloud sync. The server applies linked Order and Part changes together. Other tracker records continue using normal sync.</div>'+
      (corrupt?'<div class="danger-note">'+esc(corrupt)+'</div>':'')+detail+
      '<div class="detail-section"><b>Status: '+(enabled()?'Enabled':'Off')+'</b><div class="muted small">Enable for a temporary test order first. Pending receipts cannot be discarded by reloading cloud data.</div></div>'+
      '<div class="modal-actions">'+
      '<button class="secondary" onclick="atomicReceiptOutbox.toggle()">'+(enabled()?'Turn Off for New Receipts':'Enable on This Device')+'</button>'+
      (e?'<button class="primary" onclick="atomicReceiptOutbox.retryFromUI()">Retry Pending Receipt</button>':'')+
      '<button class="secondary" onclick="openCloudAccount()">Back to Cloud Account</button></div>');
  }
  function toggle(){
    if(enabled()){localStorage.removeItem(OPT);toast('New receipts use normal sync. Existing queued receipts remain protected.','good')}
    else{
      if(!confirm('Enable experimental atomic order receipts on this device? Start with a disposable test order. Only one receipt can remain offline at a time.'))return;
      localStorage.setItem(OPT,'1');
    }
    openSettings();
  }
  async function retryFromUI(){
    if(!cloudSession||!cloudWorkspaceId)return alert('Sign in to your original workspace first.');
    const result=await window.saveCloudState();
    if(result?.pending)return alert('Receipt is still pending. '+(result.error||'Check your connection or the cloud conflict.'));
    openSettings();toast('Pending receipt synchronized.','good');
  }
  const previousSave=window.saveCloudState;
  window.saveCloudState=function(){
    if(syncInFlight)return syncInFlight;
    const work=async()=>{
      if(pending()){
        const outcome=await flush();
        if(!outcome.success)return outcome;
      }
      return previousSave();
    };
    syncInFlight=work().finally(()=>{syncInFlight=null});
    return syncInFlight;
  };
  const previousLoad=window.loadCloudState;
  window.loadCloudState=async function(silent=false){
    if(pending()){
      await recoverLocal();
      const outcome=await flush();
      if(!outcome.success)throw new Error('A receipt is awaiting atomic cloud sync. Local data was preserved.');
    }
    return previousLoad(silent);
  };
  const previousReload=window.forceCloudReload;
  window.forceCloudReload=async function(){
    if(pending())return alert('A receipt is awaiting atomic sync. Review it in Cloud Account before reloading shared data.');
    return previousReload();
  };
  for(const action of ['reliabilityUseCloud','reliabilityKeepLocal','reliabilityApplyFieldMerge','cloudSignOut']){
    const prev=window[action];
    if(typeof prev!=='function')continue;
    window[action]=function(...args){
      if(pending())return alert('Protecting an unsynced atomic receipt. Open Cloud Account and review it before this operation.');
      return prev(...args);
    };
  }
  const previousAccount=window.openCloudAccount;
  window.openCloudAccount=function(){
    previousAccount();
    const buttons=document.querySelector('#modalBox .modal-actions');
    if(buttons)buttons.insertAdjacentHTML('afterbegin',
      '<button class="secondary" onclick="atomicReceiptOutbox.openSettings()">Atomic Receipt Testing'+(pending()?' • Pending':'')+'</button>');
  };
  const originalStatus=window.cloudStatusLabel;
  window.cloudStatusLabel=function(label,kind){
    if(pending()&&label==='Synced')label='Receipt pending';
    return originalStatus(label,kind);
  };
  window.atomicReceiptOutbox=Object.freeze({
    enabled,shouldHandle,hasPending:pending,stage,flush,recoverLocal,
    openSettings,toggle,retryFromUI
  });
})();