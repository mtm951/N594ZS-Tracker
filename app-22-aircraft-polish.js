// ---------- V4.1 AIRCRAFT WORKFLOW POLISH ----------

// Show workflow phase and in-project checklist progress directly in the project table.
const renderProjectRowsAircraftBase=renderProjectRows;
renderProjectRows=function(){
  renderProjectRowsAircraftBase();
  const body=document.getElementById('projectRows');if(!body)return;
  body.querySelectorAll('tr.click-row').forEach(row=>{
    const m=/openProjectDetail\((\d+)\)/.exec(row.getAttribute('onclick')||'');if(!m)return;const p=projectById(Number(m[1]));if(!p)return;
    const first=row.querySelector('td');if(!first)return;let meta=first.querySelector('.task-meta');if(!meta){meta=document.createElement('div');meta.className='task-meta';first.appendChild(meta)}
    const steps=projectSteps(p),done=steps.filter(x=>x.done).length;
    meta.insertAdjacentHTML('beforeend',`<span class="mini-badge">${esc(phaseShort(p.phase))}</span>${p.focusToday?'<span class="mini-badge good">Focus today</span>':''}${steps.length?`<span class="mini-badge">Steps ${done}/${steps.length}</span>`:''}`);
  });
};

// Put the new workflow actions on the existing dashboard quick-actions card.
const renderDashboardAircraftPolishBase=renderDashboard;
renderDashboard=function(){
  renderDashboardAircraftPolishBase();
  const quick=document.querySelector('#page-dashboard .quick-grid');if(quick){quick.insertAdjacentHTML('beforeend','<button class="quick" onclick="openSquawkModal()"><span class="qicon">⚠️</span>New Squawk</button><button class="quick" onclick="openRunModal()"><span class="qicon">🧪</span>Log Run/Test</button>')}
};

// Clean up the global-search empty state/count when squawks or run/test records are the only matches.
const renderSearchPageAircraftPolishBase=renderSearchPage;
renderSearchPage=async function(q=''){
  await renderSearchPageAircraftPolishBase(q);
  const page=document.getElementById('page-search'),box=page?.querySelector('.search-results');if(!box)return;
  const results=[...box.querySelectorAll('.search-result')];if(results.length)box.querySelectorAll('.empty').forEach(x=>x.remove());
  const sub=page.querySelector('.toolbar .muted');const term=(q||document.getElementById('globalSearchInput')?.value||'').trim();if(sub&&term)sub.textContent=`${results.length} result${results.length===1?'':'s'} for “${term}”`;
};
