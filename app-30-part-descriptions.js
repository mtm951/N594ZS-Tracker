// ---------- V4.9 PART DESCRIPTION POLISH ----------
// Adds a first-class editable description to inventory Parts while keeping
// Notes / Specifications separate for fitment, condition, history, etc.

const normalizeDBPartDescriptionBase=normalizeDB;
normalizeDB=function(){
  normalizeDBPartDescriptionBase();
  db.parts=arr(db.parts);
  db.parts.forEach(p=>{if(p.description===undefined||p.description===null)p.description=''});
};
normalizeDB();

const openPartModalDescriptionBase=openPartModal;
openPartModal=function(id=null,projectId=null){
  openPartModalDescriptionBase(id,projectId);
  const p=id?partById(id):null,box=document.getElementById('modalBox'),name=document.getElementById('ptName');
  if(!box||!name||document.getElementById('ptDescription'))return;
  const host=name.closest('.full')||name.parentElement;
  host?.insertAdjacentHTML('afterend',`<div class="full"><label>Description</label><textarea id="ptDescription" placeholder="Plain-language description of what this part/material is">${esc(p?.description||'')}</textarea></div>`);
};

savePart=function(id,projectId=null){
  const old=id?partById(id):null;
  const o={
    name:val('ptName'),description:val('ptDescription'),partNo:val('ptPN'),system:val('ptSystem')||'General',unit:val('ptUnit')||'ea',
    stockQty:val('ptStock')===''?'':num(val('ptStock')),minQty:val('ptMin')===''?'':num(val('ptMin')),status:val('ptStatus'),vendor:val('ptVendor'),
    url:val('ptUrl'),unitCost:val('ptCost'),location:val('ptLocation'),purchaseDate:val('ptPurchase'),notes:val('ptNotes')
  };
  if(!o.name)return alert('Part name is required.');
  let pid=id;
  if(old)Object.assign(old,o);
  else{pid=uid();db.parts.push({id:pid,...o,linkedProjectIds:projectId?[projectId]:[],updates:[]})}
  saveDB(id?'Part updated.':'Part added.');closeModal();
};

renderPartRows=function(){
  const el=document.getElementById('partRows');if(!el)return;
  const q=(val('partSearch')||'').toLowerCase(),sys=val('partSystem'),st=val('partStatus');
  const rows=db.parts.filter(p=>(!q||[p.name,p.description,p.partNo,p.system,p.vendor,p.notes,p.location].join(' ').toLowerCase().includes(q))&&(!sys||(typeof systemRecordMatches==='function'?systemRecordMatches(p,sys,'parts'):p.system===sys))&&(!st||p.status===st));
  el.innerHTML=rows.map(p=>`<tr class="click-row" onclick="openPartDetail(${p.id})"><td><div class="task-title">${esc(p.name)}</div><div class="task-note">${esc(p.description||p.notes||'')}</div></td><td>${esc(p.partNo||'—')}</td><td>${esc(p.system||'—')}</td><td>${partAvailable(p)===null?'—':esc(partAvailable(p)+' '+(p.unit||''))}</td><td>${esc(partConsumedQty(p.id)+' '+(p.unit||''))}</td><td>${pill(p.status)}</td><td>${esc(p.vendor||'—')}</td><td>${db.settings.showCosts?fmtMoney(p.unitCost):'Hidden'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openPartModal(${p.id})">Edit</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">No matching parts.</td></tr>';
};

const openPartDetailDescriptionBase=openPartDetail;
openPartDetail=function(id){
  openPartDetailDescriptionBase(id);
  const p=partById(id),box=document.getElementById('modalBox');if(!p||!box)return;
  const card=[...box.querySelectorAll('.detail-card')].find(c=>/Part Record/i.test(c.querySelector('h3')?.textContent||''));
  if(!card||card.querySelector('[data-part-description]'))return;
  const notes=[...card.querySelectorAll('.detail-section')].find(x=>/Notes \/ Specifications/i.test(x.querySelector('label')?.textContent||''));
  const html=`<div class="detail-section" data-part-description><label>Description</label><div class="detail-text">${esc(p.description||'No description yet.')}</div></div>`;
  if(notes)notes.insertAdjacentHTML('beforebegin',html);else card.insertAdjacentHTML('beforeend',html);
};
