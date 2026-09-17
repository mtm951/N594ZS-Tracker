// ---------- V5.0.3 SEARCHABLE PART PICKERS ----------
// Replaces long inventory dropdowns used for project part-use and work-log consumption.

(function(){
  const style=document.createElement('style');
  style.textContent=`
    .part-picker{position:relative}
    .part-picker input[type="search"]{padding-right:38px}
    .part-picker-clear{position:absolute;right:7px;top:29px;border:0;background:transparent;color:#6e7f8e;font-size:18px;cursor:pointer;padding:3px 7px;line-height:1}
    .part-picker-results{display:none;position:absolute;left:0;right:0;top:100%;z-index:160;background:#fff;border:1px solid #c8d5df;border-radius:8px;box-shadow:0 12px 30px rgba(23,50,76,.18);max-height:310px;overflow:auto;margin-top:3px}
    .part-picker-results.open{display:block}
    .part-picker-item{width:100%;border:0;border-bottom:1px solid #edf1f4;background:#fff;text-align:left;padding:10px 11px;cursor:pointer;color:#17324c}
    .part-picker-item:last-child{border-bottom:0}
    .part-picker-item:hover,.part-picker-item:focus{background:#f2f8fd;outline:none}
    .part-picker-item b{display:block;font-size:13px;margin-bottom:2px}
    .part-picker-item small{display:block;color:#6e7f8e;line-height:1.35}
    .part-picker-selected{margin-top:6px;padding:7px 9px;border-radius:7px;background:#eef7ff;border:1px solid #d3e7f8;font-size:11px;color:#36536c}
    .part-picker-empty{padding:13px;color:#6e7f8e;text-align:center;font-size:12px}
  `;
  document.head.appendChild(style);
})();

function searchablePartPicker(prefix,selectedId=null,label='Inventory part (optional)'){
  const selected=selectedId?partById(Number(selectedId)):null;
  const selectedText=selected?partPickerLabel(selected):'';
  return `<div class="full part-picker" id="${prefix}Picker"><label>${esc(label)}</label><input type="search" id="${prefix}Search" autocomplete="off" placeholder="Search name, PN, description, system, vendor…" value="${esc(selectedText)}" onfocus="renderPartPickerResults('${prefix}')" oninput="partPickerTyped('${prefix}')"><input type="hidden" id="${prefix}PartId" value="${selected?esc(selected.id):''}"><button type="button" class="part-picker-clear" title="Clear selection" aria-label="Clear part selection" onclick="clearPartPicker('${prefix}')">×</button><div class="part-picker-results" id="${prefix}Results"></div><div class="part-picker-selected" id="${prefix}Selected" style="${selected?'':'display:none'}">${selected?partPickerSelectedHTML(selected):''}</div></div>`;
}
function partPickerLabel(p){return `${p.name||'Part'}${p.partNo?` • ${p.partNo}`:''}`}
function partPickerSelectedHTML(p){const a=partAvailable(p);return `<b>${esc(p.name||'Part')}</b>${p.partNo?` • PN ${esc(p.partNo)}`:''}${p.system?` • ${esc(p.system)}`:''}${a!==null?` • Available ${esc(a)} ${esc(p.unit||'ea')}`:''}`}
function partPickerSearchText(p){return [p.name,p.partNo,p.description,p.system,p.vendor,p.location,p.status].filter(Boolean).join(' ').toLowerCase()}
function partPickerTyped(prefix){
  const hidden=document.getElementById(prefix+'PartId');if(hidden)hidden.value='';
  const selected=document.getElementById(prefix+'Selected');if(selected)selected.style.display='none';
  renderPartPickerResults(prefix);
}
function renderPartPickerResults(prefix){
  const input=document.getElementById(prefix+'Search'),box=document.getElementById(prefix+'Results');if(!input||!box)return;
  const q=input.value.trim().toLowerCase();
  let rows=[...arr(db.parts)];
  if(q)rows=rows.filter(p=>partPickerSearchText(p).includes(q));
  rows.sort((a,b)=>{
    const aa=partAvailable(a),bb=partAvailable(b),aStock=aa!==null&&aa>0?0:1,bStock=bb!==null&&bb>0?0:1;
    return aStock-bStock||String(a.name||'').localeCompare(String(b.name||''));
  });
  rows=rows.slice(0,40);
  box.innerHTML=rows.length?rows.map(p=>{const a=partAvailable(p);return `<button type="button" class="part-picker-item" onclick="choosePartPicker('${prefix}',${Number(p.id)})"><b>${esc(p.name||'Part')}${p.partNo?` • ${esc(p.partNo)}`:''}</b><small>${esc(p.system||'General')}${p.vendor?` • ${esc(p.vendor)}`:''}${a!==null?` • Available ${esc(a)} ${esc(p.unit||'ea')}`:''}${p.location?` • ${esc(p.location)}`:''}</small></button>`}).join(''):`<div class="part-picker-empty">No inventory parts match “${esc(input.value)}”. You can still enter a manual item below.</div>`;
  box.classList.add('open');
}
function choosePartPicker(prefix,id){
  const p=partById(Number(id));if(!p)return;
  const input=document.getElementById(prefix+'Search'),hidden=document.getElementById(prefix+'PartId'),box=document.getElementById(prefix+'Results'),selected=document.getElementById(prefix+'Selected');
  if(input)input.value=partPickerLabel(p);if(hidden)hidden.value=String(p.id);if(box)box.classList.remove('open');if(selected){selected.innerHTML=partPickerSelectedHTML(p);selected.style.display='block'}
  if(prefix==='ppu')prefillProjectPart();
  if(prefix==='cp')prefillConsumedPart();
}
function clearPartPicker(prefix){
  const input=document.getElementById(prefix+'Search'),hidden=document.getElementById(prefix+'PartId'),box=document.getElementById(prefix+'Results'),selected=document.getElementById(prefix+'Selected');
  if(input){input.value='';input.focus()}if(hidden)hidden.value='';if(selected)selected.style.display='none';if(box)box.classList.remove('open');
}
function partPickerId(prefix){const v=document.getElementById(prefix+'PartId')?.value;return v?Number(v):null}

