const SUPABASE_URL='https://fbjyhodrddsvuesafxce.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_BebbqF7DaM1P6EHlph0DWQ_xoZdSmoa';
const WORKSPACE_SLUG='n594zs';
const APP_URL='https://mtm951.github.io/N594ZS-Tracker/';
let supa=null, cloudSession=null, cloudWorkspaceId=null, cloudRole=null, cloudSaveTimer=null, cloudLoading=false, cloudChannel=null;

function cloudStatusLabel(text,kind=''){
  const el=document.getElementById('cloudStatus');
  if(!el)return;
  const role=cloudSession&&cloudRole?` • ${cloudRole[0].toUpperCase()+cloudRole.slice(1)}`:'';
  el.innerHTML=`<button class="secondary" onclick="${cloudSession?'openCloudAccount()':'openCloudAuth()'}">${esc(text+role)}</button>`;
}

function canCloudEdit(){return !cloudSession||!cloudWorkspaceId||cloudRole==='owner'||cloudRole==='editor'}
function persistCloudCache(){try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(_e){}}

async function initCloud(){
  try{
    if(!window.supabase?.createClient){cloudStatusLabel('Cloud unavailable');return;}
    supa=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
    const {data:{session}}=await supa.auth.getSession();
    cloudSession=session||null;
    supa.auth.onAuthStateChange(async(_event,session)=>{
      cloudSession=session||null;
      if(cloudSession) await connectWorkspaceAndLoad();
      else {stopCloudRealtime();cloudWorkspaceId=null;cloudRole=null;cloudStatusLabel('Sign in to sync');if(typeof renderAccess==='function')renderAccess();}
    });
    if(cloudSession) await connectWorkspaceAndLoad();
    else cloudStatusLabel('Sign in to sync');
  }catch(err){console.error('Cloud init failed',err);cloudStatusLabel('Cloud error');}
}

async function connectWorkspaceAndLoad(){
  if(!supa||!cloudSession)return;
  cloudStatusLabel('Connecting…');
  try{
    await supa.rpc('accept_workspace_invitations');
    let {data:membership,error:memberErr}=await supa.from('workspace_members').select('workspace_id,role').limit(1).maybeSingle();
    if(memberErr) throw memberErr;
    if(!membership){
      const claim=await supa.rpc('claim_workspace_owner',{target_slug:WORKSPACE_SLUG});
      if(claim.error){
        cloudWorkspaceId=null;cloudRole=null;
        cloudStatusLabel('No workspace access');
        toast('Signed in, but this account does not have access to N594ZS Tracker. Ask an owner to add your email in People & Access.','bad');
        if(typeof renderAccess==='function')renderAccess();
        return;
      }
      cloudWorkspaceId=claim.data;
      const roleResult=await supa.rpc('current_workspace_role',{target_workspace:cloudWorkspaceId});
      cloudRole=roleResult.data||'owner';
    }else{
      cloudWorkspaceId=membership.workspace_id;
      cloudRole=membership.role;
    }
    await loadCloudState();
    startCloudRealtime();
    cloudStatusLabel('Synced');
    if(typeof renderAccess==='function')renderAccess();
  }catch(err){console.error(err);cloudStatusLabel('Sync error');toast('Cloud sync error: '+err.message,'bad');}
}

async function loadCloudState(silent=false){
  if(!supa||!cloudWorkspaceId)return;
  cloudLoading=true;
  try{
    const {data,error}=await supa.from('app_state').select('data,updated_at,updated_by').eq('workspace_id',cloudWorkspaceId).maybeSingle();
    if(error) throw error;
    const remote=data?.data;
    if(remote&&Object.keys(remote).length){
      db=remote;
      normalizeDB();
      persistCloudCache();
      renderAll();
      if(!silent)toast('Loaded shared N594ZS data.','good');
    }else if(canCloudEdit()){
      if(typeof migrateAircraftPhotoToCloudIfNeeded==='function')await migrateAircraftPhotoToCloudIfNeeded();
      normalizeDB();
      const payload={workspace_id:cloudWorkspaceId,data:db,updated_by:cloudSession.user.id,updated_at:new Date().toISOString()};
      const {error:saveError}=await supa.from('app_state').upsert(payload,{onConflict:'workspace_id'});
      if(saveError)throw saveError;
      persistCloudCache();
      renderAll();
      toast('Shared workspace initialized from this device.','good');
    }
  }finally{cloudLoading=false;}
}

