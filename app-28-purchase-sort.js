// ---------- V4.7 SORTABLE PURCHASE TABLES ----------

// Preserve exact extended amounts from source invoices when they are available.
const purchaseLineTotalSortableBase=purchaseLineTotal;
purchaseLineTotal=function(p){
  if(p&&p.lineTotal!==undefined&&p.lineTotal!==null&&p.lineTotal!=='')return num(p.lineTotal);
  return purchaseLineTotalSortableBase(p);
};

const purchaseSortState={
  transactions:{label:'Date',dir:'desc'},
  parts:{label:'Last bought',dir:'desc'}
};

function purchaseHeaderLabel(th){
  return String(th?.dataset?.sortLabel||th?.childNodes?.[0]?.textContent||th?.textContent||'').replace(/[▲▼↕]/g,'').trim();
}
function purchaseSortNumericLabel(label){return /^(Qty|Unit|Total|Total purchased|Purchases|Last price|Total spend)$/i.test(label)}
function purchaseSortValue(text,label){
  const t=String(text||'').trim();
  if(!t||t==='—'||/not shown/i.test(t))return null;
  if(purchaseSortNumericLabel(label)){
    const n=Number(t.replace(/[^0-9.+-]/g,''));return Number.isFinite(n)?n:null;
  }
  return t.toLowerCase();
}
function comparePurchaseSortValues(a,b,dir){
  if(a===null&&b===null)return 0;if(a===null)return 1;if(b===null)return -1;
  const mult=dir==='asc'?1:-1;
  if(typeof a==='number'&&typeof b==='number')return (a-b)*mult;
  return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})*mult;
}
function ensurePurchaseVendorColumns(table){
  if(!table)return;
  const head=table.querySelector('thead tr');if(!head)return;
  const labels=[...head.children].map(purchaseHeaderLabel);
  if(purchaseViewMode==='transactions'){
    if(!labels.some(x=>/^vendor$/i.test(x))){
      const th=document.createElement('th');th.textContent='Vendor';head.children[0]?.after(th);
      table.querySelectorAll('tbody tr.click-row').forEach(row=>{
        const m=/openPurchaseDetail\('([^']+)'\)/.exec(row.getAttribute('onclick')||'');
        const p=m?db.purchases.find(x=>String(x.id)===m[1]):null;
        const td=document.createElement('td');
        td.innerHTML=p?.vendor?`<b>${esc(p.vendor)}</b>${p.seller?`<div class="task-note">${esc(p.seller)}</div>`:''}`:'—';
        row.children[0]?.after(td);
      });
    }
  }else{
    if(!labels.some(x=>/^vendors?$/i.test(x))){
      const th=document.createElement('th');th.textContent='Vendors';head.children[0]?.after(th);
      table.querySelectorAll('tbody tr.click-row').forEach(row=>{
        const pn=row.children[0]?.querySelector('b')?.textContent?.trim()||'';
        const desc=row.children[0]?.querySelector('.task-note')?.textContent?.trim()||'';
        const matches=db.purchases.filter(p=>pn&&pn!=='No PN'?p.pn===pn:p.description===desc).filter(purchaseMatches);
        const vendors=[...new Set(matches.map(p=>p.vendor).filter(Boolean))].sort();
        const td=document.createElement('td');td.textContent=vendors.join(', ')||'—';row.children[0]?.after(td);
      });
    }
  }
}
function applyPurchaseTableSort(table){
  if(!table)return;const mode=purchaseViewMode,state=purchaseSortState[mode]||{};
  const head=[...table.querySelectorAll('thead th')],tbody=table.querySelector('tbody');if(!tbody)return;
  head.forEach((th,index)=>{
    const label=purchaseHeaderLabel(th);th.dataset.sortLabel=label;th.classList.add('purchase-sortable');th.title='Click to sort';th.setAttribute('role','button');th.tabIndex=0;
    th.innerHTML=`<span>${esc(label)}</span><span class="purchase-sort-arrow">${state.label===label?(state.dir==='asc'?'▲':'▼'):'↕'}</span>`;
    const activate=()=>{const s=purchaseSortState[mode];if(s.label===label)s.dir=s.dir==='asc'?'desc':'asc';else{s.label=label;s.dir='asc'};renderPurchaseRows()};
    th.onclick=activate;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}};
    th.setAttribute('aria-sort',state.label===label?(state.dir==='asc'?'ascending':'descending'):'none');
  });
  const activeIndex=head.findIndex(th=>purchaseHeaderLabel(th)===state.label);if(activeIndex<0)return;
  const rows=[...tbody.querySelectorAll('tr.click-row')];
  rows.sort((ra,rb)=>{
    const av=purchaseSortValue(ra.children[activeIndex]?.textContent,state.label),bv=purchaseSortValue(rb.children[activeIndex]?.textContent,state.label);
    return comparePurchaseSortValues(av,bv,state.dir);
  });
  rows.forEach(r=>tbody.appendChild(r));
}

const renderPurchaseRowsSortBase=renderPurchaseRows;
renderPurchaseRows=function(){
  renderPurchaseRowsSortBase();
  const table=document.querySelector('#purchaseRows table');if(!table)return;
  ensurePurchaseVendorColumns(table);
  applyPurchaseTableSort(table);
};

// Small visual cue without another stylesheet request.
(()=>{if(document.getElementById('purchaseSortStyle'))return;const s=document.createElement('style');s.id='purchaseSortStyle';s.textContent=`#page-purchases th.purchase-sortable{cursor:pointer;user-select:none;white-space:nowrap}#page-purchases th.purchase-sortable:hover{background:#eef5fb}#page-purchases .purchase-sort-arrow{font-size:.72em;margin-left:6px;opacity:.55}`;document.head.appendChild(s)})();
