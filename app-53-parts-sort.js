'use strict';
// ---------- V5.10.7 SORTABLE PARTS / MATERIALS TABLE ----------

(function(){
  if(window.__n594zsSortablePartsInstalled)return;
  window.__n594zsSortablePartsInstalled=true;

  const STATUS_RANK={'On Hand':0,'Installed':1,'Verify':2,'Need':3,'Order':4,'Backordered':5,'Retired':6};
  let partSort=(()=>{
    try{
      const saved=JSON.parse(sessionStorage.getItem('n594zs_part_sort')||'null');
      if(saved&&saved.key&&['asc','desc'].includes(saved.dir))return saved;
    }catch(_e){}
    return {key:'name',dir:'asc'};
  })();

  function savePartSort(){
    try{sessionStorage.setItem('n594zs_part_sort',JSON.stringify(partSort))}catch(_e){}
  }

  function partSortHead(label,key){
    const active=partSort.key===key;
    const aria=active?(partSort.dir==='asc'?'ascending':'descending'):'none';
    return `<th class="part-sortable" aria-sort="${aria}"><button class="part-sort-button" data-part-sort="${key}" onclick="setPartSort('${key}')" title="Sort by ${esc(label)}">${esc(label)} <span>${active?(partSort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>`;
  }

  window.setPartSort=function(key){
    if(partSort.key===key)partSort.dir=partSort.dir==='asc'?'desc':'asc';
    else{
      const numeric=new Set(['onHand','reserved','free']);
      partSort={key,dir:numeric.has(key)?'desc':'asc'};
    }
    savePartSort();
    renderPartRows();
  };

  function sortValue(p,key){
    if(key==='name')return p.name||'';
    if(key==='partNo')return p.partNo||'';
    if(key==='system')return p.system||'';
    if(key==='vendor')return p.vendor||'';
    if(key==='status')return STATUS_RANK[p.status]??99;
    if(key==='onHand'){
      const v=typeof partPhysicalOnHand==='function'?partPhysicalOnHand(p):(typeof partAvailable==='function'?partAvailable(p):p.stockQty);
      return v===null||v===undefined||v===''?null:num(v);
    }
    if(key==='reserved')return typeof partReservedQty==='function'?num(partReservedQty(p.id)):0;
    if(key==='free'){
      const v=typeof partFreeQty==='function'?partFreeQty(p):(typeof partAvailable==='function'?partAvailable(p):p.stockQty);
      return v===null||v===undefined||v===''?null:num(v);
    }
    return '';
  }

  function sortRows(rows){
    const dir=partSort.dir==='desc'?-1:1,key=partSort.key;
    const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
    return rows.sort((a,b)=>{
      const av=sortValue(a,key),bv=sortValue(b,key);
      const aBlank=av===null||av===undefined||av==='',bBlank=bv===null||bv===undefined||bv==='';
      if(aBlank!==bBlank)return aBlank?1:-1;
      let cmp=0;
      if(typeof av==='number'&&typeof bv==='number')cmp=av-bv;
      else cmp=collator.compare(String(av),String(bv));
      return cmp*dir||collator.compare(String(a.name||''),String(b.name||''))||num(a.id)-num(b.id);
    });
  }

  window.renderParts=function(){
    const systems=unique(db.parts.map(x=>x.system).filter(Boolean)).sort();
    document.getElementById('page-parts').innerHTML=`<div class="card">
      <div class="toolbar"><div><h1>Parts & Materials</h1><div class="muted">Physical inventory, project reservations, usage history and purchasing provenance. Click a column heading to sort.</div></div><button class="btn primary" onclick="openPartModal()">+ Add Part</button></div>
      <div class="controls"><input id="partSearch" placeholder="Search parts…" oninput="renderPartRows()"><select id="partSystem" onchange="renderPartRows()"><option value="">All systems</option>${systems.map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="partStatus" onchange="renderPartRows()"><option value="">All statuses</option>${unique(db.parts.map(p=>p.status).filter(Boolean)).map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
      <div class="table-wrap" style="margin-top:11px"><table><thead><tr>
        ${partSortHead('Part / material','name')}
        ${partSortHead('PN / spec','partNo')}
        ${partSortHead('System','system')}
        ${partSortHead('On hand','onHand')}
        ${partSortHead('Reserved','reserved')}
        ${partSortHead('Free','free')}
        ${partSortHead('Status','status')}
        ${partSortHead('Vendor','vendor')}
        <th></th>
      </tr></thead><tbody id="partRows"></tbody></table></div>
    </div>`;
    renderPartRows();
  };

  window.renderPartRows=function(){
    const el=document.getElementById('partRows');if(!el)return;
    const q=(val('partSearch')||'').toLowerCase(),sys=val('partSystem'),st=val('partStatus');
    const rows=sortRows(db.parts.filter(p=>
      (!q||[p.name,p.partNo,p.system,p.vendor,p.notes,p.location,p.partType].join(' ').toLowerCase().includes(q))&&
      (!sys||(typeof systemRecordMatches==='function'?systemRecordMatches(p,sys,'parts'):p.system===sys))&&
      (!st||p.status===st)
    ));
    el.innerHTML=rows.map(p=>{
      const on=typeof partPhysicalOnHand==='function'?partPhysicalOnHand(p):(typeof partAvailable==='function'?partAvailable(p):p.stockQty);
      const r=typeof partReservedQty==='function'?partReservedQty(p.id):0;
      const free=typeof partFreeQty==='function'?partFreeQty(p):on;
      return `<tr class="click-row" onclick="openPartDetail(${p.id})">
        <td><div class="task-title">${esc(p.name)}</div><div class="task-note">${esc(p.description||p.notes||'')}</div></td>
        <td>${esc(p.partNo||'—')}</td>
        <td>${esc(p.system||'—')}</td>
        <td>${on===null||on===undefined?'—':esc(on+' '+(p.unit||''))}</td>
        <td>${esc(r+' '+(p.unit||''))}</td>
        <td class="${free!==null&&free!==undefined&&free<0?'stock-short':'stock-ok'}">${free===null||free===undefined?'—':esc(free+' '+(p.unit||''))}</td>
        <td>${pill(p.status)}</td>
        <td>${esc(p.vendor||'—')}</td>
        <td><button class="icon-btn" onclick="event.stopPropagation();openPartModal(${p.id})">Edit</button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="9" class="empty">No matching parts.</td></tr>';
  };

  const style=document.createElement('style');
  style.id='partSortStyle';
  style.textContent=`
    #page-parts th.part-sortable{padding:0}
    #page-parts th.part-sortable:hover{background:#eef5fb}
    #page-parts .part-sort-button{appearance:none;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:10px 12px;text-align:left;cursor:pointer;white-space:nowrap}
    #page-parts .part-sort-button span{font-size:.72em;margin-left:5px;opacity:.55}
  `;
  document.head.appendChild(style);
})();