document.addEventListener('click',e=>{
  document.querySelectorAll('.part-picker-results.open').forEach(box=>{if(!box.closest('.part-picker')?.contains(e.target))box.classList.remove('open')});
});

// Project -> Parts Used
addProjectPart=function(projectId){
  const p=projectById(projectId);if(!p)return;
  openModal(`${modalHeader('Add Part Used',p.title)}<div class="form-grid">${searchablePartPicker('ppu')} ${field('Part / material name','ppuName','')}${field('Quantity','ppuQty','1','number','step="any"')}${field('Unit','ppuUnit','ea')}${field('Unit cost','ppuCost','', 'number','step="0.01" min="0"')}${textareaField('Notes','ppuNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openProjectDetail(${projectId})">Cancel</button><button class="btn primary" onclick="saveProjectPart(${projectId})">Add Part</button></div>`);
};
prefillProjectPart=function(){const p=partById(partPickerId('ppu'));if(!p)return;setControl('ppuName',p.name);setControl('ppuUnit',p.unit||'ea');setControl('ppuCost',p.unitCost??'')};
saveProjectPart=function(projectId){const p=projectById(projectId);if(!p)return;const partId=partPickerId('ppu'),name=val('ppuName')||(partId?partName(partId):'');if(!name)return alert('Part name is required.');p.partsUsed.push({id:uid(),partId,name,qty:num(val('ppuQty'))||1,unit:val('ppuUnit')||'ea',unitCost:val('ppuCost'),notes:val('ppuNotes')});if(partId){const part=partById(partId);if(part&&!part.linkedProjectIds.includes(projectId))part.linkedProjectIds.push(projectId)}saveDB('Part added to project.');openProjectDetail(projectId)};

// Work Log -> Parts & Consumables Used
addConsumedPart=function(logId,presetPartId=null){
  const l=logById(logId);if(!l)return;const pp=presetPartId?partById(Number(presetPartId)):null;
  openModal(`${modalHeader('Add Consumed Part / Material',l.work)}<div class="form-grid">${searchablePartPicker('cp',presetPartId)}${field('Item name','cpName',pp?.name||'')}${field('Quantity','cpQty','1','number','step="any" min="0"')}${field('Unit','cpUnit',pp?.unit||'ea')}${field('Unit cost at time of use','cpCost',pp?.unitCost||'','number','step="0.01" min="0"')}${textareaField('Notes','cpNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openLogDetail(${logId})">Cancel</button><button class="btn primary" onclick="saveConsumedPart(${logId})">Add Item</button></div>`);
};
prefillConsumedPart=function(){const p=partById(partPickerId('cp'));if(!p)return;setControl('cpName',p.name);setControl('cpUnit',p.unit||'ea');setControl('cpCost',p.unitCost??'')};
saveConsumedPart=function(logId){const l=logById(logId);if(!l)return;const partId=partPickerId('cp'),name=val('cpName')||(partId?partName(partId):'');if(!name)return alert('Item name is required.');l.consumedParts.push({id:uid(),partId,name,qty:num(val('cpQty'))||1,unit:val('cpUnit')||'ea',unitCost:val('cpCost'),notes:val('cpNotes')});if(partId){const p=partById(partId);l.projectIds.forEach(pid=>{if(p&&!p.linkedProjectIds.includes(pid))p.linkedProjectIds.push(pid)})}saveDB('Consumed item recorded.');openLogDetail(logId)};
