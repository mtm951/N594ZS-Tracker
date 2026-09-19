// ---------- V5.9.4 DASHBOARD SECTION COLLAPSE ----------
(function(){
  if(window.__n594zsDashboardCollapseInstalled)return;
  window.__n594zsDashboardCollapseInstalled=true;

  const sections=[
    ['priorities','Current Project Priorities'],
    ['blockers','Blockers / Holds'],
    ['recent-work','Recent Work'],
    ['parts','Parts Inventory'],
    ['orders','Open Orders'],
    ['quick-actions','Quick Actions']
  ];
  const sectionKeys=new Set(sections.map(([key])=>key));

  function collapsedKeys(){
    db.settings.dashboardCollapsedSections=arr(db.settings.dashboardCollapsedSections).filter(key=>sectionKeys.has(key));
    return new Set(db.settings.dashboardCollapsedSections);
  }

  function sectionCard(title){
    return [...document.querySelectorAll('#page-dashboard .card')].find(card=>{
      const heading=card.querySelector(':scope > .section-head h2, :scope > h2');
      return heading&&heading.textContent.trim()===title;
    });
  }

  function ensureHeader(card){
    let head=card.querySelector(':scope > .section-head');
    if(head)return head;
    const heading=card.querySelector(':scope > h2');
    if(!heading)return null;
    head=document.createElement('div');
    head.className='section-head';
    card.insertBefore(head,heading);
    head.appendChild(heading);
    return head;
  }

  function applyDashboardSectionCollapse(){
    const closed=collapsedKeys();
    sections.forEach(([key,title])=>{
      const card=sectionCard(title);if(!card)return;
      card.classList.add('dashboard-section-card');
      card.dataset.dashboardSection=key;
      const head=ensureHeader(card);if(!head)return;
      let button=head.querySelector('.dashboard-collapse-toggle');
      if(!button){
        button=document.createElement('button');
        button.type='button';
        button.className='dashboard-collapse-toggle';
        button.dataset.dashboardToggle=key;
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleDashboardSection(key)});
        head.appendChild(button);
      }
      const isClosed=closed.has(key);
      card.classList.toggle('dashboard-section-collapsed',isClosed);
      button.textContent=isClosed?'Expand':'Collapse';
      button.setAttribute('aria-expanded',String(!isClosed));
      button.setAttribute('aria-label',`${isClosed?'Expand':'Collapse'} ${title}`);
    });
  }

  window.toggleDashboardSection=function(key){
    if(!sectionKeys.has(key))return;
    const closed=collapsedKeys();
    if(closed.has(key))closed.delete(key);else closed.add(key);
    db.settings.dashboardCollapsedSections=[...closed];
    saveDB();
  };

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const result=baseRenderDashboard();applyDashboardSectionCollapse();return result};

  const style=document.createElement('style');
  style.id='dashboardCollapseStyle';
  style.textContent=`
    #page-dashboard .dashboard-section-card{align-self:start;transition:padding .16s ease,box-shadow .16s ease}
    #page-dashboard .dashboard-collapse-toggle{border:1px solid #c9d9e5;background:#fff;color:#23445f;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap;margin-left:auto}
    #page-dashboard .dashboard-collapse-toggle:hover{background:#eef7fd}
    #page-dashboard .dashboard-collapse-toggle::before{content:'▴  '}
    #page-dashboard .dashboard-section-collapsed{padding-top:11px;padding-bottom:11px}
    #page-dashboard .dashboard-section-collapsed>.section-head{margin-bottom:0}
    #page-dashboard .dashboard-section-collapsed>:not(.section-head){display:none!important}
    #page-dashboard .dashboard-section-collapsed .dashboard-collapse-toggle::before{content:'▾  '}
    @media(max-width:760px){#page-dashboard .dashboard-collapse-toggle{padding:6px 9px}}
  `;
  document.head.appendChild(style);
})();
