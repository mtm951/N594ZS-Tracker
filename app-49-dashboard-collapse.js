// ---------- V5.9.5 DASHBOARD SECTION LAYOUT ----------
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
  let draggedSection='';

  function collapsedKeys(){
    db.settings.dashboardCollapsedSections=arr(db.settings.dashboardCollapsedSections).filter(key=>sectionKeys.has(key));
    return new Set(db.settings.dashboardCollapsedSections);
  }

  function orderedKeys(){
    const saved=arr(db.settings.dashboardSectionOrder).filter((key,index,list)=>sectionKeys.has(key)&&list.indexOf(key)===index);
    sections.forEach(([key])=>{if(!saved.includes(key))saved.push(key)});
    db.settings.dashboardSectionOrder=saved;
    return saved;
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
      let controls=head.querySelector('.dashboard-section-controls');
      if(!controls){
        controls=document.createElement('div');
        controls.className='dashboard-section-controls';
        const handle=document.createElement('button');
        handle.type='button';handle.className='dashboard-drag-handle';handle.draggable=true;handle.textContent='⋮⋮';
        handle.title=`Drag to rearrange ${title}`;handle.setAttribute('aria-label',`Drag to rearrange ${title}`);
        handle.addEventListener('dragstart',event=>startDashboardSectionDrag(event,key));
        handle.addEventListener('dragend',endDashboardSectionDrag);
        controls.appendChild(handle);
        const earlier=document.createElement('button');
        earlier.type='button';earlier.className='dashboard-move-button';earlier.textContent='↑';earlier.title='Move earlier';earlier.setAttribute('aria-label',`Move ${title} earlier`);
        earlier.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();moveDashboardSection(key,-1)});
        controls.appendChild(earlier);
        const later=document.createElement('button');
        later.type='button';later.className='dashboard-move-button';later.textContent='↓';later.title='Move later';later.setAttribute('aria-label',`Move ${title} later`);
        later.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();moveDashboardSection(key,1)});
        controls.appendChild(later);
        const button=document.createElement('button');
        button.type='button';
        button.className='dashboard-collapse-toggle';
        button.dataset.dashboardToggle=key;
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleDashboardSection(key)});
        controls.appendChild(button);
        head.appendChild(controls);
      }
      const button=controls.querySelector('.dashboard-collapse-toggle');
      const isClosed=closed.has(key);
      card.classList.toggle('dashboard-section-collapsed',isClosed);
      button.textContent=isClosed?'Expand':'Collapse';
      button.setAttribute('aria-expanded',String(!isClosed));
      button.setAttribute('aria-label',`${isClosed?'Expand':'Collapse'} ${title}`);
      card.addEventListener('dragover',event=>{event.preventDefault();card.classList.add('dashboard-drag-target')});
      card.addEventListener('dragleave',()=>card.classList.remove('dashboard-drag-target'));
      card.addEventListener('drop',event=>dropDashboardSection(event,key));
    });
    const order=orderedKeys(),cards=new Map([...document.querySelectorAll('#page-dashboard [data-dashboard-section]')].map(card=>[card.dataset.dashboardSection,card]));
    const parent=cards.values().next().value?.parentElement;
    if(parent)order.forEach(key=>{const card=cards.get(key);if(card)parent.appendChild(card)});
  }

  window.toggleDashboardSection=function(key){
    if(!sectionKeys.has(key))return;
    const closed=collapsedKeys();
    if(closed.has(key))closed.delete(key);else closed.add(key);
    db.settings.dashboardCollapsedSections=[...closed];
    saveDB();
  };

  function saveDashboardOrder(order){db.settings.dashboardSectionOrder=order;saveDB()}
  window.moveDashboardSection=function(key,delta){
    const order=orderedKeys(),from=order.indexOf(key),to=Math.max(0,Math.min(order.length-1,from+Number(delta||0)));
    if(from<0||from===to)return;
    const [item]=order.splice(from,1);order.splice(to,0,item);saveDashboardOrder(order);
  };
  window.startDashboardSectionDrag=function(event,key){draggedSection=key;event.dataTransfer?.setData('text/plain',key);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';event.target.closest('.dashboard-section-card')?.classList.add('dashboard-dragging')};
  window.dropDashboardSection=function(event,target){
    event.preventDefault();const source=draggedSection||event.dataTransfer?.getData('text/plain');
    document.querySelectorAll('.dashboard-section-card').forEach(card=>card.classList.remove('dashboard-dragging','dashboard-drag-target'));
    if(!source||source===target)return;
    const order=orderedKeys(),from=order.indexOf(source),to=order.indexOf(target);if(from<0||to<0)return;
    const [item]=order.splice(from,1);order.splice(to,0,item);draggedSection='';saveDashboardOrder(order);
  };
  window.endDashboardSectionDrag=function(){draggedSection='';document.querySelectorAll('.dashboard-section-card').forEach(card=>card.classList.remove('dashboard-dragging','dashboard-drag-target'))};

  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const result=baseRenderDashboard();applyDashboardSectionCollapse();return result};

  const style=document.createElement('style');
  style.id='dashboardCollapseStyle';
  style.textContent=`
    #page-dashboard .dashboard-section-card{align-self:start;transition:padding .16s ease,box-shadow .16s ease}
    #page-dashboard .dashboard-section-controls{display:flex;align-items:center;gap:5px;margin-left:auto}
    #page-dashboard .dashboard-collapse-toggle,#page-dashboard .dashboard-move-button,#page-dashboard .dashboard-drag-handle{border:1px solid #c9d9e5;background:#fff;color:#23445f;border-radius:999px;height:29px;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap}
    #page-dashboard .dashboard-collapse-toggle{padding:5px 10px}
    #page-dashboard .dashboard-move-button,#page-dashboard .dashboard-drag-handle{width:29px;padding:0}
    #page-dashboard .dashboard-drag-handle{cursor:grab;letter-spacing:-2px}
    #page-dashboard .dashboard-drag-handle:active{cursor:grabbing}
    #page-dashboard .dashboard-collapse-toggle:hover,#page-dashboard .dashboard-move-button:hover,#page-dashboard .dashboard-drag-handle:hover{background:#eef7fd}
    #page-dashboard .dashboard-collapse-toggle::before{content:'▴  '}
    #page-dashboard .dashboard-dragging{opacity:.45}
    #page-dashboard .dashboard-drag-target{border-color:var(--blue);box-shadow:0 0 0 3px rgba(45,127,209,.18)}
    #page-dashboard .dashboard-section-collapsed{padding-top:11px;padding-bottom:11px}
    #page-dashboard .dashboard-section-collapsed>.section-head{margin-bottom:0}
    #page-dashboard .dashboard-section-collapsed>:not(.section-head){display:none!important}
    #page-dashboard .dashboard-section-collapsed .dashboard-collapse-toggle::before{content:'▾  '}
    @media(max-width:760px){#page-dashboard .section-head{align-items:flex-start;flex-wrap:wrap}#page-dashboard .dashboard-section-controls{width:100%;margin-left:0}#page-dashboard .dashboard-collapse-toggle{padding:5px 9px}}
  `;
  document.head.appendChild(style);
})();
