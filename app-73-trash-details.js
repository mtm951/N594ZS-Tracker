'use strict';
// v5.19.77 Mobile-first Trash details, read-before-restore, guarded cloud writes.
(function(){
  if(window.__n594zsTrashDetailsInstalled)return;
  window.__n594zsTrashDetailsInstalled=true;
  const list=v=>Array.isArray(v)?v:[];
  const str=v=>String(v==null?'':v);
  const escValue=v=>str(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const label=r=>{
    const d=r.data||{};
    return str(d.title||d.name||d.item||d.work||d.description||r.record_type+' '+r.record_id).slice(0,260);
  };
  const ty=t=>({log:'Work Log',project:'Project',part:'Inventory Part',file:'Shared File',
    order:'Order',document:'Document',purchase:'Purchase',checklist:'Checklist',
    aircraft:'Aircraft',maintenance:'Maintenance',system:'Aircraft System'})[t]||t;
  const when=d=>{const t=new Date(d);return Number.isNaN(t.getTime())?'Unknown':t.toLocaleString();};
  const key=r=>r.record_type+':'+r.record_id;
  const physical=r=>r.record_type==='log'&&list(r.data?.consumedParts).some(x=>Number(x.qty)>0);
  const automatic=r=>physical(r)&&['assigned-part-use','reserved-part-use'].includes(str(r.data?.origin));
  const editable=()=>cloudRole==='owner'||cloudRole==='editor';
  const overlap=(a,b)=>list(a).some(x=>list(b).some(y=>str(x)===str(y)));
  const near=(a,b)=>{
    const x=Date.parse(str(a).slice(0,10)+'T12:00:00Z'),y=Date.parse(str(b).slice(0,10)+'T12:00:00Z');
    return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=2*86400000;
  };
  function matchingUsage(r,logs){
    if(!physical(r))return null;
    for(const l of list(logs)){
      if(str(l.id)===str(r.record_id)||!overlap(l.projectIds,r.data?.projectIds)||
        !near(l.date,r.data?.date))continue;
      for(const used of list(r.data?.consumedParts)){
        if(!used.partId||!(Number(used.qty)>0))continue;
        if(list(l.consumedParts).some(x=>str(x.partId)===str(used.partId)&&
           Number(x.qty)===Number(used.qty)))
          return {logId:l.id,name:used.name||'part',qty:used.qty};
      }
    }
    return null;
  }

  const style=document.createElement('style');
  style.textContent=[
    '#page-trash .trash-list{display:grid;gap:10px;margin-top:12px}',
    '#page-trash .trash-entry{display:block;width:100%;text-align:left;white-space:normal;overflow-wrap:anywhere;border:1px solid #dce5ec;border-radius:10px;padding:14px;background:#fff;color:#18344b;cursor:pointer;min-height:76px}',
    '#page-trash .trash-entry:hover,#page-trash .trash-entry:focus-visible{background:#f2f8fc;outline-offset:2px}',
    '#page-trash .trash-entry strong{display:block;font-size:13px;line-height:1.45;margin:7px 0}',
    '#page-trash .trash-metadata{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:#60798a}',
    '#page-trash .trash-chip{background:#eaf2f6;border-radius:16px;padding:3px 8px;font-weight:700}',
    '#page-trash .trash-search{padding:10px;width:100%;max-width:500px;min-height:40px;margin-top:12px}',
    '.trash-kv{display:grid;grid-template-columns:minmax(90px,140px) minmax(0,1fr);gap:12px;padding:9px 0;border-bottom:1px solid #e8eef3;overflow-wrap:anywhere}',
    '.trash-kv b{color:#567184;font-size:11px}.trash-kv span{font-size:12px;white-space:pre-wrap}',
    '.trash-risk{background:#fff7ee;border:1px solid #edd3ad;border-radius:9px;padding:12px;margin:12px 0;font-size:12px;line-height:1.5}',
    '@media(max-width:560px){#page-trash .trash-entry{padding:13px}.trash-kv{grid-template-columns:1fr;gap:3px}}'
  ].join('');
  document.head.appendChild(style);

  let rows=new Map(),generation=0,busy=false;
  function detail(label,value){
    if(value===undefined||value===null||str(value)==='')return '';
    return '<div class="trash-kv"><b>'+escValue(label)+'</b><span>'+escValue(value)+'</span></div>';
  }
  function details(r){
    const d=r.data||{},parts=list(d.consumedParts);
    let out='';
    out+=detail('Record type',ty(r.record_type));
    out+=detail('Record ID',r.record_id);
    out+=detail('Deleted',when(r.deleted_at));
    out+=detail('Date',d.date||d.createdAt||d.uploadedAt);
    out+=detail('System',d.system);
    out+=detail('Project links',list(d.projectIds).join(', '));
    out+=detail('Status',d.status);
    out+=detail('Work performed',d.work);
    out+=detail('Description',d.description||d.summary);
    out+=detail('Notes',d.notes);
    out+=detail('Observations',d.observations);
    out+=detail('Labor hours',d.laborHours);
    if(parts.length){
      out+='<h3 style="margin-top:16px">Parts & Consumables Used</h3>';
      for(const p of parts)out+=detail(p.name||'Material',str(p.qty)+' '+str(p.unit||'ea')+
        (p.unitCost!==undefined&&str(p.unitCost)!==''?' · $'+str(p.unitCost)+' each':''));
    }
    if(list(d.steps).length)out+=detail('Project steps',list(d.steps).length);
    if(list(d.items).length)out+=detail('Checklist items',list(d.items).length);
    out+='<details style="margin-top:15px"><summary>Complete record data (read-only)</summary>'+
      '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;font-size:11px">'+
      escValue(JSON.stringify(d,null,2))+'</pre></details>';
    return out;
  }
  function openRecord(type,id){
    const r=rows.get(type+':'+id);
    if(!r)return alert('This deleted record changed. Refresh Trash.');
    const risk=automatic(r)?'This automatically created Work Log may have been removed to correct duplicate inventory use. Restoring it can double-count physical consumption.':
      physical(r)?'Restoring this Work Log will count its saved parts as used again, reducing calculated inventory.':'';
    openModal(modalHeader('Deleted '+ty(type),label(r))+
      '<div class="detail-card">'+details(r)+
      (risk?'<div class="trash-risk"><b>Inventory safety</b><div>'+escValue(risk)+'</div></div>':'')+
      '<div class="modal-actions" style="margin-top:15px"><button class="secondary" type="button" id="trashClose">Close</button>'+
      (editable()?'<button class="primary" type="button" id="trashRestore">Restore record</button>':
      '<span class="muted">Owner or Editor permission required to restore.</span>')+
      '</div></div>',true);
    document.getElementById('trashClose')?.addEventListener('click',()=>closeModal());
    document.getElementById('trashRestore')?.addEventListener('click',()=>restore(type,id));
  }
  function paint(){
    const box=document.getElementById('trashList');
    if(!box)return;
    const query=str(document.getElementById('trashSearch')?.value).trim().toLowerCase();
    const all=[...rows.values()];
    const filtered=all.filter(r=>!query||
      (label(r)+' '+r.record_type+' '+r.record_id+' '+str(r.data?.system)).toLowerCase().includes(query));
    const summary=document.getElementById('trashCount');
    if(summary)summary.textContent=all.length+' deleted records'+(query?' · '+filtered.length+' matching':'')+
      ' · Tap an entry to view details.';
    box.innerHTML=filtered.length?'<div class="trash-list">'+filtered.map(r=>
      '<button class="trash-entry" type="button" data-trash-key="'+escValue(key(r))+'">'+
      '<span class="trash-metadata"><span class="trash-chip">'+escValue(ty(r.record_type))+'</span>'+
      '<span>Deleted '+escValue(when(r.deleted_at))+'</span></span>'+
      '<strong>'+escValue(label(r))+'</strong>'+
      (automatic(r)?'<span class="small" style="color:#925215;font-weight:700">Inventory use — review carefully</span>':
      '<span class="small muted">View details and restore</span>')+
      '</button>').join('')+'</div>':
      '<div class="empty">No deleted records match this search.</div>';
    box.querySelectorAll('[data-trash-key]').forEach(b=>b.addEventListener('click',()=>{
      const r=rows.get(b.getAttribute('data-trash-key'));if(r)openRecord(r.record_type,r.record_id);
    }));
  }
  async function render(){
    const seq=++generation,page=document.getElementById('page-trash');if(!page)return;
    if(!cloudSession||!cloudWorkspaceId){
      page.innerHTML='<div class="card"><h1>Trash</h1><div class="empty">Sign in to view Trash.</div></div>';return;
    }
    page.innerHTML='<div class="card"><div class="toolbar"><div><h1>Trash</h1>'+
      '<div class="muted">Deleted records and shared files stay here until restored. Tap one to see its details.</div></div>'+
      '<button class="secondary" type="button" id="trashRefresh">Refresh</button></div>'+
      '<input type="search" id="trashSearch" class="trash-search" placeholder="Search deleted records…" aria-label="Search Trash">'+
      '<div id="trashCount" class="tiny muted" style="margin:12px 0">Loading deleted records…</div>'+
      '<div id="trashList"><div class="empty">Loading Trash…</div></div></div>';
    document.getElementById('trashRefresh')?.addEventListener('click',render);
    document.getElementById('trashSearch')?.addEventListener('input',paint);
    try{
      // Complete pagination prevents the backend's 1,000-record response cap.
      const all=await cloudReadAllTrackerRecords({
        columns:'record_type,record_id,data,deleted_at,record_version,updated_at',
        activeOnly:false,pageSize:500});
      if(seq!==generation||!document.getElementById('trashList'))return;
      rows=new Map(all.filter(r=>!!r.deleted_at)
        .sort((a,b)=>str(b.deleted_at).localeCompare(str(a.deleted_at)))
        .map(r=>[key(r),r]));
      paint();
    }catch(error){
      if(seq===generation&&document.getElementById('trashList'))
        document.getElementById('trashList').innerHTML=
          '<div class="danger-note">Could not load Trash: '+escValue(error.message)+'</div>';
    }
  }
  function safeRestore(){
    if(!cloudSession||!cloudWorkspaceId||!supa){alert('Sign in to restore cloud records.');return false;}
    if(!editable()){alert('Owner or Editor permission is required to restore.');return false;}
    if(!navigator.onLine){alert('Connect to the internet before restoring.');return false;}
    if(cloudLoading||cloudDirty||localStorage.getItem(CLOUD_PENDING_KEY)==='1'||
       window.atomicReceiptOutbox?.hasPending?.()){
      alert('There are pending local or atomic changes. Sync/recover them first; nothing was restored.');
      return false;
    }
    return !busy;
  }
  async function restore(type,id){
    if(!safeRestore())return;
    const original=rows.get(type+':'+id);if(!original){alert('Refresh Trash first.');return;}
    busy=true;
    const button=document.getElementById('trashRestore');
    if(button){button.disabled=true;button.textContent='Checking…';}
    try{
      const response=await supa.from('tracker_records')
        .select('record_type,record_id,data,deleted_at,record_version')
        .eq('workspace_id',cloudWorkspaceId).eq('record_type',type)
        .eq('record_id',id).maybeSingle();
      if(response.error)throw response.error;
      const latest=response.data;
      if(!latest||!latest.deleted_at)throw new Error('This item is no longer in Trash.');
      if(Number(latest.record_version)!==Number(original.record_version)||
         str(latest.deleted_at)!==str(original.deleted_at))
        throw new Error('The record changed on another device. Refresh Trash first.');
      if(physical(latest)){
        const active=await cloudReadAllTrackerRecords({
          columns:'record_type,record_id,data,deleted_at,record_version',
          types:['log'],activeOnly:true,pageSize:500});
        const match=matchingUsage(latest,active.map(r=>r.data));
        if(match&&automatic(latest))throw new Error(
          'Restore blocked: '+match.qty+' '+match.name+' already appears in active Work Log '+
          match.logId+' on the same project and date. Restoring the automatic Work Log could double-count inventory.');
        if(match&&!confirm('Similar parts usage appears in Work Log '+match.logId+
          '. Are these truly ADDITIONAL physical items? Cancel unless certain.'))return;
      }
      if(!confirm('Restore '+ty(type)+' “'+label(latest)+'” to the active tracker?'+
        (physical(latest)?'\n\nRestoring this Work Log changes physical inventory consumption.':'')))return;
      const request={record_type:type,record_id:id,data:latest.data,deleted_at:null,
        expected_version:Number(latest.record_version),
        updated_client:typeof CLOUD_CLIENT_ID==='undefined'?'trash-restore':CLOUD_CLIENT_ID};
      const {data,error}=await supa.rpc('sync_tracker_records_guarded',{
        target_workspace:cloudWorkspaceId,changes:[request]});
      if(error)throw error;
      if(list(data?.conflicts).length)throw new Error('Cloud version conflict. Nothing restored. Refresh first.');
      if(!list(data?.applied).some(x=>x.record_type===type&&str(x.record_id)===str(id)&&!x.deleted_at))
        throw new Error('Cloud did not confirm a restore. Verify sync status before retrying.');
      closeModal();
      try{await loadCloudState(true);}
      catch(refreshError){
        alert('Cloud restore succeeded, but the local view could not refresh: '+refreshError.message);
        return;
      }
      toast('Record restored.','good');
    }catch(error){
      alert('Restore not completed: '+(error?.message||String(error)));
    }finally{
      busy=false;
      if(button?.isConnected){button.disabled=false;button.textContent='Restore record';}
    }
  }
  window.renderTrash=render;
  window.restoreTrashRecord=restore;
  window.openTrashRecordDetails=openRecord;
  window.N594ZSTrashRecovery=Object.freeze({matchingUsage,physical,automatic});
})();