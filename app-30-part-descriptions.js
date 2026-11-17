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

// Cross-reference part numbers describe ONE physical inventory item, not additional stock.
function partAlternateCodes(part){
  const value=part?.alternatePartNos??[];
  const raw=Array.isArray(value)?value:String(value||'').split(/[,;\n\r]+/);
  const primary=String(part?.partNo||'').trim().toUpperCase(),seen=new Set();
  return raw.map(x=>String(x||'').trim()).filter(x=>{
    const key=x.toUpperCase();
    if(!key||key===primary||seen.has(key))return false;
    seen.add(key);return true;
  });
}
function parsePartAlternateCodes(raw,primary=''){
  return partAlternateCodes({alternatePartNos:String(raw||'').split(/[,;\n\r]+/),partNo:primary});
}
function partNumberCrossReferenceCollision(id,primary,aliases){
  const keys=[primary,...aliases].map(x=>String(x||'').trim().toUpperCase()).filter(Boolean);
  for(const p of db.parts||[]){
    if(String(p.id)===String(id))continue;
    const candidates=[p.partNo,...partAlternateCodes(p)].map(x=>String(x||'').trim().toUpperCase()).filter(Boolean);
    const conflict=keys.find(x=>candidates.includes(x));
    if(conflict)return {part:p,number:conflict};
  }
  return null;
}

const openPartModalDescriptionBase=openPartModal;
openPartModal=function(id=null,projectId=null){
  openPartModalDescriptionBase(id,projectId);
  const p=id?partById(id):null,box=document.getElementById('modalBox'),name=document.getElementById('ptName');
  if(!box||!name||document.getElementById('ptDescription'))return;
  const host=name.closest('.full')||name.parentElement;
  host?.insertAdjacentHTML('afterend',`<div class="full"><label>Description</label><textarea id="ptDescription" placeholder="Plain-language description of what this part/material is">${esc(p?.description||'')}</textarea></div>
    <div class="full" id="ptAlternatePNGroup"><label for="ptAlternatePN">Alternate / equivalent part numbers</label><textarea id="ptAlternatePN" rows="2" placeholder="AN380-4-5, another equivalent number…">${esc(partAlternateCodes(p).join(', '))}</textarea><small>Use commas or new lines. These are searchable cross-references to this one inventory record — they do not create additional stock. Only list verified interchangeable part numbers.</small></div>`);
};

savePart=function(id,projectId=null){
  const old=id?partById(id):null;
  const o={
    name:val('ptName'),description:val('ptDescription'),partNo:val('ptPN'),alternatePartNos:parsePartAlternateCodes(val('ptAlternatePN'),val('ptPN')),system:val('ptSystem')||'General',unit:val('ptUnit')||'ea',
    stockQty:val('ptStock')===''?'':num(val('ptStock')),minQty:val('ptMin')===''?'':num(val('ptMin')),status:val('ptStatus'),vendor:val('ptVendor'),
    url:val('ptUrl'),unitCost:val('ptCost'),location:val('ptLocation'),purchaseDate:val('ptPurchase'),notes:val('ptNotes')
  };
  if(!o.name)return alert('Part name is required.');
  const conflict=partNumberCrossReferenceCollision(id,o.partNo,o.alternatePartNos);
  if(conflict)return alert('Part number '+conflict.number+' is already assigned to '+conflict.part.name+'. Link to that existing part or resolve the duplicate before saving.');
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
  const aliases=partAlternateCodes(p);
  if(aliases.length&&!card.querySelector('[data-part-aliases]')){
    const row='<div class="detail-section" data-part-aliases><label>Alternate / equivalent part numbers</label><div class="detail-text">'+aliases.map(x=>'<span class="tag">'+esc(x)+'</span>').join(' ')+'</div><small>Cross-reference numbers share this part\'s inventory and usage history.</small></div>';
    card.querySelector('[data-part-description]')?.insertAdjacentHTML('afterend',row);
  }
};
