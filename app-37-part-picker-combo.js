// ---------- V5.0.4 BROWSE + SEARCH PART PICKER ----------
// Makes the part picker behave like a searchable dropdown: browse the full list or type to filter it.

(function(){
  const style=document.createElement('style');
  style.textContent=`
    .part-picker-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}
    .part-picker-browse{white-space:nowrap;padding:8px 11px;border:1px solid #c8d5df;border-radius:7px;background:#f8fbfd;color:#264864;font-weight:800;cursor:pointer}
    .part-picker-browse:hover{background:#eef6fc}
    .part-picker-help{font-size:10px;color:#6e7f8e;margin-top:4px}
    @media(max-width:600px){.part-picker-row{grid-template-columns:1fr}.part-picker-browse{width:100%}}
  `;
  document.head.appendChild(style);
})();

searchablePartPicker=function(prefix,selectedId=null,label='Inventory part (optional)'){
  const selected=selectedId?partById(Number(selectedId)):null;
  const selectedText=selected?partPickerLabel(selected):'';
  return `<div class="full part-picker" id="${prefix}Picker"><label>${esc(label)}</label><div class="part-picker-row"><input type="search" id="${prefix}Search" autocomplete="off" placeholder="Search inventory…" value="${esc(selectedText)}" onfocus="renderPartPickerResults('${prefix}')" oninput="partPickerTyped('${prefix}')"><button type="button" class="part-picker-browse" onclick="togglePartPickerBrowse('${prefix}')">Browse ▾</button></div><input type="hidden" id="${prefix}PartId" value="${selected?esc(selected.id):''}"><div class="part-picker-help">Click Browse to see the full list, or type a name, part number, system, vendor, location, or status to filter it.</div><div class="part-picker-results" id="${prefix}Results"></div><div class="part-picker-selected" id="${prefix}Selected" style="${selected?'':'display:none'}">${selected?partPickerSelectedHTML(selected):''}</div></div>`;
};

function togglePartPickerBrowse(prefix){
  const box=document.getElementById(prefix+'Results');
  const input=document.getElementById(prefix+'Search');
  if(!box||!input)return;
  if(box.classList.contains('open')){box.classList.remove('open');return}
  // Browsing should show the whole inventory regardless of any previously selected label.
  if(document.getElementById(prefix+'PartId')?.value){input.value='';document.getElementById(prefix+'PartId').value='';const selected=document.getElementById(prefix+'Selected');if(selected)selected.style.display='none'}
  renderPartPickerResults(prefix);
  input.focus();
}
