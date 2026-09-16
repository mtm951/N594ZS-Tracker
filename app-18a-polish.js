// ---------- V4 SYSTEM POLISH ----------
async function ensureDailySnapshot(){
  if(!supa||!cloudWorkspaceId||!canCloudEdit())return;
  try{
    const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
    const {data,error}=await supa.from('tracker_snapshots').select('id,created_at').eq('workspace_id',cloudWorkspaceId).gte('created_at',cutoff).limit(1);
    if(error||data?.length)return;
    await supa.rpc('create_workspace_snapshot',{target_workspace:cloudWorkspaceId,snapshot_label:'Automatic daily snapshot'});
  }catch(e){console.warn('Automatic snapshot skipped',e)}
}

// Keep cross-links intact when records are sent to Trash so Restore is a real undo.
deleteProject=function(id){
  if(!confirm('Move this project to Trash? Linked records will be preserved so restoring it reconnects everything.'))return;
  db.projects=db.projects.filter(x=>x.id!==id);closeModal();saveDB('Project moved to Trash.');
};
deletePart=function(id){
  if(!confirm('Move this part to Trash? Linked project, order, work-log and document references will be preserved.'))return;
  db.parts=db.parts.filter(x=>x.id!==id);closeModal();saveDB('Part moved to Trash.');
};
deleteLog=function(id){
  if(!confirm('Move this work-log entry to Trash? Linked document references will be preserved.'))return;
  db.logs=db.logs.filter(x=>x.id!==id);closeModal();saveDB('Work entry moved to Trash.');
};

const renderSystemBaseV4=renderSystem;
renderSystem=async function(){
  await renderSystemBaseV4();
  const page=document.getElementById('page-system');if(!page||!cloudWorkspaceId)return;
  const grid=page.querySelector('.grid');if(!grid)return;
  try{
    const [statsRes,activityRes]=await Promise.all([
      supa.rpc('workspace_system_stats',{target_workspace:cloudWorkspaceId}),
      supa.rpc('list_workspace_activity',{target_workspace:cloudWorkspaceId,limit_count:5})
    ]);
    const st=statsRes.data?.[0];
    if(st){grid.insertAdjacentHTML('beforeend',`<div class="card span-5"><h2>Cloud Health</h2><div class="kv"><span>Active records</span><b>${st.active_records}</b></div><div class="kv"><span>Trash</span><b>${st.trashed_records}</b></div><div class="kv"><span>Activity events</span><b>${st.activity_events}</b></div><div class="kv"><span>Snapshots</span><b>${st.snapshots}</b></div><div class="kv"><span>Stored files</span><b>${st.storage_files}</b></div><div class="kv"><span>Cloud file storage</span><b>${formatBytes(st.storage_bytes||0)}</b></div></div>`);}
    const acts=activityRes.data||[];
    grid.insertAdjacentHTML('beforeend',`<div class="card span-7"><div class="section-head"><h2>Recent Changes</h2><button class="linkbtn" onclick="navTo('activity')">Full activity</button></div>${acts.map(a=>`<div class="kv"><div><b>${esc(a.label||a.record_type)}</b><div class="task-note">${esc(a.action)} • ${esc(a.email||'User')}</div></div><span class="tiny muted">${new Date(a.created_at).toLocaleString()}</span></div>`).join('')||'<div class="empty">No activity yet.</div>'}</div>`);
  }catch(e){console.warn('Could not load system stats',e)}
};