function queueCloudSave(){
  if(!supa||!cloudSession||!cloudWorkspaceId||cloudLoading||!canCloudEdit())return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(saveCloudState,500);
}

async function saveCloudState(){
  if(!supa||!cloudSession||!cloudWorkspaceId||cloudLoading||!canCloudEdit())return;
  try{
    const payload={workspace_id:cloudWorkspaceId,data:db,updated_by:cloudSession.user.id,updated_at:new Date().toISOString()};
    const {error}=await supa.from('app_state').upsert(payload,{onConflict:'workspace_id'});
    if(error) throw error;
    cloudStatusLabel('Synced');
  }catch(err){console.error('Cloud save failed',err);cloudStatusLabel('Sync pending');toast('Saved locally; cloud sync failed: '+err.message,'bad');}
}

function stopCloudRealtime(){
  if(cloudChannel&&supa){supa.removeChannel(cloudChannel);}
  cloudChannel=null;
}

function startCloudRealtime(){
  stopCloudRealtime();
  if(!supa||!cloudSession||!cloudWorkspaceId)return;
  cloudChannel=supa.channel(`n594zs-state-${cloudWorkspaceId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'app_state',filter:`workspace_id=eq.${cloudWorkspaceId}`},payload=>{
      if(cloudLoading)return;
      const remote=payload.new?.data;
      if(!remote||!Object.keys(remote).length)return;
      const fromOther=!!(payload.new?.updated_by&&payload.new.updated_by!==cloudSession?.user?.id);
      cloudLoading=true;
      try{
        db=remote;
        normalizeDB();
        persistCloudCache();
        renderAll();
        cloudStatusLabel('Synced');
      }finally{cloudLoading=false;}
      if(fromOther)toast('N594ZS updated from another device.','good');
    })
    .subscribe(status=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')cloudStatusLabel('Sync degraded');
    });
}

function openCloudAuth(){
  openModal(`${modalHeader('Sign in to N594ZS Tracker','Use the same account on any device to see the same shared data.')}
  <form onsubmit="cloudSignIn(event)"><div class="form-grid">
    ${field('Email','cloudEmail','', 'email','required autocomplete="email"')}
    ${field('Password','cloudPassword','', 'password','required minlength="6" autocomplete="current-password"')}
  </div><div class="modal-actions"><button type="button" class="secondary" onclick="cloudSignUp()">Create account</button><button class="primary">Sign in</button></div></form>`,false);
}

async function cloudSignIn(e){
  e.preventDefault();
  const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
  const {error}=await supa.auth.signInWithPassword({email,password});
  if(error){toast(error.message,'bad');return;}
  closeModal();toast('Signed in.','good');
}

async function cloudSignUp(){
  const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
  if(!email||password.length<6){toast('Enter an email and password of at least 6 characters.','bad');return;}
  const {data,error}=await supa.auth.signUp({email,password,options:{emailRedirectTo:APP_URL}});
  if(error){toast(error.message,'bad');return;}
  if(data.session){closeModal();toast('Account created and signed in.','good');}
  else toast('Account created. Check your email to confirm, then sign in.','good');
}

function openCloudAccount(){
  const email=cloudSession?.user?.email||'Signed in';
  const role=cloudRole?cloudRole[0].toUpperCase()+cloudRole.slice(1):'No workspace access';
  openModal(`${modalHeader('Cloud account',email)}<div class="card soft-card"><b>Shared sync is active</b><div class="muted small" style="margin-top:6px">Workspace role: <b>${esc(role)}</b>. Projects, parts, orders, logs, documents, checklists, aircraft data and shared files sync across signed-in devices. Changes from another open device are applied live.</div></div><div class="modal-actions"><button class="secondary" onclick="closeModal();navTo('access')">People & Access</button><button class="secondary" onclick="forceCloudReload()">Reload shared data</button><button class="danger" onclick="cloudSignOut()">Sign out</button></div>`,false);
}

async function forceCloudReload(){closeModal();await loadCloudState(true);cloudStatusLabel('Synced');toast('Shared data reloaded.','good');}
async function cloudSignOut(){stopCloudRealtime();await supa.auth.signOut();closeModal();toast('Signed out. Local data remains on this device.','good');}
