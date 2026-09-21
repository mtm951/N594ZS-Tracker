'use strict';
// ---------- V5.10.11 WORK LOG SEARCH / SORT ----------

(function(){
  if(window.__n594zsWorkLogSortInstalled)return;
  window.__n594zsWorkLogSortInstalled=true;

  let logSort=(()=>{
    try{
      const saved=JSON.parse(sessionStorage.getItem('n594zs_log_sort')||'null');
      if(saved&&saved.key&&['asc','desc'].includes(saved.dir))return saved;
    }catch(_e){}
    return {key:'date',dir:'desc'};
  })();

  function saveLogSort(){
    try{sessionStorage.setItem('n594zs_log_sort',JSON.stringify(logSort))}catch(_e){}
  }

  function logSortHead(label,key){
    const active=logSort.key===key;
    return `<th class="log-sortable" aria-sort="${active?(logSort.dir==='asc'?'ascending':'descending'):'none'}"><button class="log-sort-button" onclick="setLogSort('${key}')" title="Sort by ${esc(label)}">${esc(label)} <span>${active?(logSort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>`;
  }

  window.setLogSort=function(key){
    if(logSort.key===key)logSort.dir=logSort.dir==='asc'?'desc':'asc';
    else{
      const descFirst=new Set(['date','labor','cost']);
      logSort={key,dir:descFirst.has(key)?'desc':'asc'};
    }
    saveLogSort();
    renderLogRows();
  };

  function sortValue(l,key){
    if(key==='date')return l.date||'';
    if(key==='system')return l.system||'';
    if(key==='work')return l.work||'';
    if(key==='projects')return l.projectIds.map(projectName).join(' • ');
    if(key==='labor')return l.laborHours===''||l.laborHours===null||l.laborHours===undefined?null:num(l.laborHours);
    if(key==='cost')return num(consumedCost(l));
    if(key==='followup')return l.blockers||l.nextStep||'';
    return '';
  }

  function sortRows(rows){
    const key=logSort.key,dir=logSort.dir==='desc'?-1:1;
    const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
    return rows.sort((a,b)=>{
      const av=sortValue(a,key),bv=sortValue(b,key);
      const aBlank=av===null||av===undefined||av==='',bBlank=bv===null||bv===undefined||bv==='';
      if(aBlank!==bBlank)return aBlank?1:-1;
      let cmp=0;
      if(typeof av==='number'&&typeof bv==='number')cmp=av-bv;
      else cmp=collator.compare(String(av),String(bv));
      return cmp*dir||collator.compare(String(b.date||''),String(a.date||''))||num(a.id)-num(b.id);
    });
  }

  function logSystemFilterOptions(){
    const names=(typeof window.systemNames==='function'
      ?window.systemNames()
      :unique(db.logs.map(x=>x.system).filter(Boolean)).sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})));
    const unassigned=db.logs.some(x=>!String(x.system||'').trim());
    return '<option value="">All systems</option>'+
      names.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')+
      (unassigned?'<option value="__unassigned__">Unassigned</option>':'');
  }

  window.renderLogbook=function(){
    const linkedProjects=unique(db.logs.flatMap(l=>l.projectIds).map(projectName).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
    document.getElementById('page-logbook').innerHTML=`<div class="card">
      <div class="toolbar"><div><h1>Work Log</h1><div class="muted">Search the full work record, filter by system or project, and click any column heading to sort.</div></div><button class="btn primary" onclick="openLogModal()">+ Add Work Entry</button></div>
      <div class="controls">
        <input id="logSearch" placeholder="Search work, parts, projects, notes, blockers…" oninput="renderLogRows()">
        <select id="logSystem" onchange="renderLogRows()">${logSystemFilterOptions()}</select>
        <select id="logProject" onchange="renderLogRows()"><option value="">All projects</option>${linkedProjects.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
      </div>
      <div class="table-wrap" style="margin-top:11px"><table><thead><tr>
        ${logSortHead('Date','date')}
        ${logSortHead('System','system')}
        ${logSortHead('Work performed','work')}
        ${logSortHead('Project(s)','projects')}
        ${logSortHead('Labor','labor')}
        ${logSortHead('Consumed cost','cost')}
        ${logSortHead('Blocker / next step','followup')}
        <th></th>
      </tr></thead><tbody id="logRows"></tbody></table></div>
    </div>`;
    renderLogRows();
  };

  window.renderLogRows=function(){
    const el=document.getElementById('logRows');if(!el)return;
    const q=(val('logSearch')||'').toLowerCase(),sys=val('logSystem'),project=val('logProject');
    const rows=sortRows([...db.logs].filter(l=>{
      const projectNames=l.projectIds.map(projectName);
      const hay=[
        l.date,l.system,l.work,l.observations,l.blockers,l.nextStep,l.notes,l.laborHours,
        l.airframeHours,l.engineHours,...projectNames,...l.consumedParts.flatMap(p=>[p.name,p.notes,p.qty,p.unit])
      ].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&
        (!sys||(typeof systemRecordMatches==='function'?systemRecordMatches(l,sys,'logs'):(sys==='__unassigned__'?!String(l.system||'').trim():l.system===sys)))&&
        (!project||projectNames.includes(project));
    }));

    el.innerHTML=rows.map(l=>`<tr class="click-row" onclick="openLogDetail(${l.id})">
      <td>${esc(l.date)}</td>
      <td>${esc(l.system||'—')}</td>
      <td><b>${esc(l.work)}</b><div class="task-meta"><span class="mini-badge">${l.consumedParts.length} consumed items</span>${l.airframeHours?`<span class="mini-badge">AF ${esc(l.airframeHours)}</span>`:''}${l.engineHours?`<span class="mini-badge">ENG ${esc(l.engineHours)}</span>`:''}</div></td>
      <td>${l.projectIds.length?l.projectIds.map(id=>`<span class="tag">${esc(projectName(id))}</span>`).join(''):'—'}</td>
      <td>${esc(l.laborHours||'—')}</td>
      <td>${db.settings.showCosts?fmtMoney(consumedCost(l)):'Hidden'}</td>
      <td>${l.blockers?`<span class="red pill">Held up</span><div class="task-note">${esc(l.blockers)}</div>`:`<div class="task-note">Next: ${esc(l.nextStep||'—')}</div>`}</td>
      <td><button class="icon-btn" onclick="event.stopPropagation();openLogModal(${l.id})">Edit</button></td>
    </tr>`).join('')||'<tr><td colspan="8" class="empty">No matching work entries.</td></tr>';
  };

  const style=document.createElement('style');
  style.id='workLogSortStyle';
  style.textContent=`
    #page-logbook th.log-sortable{padding:0}
    #page-logbook th.log-sortable:hover{background:#eef5fb}
    #page-logbook .log-sort-button{appearance:none;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:10px 12px;text-align:left;cursor:pointer;white-space:nowrap}
    #page-logbook .log-sort-button span{font-size:.72em;margin-left:5px;opacity:.55}
  `;
  document.head.appendChild(style);
})();