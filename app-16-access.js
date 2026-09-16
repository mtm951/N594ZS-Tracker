// ---------- PEOPLE & ACCESS ----------
if(!NAV.some(x=>x[0]==='access')) NAV.splice(Math.max(0,NAV.length-1),0,['access','People']);

function rolePill(role){
  const cls=role==='owner'?'green':role==='editor'?'blue':'gray';
  return `<span class="pill ${cls}">${esc((role||'viewer').replace(/^./,c=>c.toUpperCase()))}</span>`;
}

async function renderAccess(){
  const page=document.getElementById('page-access');
  if(!page)return;
  if(!cloudSession){
    page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>People & Access</h1><div class="muted">Manage who can see or edit the shared N594ZS workspace.</div></div></div><div class="empty">Sign in to manage or view workspace access.<div style="margin-top:12px"><button class="primary" onclick="openCloudAuth()">Sign in</button></div></div></div>`;
    return;
  }
  if(!cloudWorkspaceId){
    page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>People & Access</h1><div class="muted">Your account is signed in but does not currently have N594ZS workspace access.</div></div></div><div class="empty">Ask an owner to add <b>${esc(cloudSession.user.email||'your email')}</b> as a viewer or editor, then sign out and back in.</div></div>`;
    return;
  }
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>People & Access</h1><div class="muted">Owner controls membership. Editors can change tracker data. Viewers are read-only.</div></div>${cloudRole==='owner'?'<button class="primary" onclick="openInviteAccess()">+ Add Person</button>':''}</div><div class="notice" style="margin:12px 0"><b>Your role:</b> ${rolePill(cloudRole)} <span class="muted small">${esc(cloudSession.user.email||'')}</span></div><div id="accessRows"><div class="empty">Loading access list…</div></div></div>`;
  const {data,error}=await supa.rpc('list_workspace_access',{target_workspace:cloudWorkspaceId});
  const box=document.getElementById('accessRows');
  if(!box)return;
  if(error){box.innerHTML=`<div class="danger-note">Could not load access list: ${esc(error.message)}</div>`;return;}
  const rows=data||[];
  const members=rows.filter(x=>x.kind==='member');
  const invites=rows.filter(x=>x.kind==='invite');
  box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Status</th>${cloudRole==='owner'?'<th>Controls</th>':''}</tr></thead><tbody>${members.map(accessMemberRow).join('')||'<tr><td colspan="4" class="empty">No members found.</td></tr>'}</tbody></table></div>${cloudRole==='owner'?`<div style="margin-top:22px"><h2>Pending invitations</h2><div class="muted small" style="margin-bottom:8px">Add an email here, then send that person the app link. When they create/sign in with the same email, access is accepted automatically.</div><div class="table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${invites.map(accessInviteRow).join('')||'<tr><td colspan="4" class="empty">No pending invitations.</td></tr>'}</tbody></table></div></div>`:''}`;
}

function accessMemberRow(m){
  const mine=m.user_id===cloudSession?.user?.id;
  const name=m.display_name||m.email||'Member';
  const controls=cloudRole==='owner'?`<div class="action-row"><select aria-label="Role for ${esc(name)}" onchange="changeWorkspaceRole('${m.user_id}',this.value)" ${mine&&m.role==='owner'?'title="You can change your role only if another owner exists"':''}><option value="viewer" ${m.role==='viewer'?'selected':''}>Viewer</option><option value="editor" ${m.role==='editor'?'selected':''}>Editor</option><option value="owner" ${m.role==='owner'?'selected':''}>Owner</option></select><button class="icon-btn" onclick="removeWorkspacePerson('${m.user_id}','${esc(String(m.email||name)).replace(/'/g,'&#39;')}')">Remove</button></div>`:'';
  return `<tr><td><b>${esc(name)}</b>${m.display_name&&m.email?`<div class="tiny muted">${esc(m.email)}</div>`:''}${mine?'<div class="mini-badge">You</div>':''}</td><td>${rolePill(m.role)}</td><td>${pill('Active')}</td>${cloudRole==='owner'?`<td>${controls}</td>`:''}</tr>`;
}

function accessInviteRow(i){
  return `<tr><td><b>${esc(i.email)}</b></td><td>${rolePill(i.role)}</td><td>${pill('Waiting')}</td><td><button class="icon-btn" onclick="cancelWorkspaceInvite('${i.record_id}')">Cancel</button></td></tr>`;
}

function openInviteAccess(){
  if(cloudRole!=='owner')return toast('Owner access required.','bad');
  openModal(`${modalHeader('Add person','Authorize someone to the shared N594ZS workspace by email.')}<form onsubmit="submitWorkspaceInvite(event)"><div class="form-grid">${field('Email','accessInviteEmail','','email','required autocomplete="email"')}<div><label for="accessInviteRole">Role</label><select id="accessInviteRole"><option value="viewer">Viewer — read only</option><option value="editor">Editor — can change tracker data</option></select></div></div><div class="card soft-card" style="margin-top:12px"><b>How it works</b><div class="muted small" style="margin-top:5px">If they already have an account, access is added immediately. Otherwise this creates a pending invitation. Send them the tracker URL and have them sign up using this exact email address.</div></div><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary">Add Person</button></div></form>`);
}

async function submitWorkspaceInvite(e){
  e.preventDefault();
  if(cloudRole!=='owner')return;
  const email=val('accessInviteEmail'),role=val('accessInviteRole')||'viewer';
  const {data,error}=await supa.rpc('invite_workspace_member',{target_workspace:cloudWorkspaceId,target_email:email,target_role:role});
  if(error){toast(error.message,'bad');return;}
  closeModal();
  toast(data==='added'?'Person added to N594ZS Tracker.':'Invitation saved. Send them the tracker link.','good');
  renderAccess();
}

async function changeWorkspaceRole(userId,role){
  if(cloudRole!=='owner')return;
  const {error}=await supa.rpc('set_workspace_member_role',{target_workspace:cloudWorkspaceId,target_user:userId,target_role:role});
  if(error){toast(error.message,'bad');renderAccess();return;}
  if(userId===cloudSession?.user?.id) cloudRole=role;
  cloudStatusLabel('Synced');
  toast('Role updated.','good');
  renderAccess();
}

async function removeWorkspacePerson(userId,email){
  if(cloudRole!=='owner')return;
  if(!confirm(`Remove ${email} from N594ZS Tracker?`))return;
  const {error}=await supa.rpc('remove_workspace_member',{target_workspace:cloudWorkspaceId,target_user:userId});
  if(error){toast(error.message,'bad');return;}
  toast('Access removed.','good');
  if(userId===cloudSession?.user?.id){cloudWorkspaceId=null;cloudRole=null;cloudStatusLabel('No workspace access');}
  renderAccess();
}

async function cancelWorkspaceInvite(inviteId){
  if(cloudRole!=='owner')return;
  const {error}=await supa.rpc('cancel_workspace_invitation',{target_workspace:cloudWorkspaceId,target_invitation:inviteId});
  if(error){toast(error.message,'bad');return;}
  toast('Invitation cancelled.','good');
  renderAccess();
}
