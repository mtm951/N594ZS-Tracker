function saveDB(message){
  if(cloudSession&&cloudWorkspaceId&&typeof canCloudEdit==='function'&&!canCloudEdit()){
    toast('Viewer access is read-only. Changes were not saved.','bad');
    loadCloudState();
    return;
  }
  normalizeDB();
  if(typeof persistBrowserData==='function'){
    Promise.resolve(persistBrowserData(db)).catch(e=>console.warn('Browser cache save failed',e));
  }else{
    try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(e){console.warn('Browser cache save failed',e);}
  }
  queueCloudSave();
  renderAll();
  if(message) toast(message,'good');
}

function pill(v){
  let c='gray';
  if(['Done','Complete','Installed','Received','OK','On Hand'].includes(v))c='green';
  else if(['High','Blocked','Need to Order','Order','Overdue','Critical'].includes(v))c='red';
  else if(['Medium','Open','In Progress','Ordered','Verify','Check','Due Soon'].includes(v))c='yellow';
  else if(['Low','Quoted'].includes(v))c='blue';
  else if(['Backordered','Waiting'].includes(v))c='purple';
  return `<span class="pill ${c}">${esc(v||'—')}</span>`;
}
function fmtMoney(v){
  if(v===''||v===null||v===undefined||Number.isNaN(Number(v)))return '—';
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency:db.settings.currency||'USD',maximumFractionDigits:2}).format(Number(v));}catch(e){return '$'+Number(v).toFixed(2)}
}
function orderTotal(o){return num(o.qty)*num(o.unitPrice)+num(o.shipping)+num(o.tax)}
function consumedCost(l){return arr(l.consumedParts).reduce((s,p)=>s+num(p.qty)*num(p.unitCost),0)+num(l.otherCost)}
function projectCost(p){
  const used=arr(p.partsUsed).reduce((s,x)=>s+num(x.qty)*num(x.unitCost),0);
  const orders=db.orders.filter(o=>o.projectId===p.id).reduce((s,o)=>s+orderTotal(o),0);
  return used+orders;
}
function partConsumedQty(partId){return db.logs.reduce((s,l)=>s+arr(l.consumedParts).filter(x=>x.partId===partId).reduce((a,x)=>a+num(x.qty),0),0)}
function partAvailable(p){if(p.stockQty===''||p.stockQty===null||p.stockQty===undefined)return null;return num(p.stockQty)-partConsumedQty(p.id)}
function partInventoryValue(p){const a=partAvailable(p);return a===null?0:Math.max(0,a)*num(p.unitCost)}
function projectName(id){return projectById(id)?.title||'Unlinked'}
function partName(id){return partById(id)?.name||'Unlinked'}
function isClosedOrder(o){return ['Received','Cancelled'].includes(o.status)}
function toast(text,type=''){const w=document.getElementById('toastWrap');if(!w)return;const d=document.createElement('div');d.className='toast '+type;d.textContent=text;w.appendChild(d);setTimeout(()=>d.remove(),3200)}
function modalHeader(title,subtitle=''){return `<div class="modal-head"><div><div class="modal-title">${esc(title)}</div>${subtitle?`<div class="muted small" style="margin-top:3px">${esc(subtitle)}</div>`:''}</div><button class="icon-btn" data-modal-close onclick="closeModal()" aria-label="Close">✕</button></div>`}
function openModal(html,wide=false){
  const m=document.getElementById('modal'),b=document.getElementById('modalBox');
  b.className='modal-box'+(wide?' wide':'');b.innerHTML=html;
  if(!b.querySelector('[data-modal-close]')){
    b.insertAdjacentHTML('afterbegin','<button class="icon-btn" data-modal-close onclick="closeModal()" aria-label="Close popup" title="Close" style="position:sticky;top:0;float:right;z-index:25;margin:-4px -4px 8px 8px;background:#fff">✕</button>');
  }
  m.classList.add('open');
}
function closeModal(){document.getElementById('modal').classList.remove('open');currentDetail=null;objectUrls.forEach(URL.revokeObjectURL);objectUrls=[]}
function field(label,id,value='',type='text',extra=''){return `<div><label for="${id}">${esc(label)}</label><input id="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`}
function textareaField(label,id,value='',extraClass='full'){return `<div class="${extraClass}"><label for="${id}">${esc(label)}</label><textarea id="${id}">${esc(value)}</textarea></div>`}
function selectOptions(items,current,emptyLabel='— Select —'){return `<option value="">${esc(emptyLabel)}</option>`+items.map(x=>{const value=typeof x==='object'?x.value:x;const label=typeof x==='object'?x.label:x;return `<option value="${esc(value)}" ${String(current??'')===String(value)?'selected':''}>${esc(label)}</option>`}).join('')}
function projectOptions(current){return selectOptions(db.projects.map(p=>({value:p.id,label:p.title})),current,'— No linked project —')}
function partOptions(current){return selectOptions(db.parts.map(p=>({value:p.id,label:p.name+(p.partNo?' • '+p.partNo:'')})),current,'— Custom / no inventory part —')}
function systemOptions(current){const s=unique([...db.projects.map(x=>x.system),...db.parts.map(x=>x.system),...db.logs.map(x=>x.system),...db.docs.map(x=>x.system)].filter(Boolean)).sort();return selectOptions(s,current,'— Select system —')}
function formatBytes(n){if(!n)return '0 B';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(i?1:0)} ${u[i]}`}

function renderNav(){document.getElementById('nav').innerHTML=NAV.map(([id,label])=>`<button data-nav="${id}" class="${id===currentPage?'active':''}" onclick="navTo('${id}')">${label}</button>`).join('')}
function navTo(page){currentPage=page;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+page)?.classList.add('active');renderNav();if(page==='access'&&typeof renderAccess==='function')renderAccess();window.scrollTo({top:0,behavior:'smooth'})}
function setControl(id,value=''){const el=document.getElementById(id);if(el)el.value=value??''}
function openProjectsView(filters={}){navTo('projects');setControl('projectSearch',filters.query||'');setControl('projectStatus',filters.status||'');setControl('projectSystem',filters.system||'');setControl('projectPriority',filters.priority||'');renderProjectRows()}
function openOrdersView(status=''){navTo('orders');setControl('orderSearch','');setControl('orderStatus',status||'');renderOrderRows()}
function openPartsView(filters={}){navTo('parts');setControl('partSearch',filters.query||'');setControl('partSystem',filters.system||'');setControl('partStatus',filters.status||'');renderPartRows()}
function openLogsView(filters={}){navTo('logbook');setControl('logSearch',filters.query||'');setControl('logSystem',filters.system||'');renderLogRows()}
function activateOnEnter(event,fn){if(event.key==='Enter'||event.key===' '){event.preventDefault();fn()}}

// Modal escape hatches: X is universal; Escape and backdrop-click also close popups.
if(!window.__n594zsModalEscapeBound){
  window.__n594zsModalEscapeBound=true;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('modal')?.classList.contains('open'))closeModal()});
  document.addEventListener('click',e=>{const m=document.getElementById('modal');if(e.target===m&&m.classList.contains('open'))closeModal()});
}
