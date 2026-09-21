// ---------- PARTS ----------
function partOnOrderQty(partId){
  return db.orders.filter(o=>o.partId===partId&&!o.inventoryApplied&&['Ordered','Backordered','Shipped'].includes(o.status)).reduce((sum,o)=>sum+(typeof orderRemainingQty==='function'?orderRemainingQty(o):num(o.qty)),0);
}
function openPartModal(id=null,projectId=null){
  const p=id?partById(id):{name:'',partNo:'',system:'',unit:'ea',stockQty:'',minQty:'',status:'On Hand',vendor:'',url:'',unitCost:'',location:'',purchaseDate:'',notes:'',linkedProjectIds:projectId?[projectId]:[]};
  openModal(`${modalHeader(id?'Edit Part':'Add Part')}<div class="form-grid">
    <div class="full"><label>Part / material name</label><input id="ptName" value="${esc(p.name)}"></div>
    ${field('Part number / specification','ptPN',p.partNo)}
    <div><label>System</label><select id="ptSystem">${systemOptions(p.system)}</select></div>
    ${field('Unit','ptUnit',p.unit||'ea')}${field('Quantity on hand','ptStock',p.stockQty,'number','step="any"')}
    ${field('Minimum / reorder qty','ptMin',p.minQty,'number','step="any"')}
    <div><label>Status</label><select id="ptStatus">${['On Hand','Installed','Verify','Need','Order','Backordered','Retired'].map(x=>`<option ${p.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
    ${field('Vendor / source','ptVendor',p.vendor)}${field('Unit price','ptCost',p.unitCost,'number','step="0.01" min="0"')}
    ${field('Purchase date','ptPurchase',p.purchaseDate,'date')}${field('Storage / installed location','ptLocation',p.location)}
    <div class="full"><label>Product / vendor URL</label><input id="ptUrl" value="${esc(p.url)}"></div>
    ${textareaField('Notes / specifications','ptNotes',p.notes)}
  </div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button>${id?`<button class="btn danger" onclick="deletePart(${id})">Delete</button>`:''}<button class="btn primary" onclick="savePart(${id||'null'},${projectId||'null'})">Save Part</button></div>`);
}
function savePart(id,projectId=null){const o={name:val('ptName'),partNo:val('ptPN'),system:val('ptSystem')||'General',unit:val('ptUnit')||'ea',stockQty:val('ptStock')===''?'':num(val('ptStock')),minQty:val('ptMin')===''?'':num(val('ptMin')),status:val('ptStatus'),vendor:val('ptVendor'),url:val('ptUrl'),unitCost:val('ptCost'),location:val('ptLocation'),purchaseDate:val('ptPurchase'),notes:val('ptNotes')};if(!o.name)return alert('Part name is required.');let pid=id;if(id)Object.assign(partById(id),o);else{pid=uid();db.parts.push({id:pid,...o,linkedProjectIds:projectId?[projectId]:[],updates:[]})}saveDB(id?'Part updated.':'Part added.');closeModal()}
function deletePart(id){if(!confirm('Delete this part record? Existing work-log and project references will keep their saved description, but the inventory link will be removed.'))return;db.parts=db.parts.filter(x=>x.id!==id);db.orders.forEach(o=>{if(o.partId===id)o.partId=null});db.projects.forEach(p=>p.partsUsed.forEach(x=>{if(x.partId===id)x.partId=null}));db.logs.forEach(l=>l.consumedParts.forEach(x=>{if(x.partId===id)x.partId=null}));db.docs.forEach(d=>{d.linkedPartIds=d.linkedPartIds.filter(x=>x!==id)});closeModal();saveDB('Part deleted.')}
function openPartDetail(id){
  const p=partById(id);if(!p)return;currentDetail={type:'part',id};
  const consumed=[];db.logs.forEach(l=>l.consumedParts.filter(x=>x.partId===id).forEach(x=>consumed.push({log:l,item:x})));
  const orders=db.orders.filter(o=>o.partId===id);
  const purchaseIds=new Set(arr(p.purchaseIds).map(String));
  const purchaseLinks=db.purchases.filter(x=>String(x.inventoryPartId||'')===String(p.id)||purchaseIds.has(String(x.id))||(p.partNo&&x.pn&&String(x.pn).toLowerCase()===String(p.partNo).toLowerCase())).sort((a,b)=>(b.shipDate||'').localeCompare(a.shipDate||''));
  const linkedProjects=unique([...p.linkedProjectIds,...db.projects.filter(pr=>pr.partsUsed.some(x=>x.partId===id)).map(pr=>pr.id)]).map(projectById).filter(Boolean);
  const docs=db.docs.filter(d=>d.linkedPartIds.includes(id));
  const available=partAvailable(p);
  const onOrder=partOnOrderQty(id);
  const componentPurchase=db.purchases.find(x=>String(x.inventoryPartId||'')===String(p.id)||arr(p.purchaseIds).some(pid=>String(pid)===String(x.id)))||null;
  const hasComponent=!!p.equipmentId||!!componentPurchase?.equipmentId||!!componentPurchase?.trackAsEquipment;
  openModal(`${modalHeader(p.name,p.partNo?`PN / Spec: ${p.partNo}`:p.system)}
    <div class="summary-strip"><div class="summary-cell"><div class="lab">Status</div><div class="val">${pill(p.status)}</div></div><div class="summary-cell"><div class="lab">On Hand</div><div class="val">${available===null?'—':esc(available+' '+(p.unit||''))}</div></div><div class="summary-cell"><div class="lab">On Order</div><div class="val">${esc(onOrder+' '+(p.unit||''))}</div></div><div class="summary-cell"><div class="lab">Used in logs</div><div class="val">${esc(partConsumedQty(id)+' '+(p.unit||''))}</div></div><div class="summary-cell"><div class="lab">Unit Price</div><div class="val">${db.settings.showCosts?fmtMoney(p.unitCost):'Hidden'}</div></div></div>
    <div class="detail-grid"><div>
      <div class="detail-card"><div class="section-tools"><h3>Part Record</h3><div class="action-row">${hasComponent?`<button class="icon-btn" onclick="openComponentView('part',${id})">Component View</button>`:''}<button class="icon-btn" onclick="openPartModal(${id})">Edit</button></div></div><div class="grid"><div class="span-6"><div class="kv"><span>System</span><b>${esc(p.system||'—')}</b></div><div class="kv"><span>Vendor</span><b>${esc(p.vendor||'—')}</b></div><div class="kv"><span>Location</span><b>${esc(p.location||'—')}</b></div></div><div class="span-6"><div class="kv"><span>Quantity recorded</span><b>${p.stockQty===''?'—':esc(p.stockQty+' '+(p.unit||''))}</b></div><div class="kv"><span>Reorder level</span><b>${p.minQty===''?'—':esc(p.minQty+' '+(p.unit||''))}</b></div><div class="kv"><span>Purchase date</span><b>${esc(p.purchaseDate||'—')}</b></div></div></div><div class="detail-section"><label>Notes / Specifications</label><div class="detail-text">${esc(p.notes||'No notes.')}</div></div>${isURL(p.url)?`<div class="action-row" style="margin-top:10px"><button class="btn secondary" onclick="window.open('${esc(p.url)}','_blank')">Open Product / Vendor Page</button></div>`:''}</div>
      <div class="detail-card"><div class="section-tools"><h3>Consumption / Installation History</h3><button class="icon-btn" onclick="openLogModal(null,null,${id})">+ Log Use</button></div>${consumed.length?`<div class="table-wrap"><table class="subtable"><thead><tr><th>Date</th><th>Work</th><th>Qty</th><th>Cost</th></tr></thead><tbody>${consumed.map(x=>`<tr class="click-row" onclick="openLogDetail(${x.log.id})"><td>${esc(x.log.date)}</td><td>${esc(x.log.work)}</td><td>${esc(x.item.qty)} ${esc(x.item.unit||p.unit||'')}</td><td>${db.settings.showCosts?fmtMoney(num(x.item.qty)*num(x.item.unitCost)):'Hidden'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No work-log consumption entries linked to this part.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Files / Receipts / Spec Sheets</h3><button class="icon-btn" onclick="chooseAttachments('part',${id})">+ Upload</button></div><div class="attach-drop" onclick="chooseAttachments('part',${id})" ondragover="event.preventDefault()" ondrop="handleEntityDrop(event,'part',${id})">Drop receipts, screenshots, spec sheets, photos or PDFs here</div><div id="attachments-part-${id}"></div></div>
    </div><div>
      <div class="detail-card"><div class="section-tools"><div><h3>Orders / Purchases</h3><div class="tiny muted">Original purchase sources plus tracker reorder records.</div></div><button class="icon-btn" onclick="openOrderModal(null,null,${id})">+ Order</button></div>
        ${purchaseLinks.length?`<div class="detail-section"><label>Purchase history</label>${purchaseLinks.map(x=>`<div class="kv click-row" onclick="openPurchaseDetail('${esc(x.id)}')"><div><b>${x.order?'Order '+esc(x.order):'Purchase'}${x.invoice?' • Invoice '+esc(x.invoice):''}</b><div class="task-note">${esc(x.vendor||x.seller||'Vendor')}${x.shipDate?' • '+esc(x.shipDate):''} • Qty ${esc(x.qty)} @ ${db.settings.showCosts?fmtMoney(x.unitPrice):'Hidden'}</div></div>${pill(x.disposition||'Purchase')}</div>`).join('')}</div>`:''}
        ${orders.length?`<div class="detail-section"><label>Tracker orders / reorders</label>${orders.map(o=>`<div class="kv click-row" onclick="openOrderDetail(${o.id})"><div><b>${esc(o.item)}</b><div class="task-note">${esc(o.vendor||'')} ${o.eta?'• ETA '+esc(o.eta):''}</div></div>${pill(o.status)}</div>`).join('')}</div>`:''}
        ${!purchaseLinks.length&&!orders.length?'<div class="muted">No purchase history or tracker orders linked.</div>':''}
      </div>
      <div class="detail-card"><div class="section-tools"><div><h3>Linked Projects</h3><div class="tiny muted">Choose which projects this part belongs to. Project-use records also create a relationship automatically.</div></div><button class="icon-btn" onclick="openPartProjectLinks(${id})">Edit Links</button></div>${linkedProjects.length?linkedProjects.map(pr=>`<div class="kv click-row" onclick="openProjectDetail(${pr.id})"><span>${esc(pr.title)}</span>${pill(pr.status)}</div>`).join(''):'<div class="muted">No projects linked.</div>'}</div>
      <div class="detail-card"><h3>Relevant Documents</h3>${docs.length?docs.map(d=>`<div class="kv click-row" onclick="openDocumentDetail(${d.id})"><span>${esc(d.name)}</span><span>${esc(d.type)}</span></div>`).join(''):'<div class="muted">No documents linked.</div>'}</div>
      <div class="detail-card"><div class="section-tools"><h3>Part Updates</h3><button class="icon-btn" onclick="addEntityUpdate('part',${id})">+ Update</button></div>${p.updates.length?`<div class="timeline">${[...p.updates].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(u=>`<div class="timeline-item"><div class="timeline-date">${esc(u.date)}</div><div class="timeline-body">${esc(u.text)}</div></div>`).join('')}</div>`:'<div class="muted">No updates.</div>'}</div>
    </div></div>`,true);renderAttachments('part',id)
}

function openPartProjectLinks(partId){
  const p=partById(Number(partId));if(!p)return;
  const selected=new Set(arr(p.linkedProjectIds).map(Number));
  const usageLinked=new Set(db.projects.filter(pr=>arr(pr.partsUsed).some(x=>Number(x.partId)===Number(p.id))).map(pr=>Number(pr.id)));
  const projects=[...db.projects].sort((a,b)=>{
    const aa=a.status==='Done'?1:0,bb=b.status==='Done'?1:0;
    return aa-bb||String(a.title||'').localeCompare(String(b.title||''),undefined,{numeric:true,sensitivity:'base'});
  });
  openModal(`${modalHeader('Link Part to Projects',p.name)}
    <div class="notice" style="margin-bottom:12px">These are organizational links only. Checking a project does not reserve or consume inventory. Projects that already record this part as used remain related through their work history even if you remove the manual link.</div>
    <div class="project-link-picker">${projects.map(pr=>`<label class="project-link-option"><input type="checkbox" value="${pr.id}" ${selected.has(Number(pr.id))?'checked':''}><span><b>${esc(pr.title)}</b><small>${esc(pr.system||'General')} • ${esc(pr.status||'')}${usageLinked.has(Number(pr.id))?' • linked by part use':''}</small></span></label>`).join('')||'<div class="empty">No projects exist yet.</div>'}</div>
    <div class="modal-actions"><button class="secondary" onclick="openPartDetail(${p.id})">Cancel</button><button class="primary" onclick="savePartProjectLinks(${p.id})">Save Project Links</button></div>`,true);
}
function savePartProjectLinks(partId){
  const p=partById(Number(partId));if(!p)return;
  p.linkedProjectIds=[...document.querySelectorAll('.project-link-picker input:checked')].map(x=>Number(x.value)).filter(Boolean);
  saveDB('Part project links updated.');
  openPartDetail(p.id);
}

if(!document.getElementById('partProjectLinkStyle')){
  const s=document.createElement('style');s.id='partProjectLinkStyle';s.textContent=`
    .project-link-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:55vh;overflow:auto}
    .project-link-option{display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;align-items:start;border:1px solid #dce6ed;border-radius:9px;padding:10px;background:#fff;cursor:pointer;text-transform:none;letter-spacing:0}
    .project-link-option:hover{background:#f8fbfd}.project-link-option input{width:auto;margin-top:3px}.project-link-option b{display:block;font-size:12px}.project-link-option small{display:block;margin-top:3px;color:var(--muted);font-size:10px;line-height:1.3}
    @media(max-width:700px){.project-link-picker{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}
