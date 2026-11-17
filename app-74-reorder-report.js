'use strict';
// v5.19.81 Reorder Report. Read-only stock calculations; Orders are created only in the existing Order editor.
(function(){
  if(window.N594ZSReorderReport)return;
  const A=x=>Array.isArray(x)?x:[];
  const S=x=>String(x==null?'':x);
  const E=x=>S(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const N=x=>Number.isFinite(Number(x))?Number(x):0;
  const dec=x=>Number(Math.max(0,x).toFixed(5));
  const fmt=x=>Number.isFinite(x)?String(Number(x.toFixed(5))):'—';
  const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(x);
  const vendor=p=>S(p.vendor).trim()||'Unassigned vendor';
  const minimum=p=>{
    if(p.minQty===undefined||p.minQty===null||S(p.minQty).trim()==='')return null;
    const n=Number(p.minQty);return Number.isFinite(n)&&n>=0?n:null;
  };
  const aliases=p=>A(p.alternatePartNos).map(S).filter(Boolean);
  function incomingFor(id,orders){
    return dec(A(orders).filter(o=>S(o.partId)===S(id)&&['Ordered','Backordered','Shipped'].includes(o.status)&&o.inventoryApplied!==true)
      .reduce((sum,o)=>{
        const used=o.receivedQty!==undefined&&o.receivedQty!==''?N(o.receivedQty):
          o.inventoryAppliedQty!==undefined&&o.inventoryAppliedQty!==''?N(o.inventoryAppliedQty):0;
        return sum+Math.max(0,N(o.qty)-Math.max(0,used));
      },0));
  }
  function onHandFallback(p,data){
    const adjustments=A(p.inventoryAdjustments).reduce((v,x)=>v+N(x.delta),0);
    const baseline=p.stockQty!==undefined&&p.stockQty!==null&&S(p.stockQty).trim()!=='';
    if(!baseline&&!adjustments)return null;
    const used=A(data.logs).reduce((sum,l)=>sum+A(l.consumedParts)
      .filter(x=>S(x.partId)===S(p.id)).reduce((total,x)=>total+N(x.qty),0),0);
    return N(p.stockQty)+adjustments-used;
  }
  function reservedFallback(p,data){
    return A(data.projects).filter(x=>x.status!=='Done').reduce((sum,x)=>
      sum+A(x.plannedParts).filter(item=>S(item.partId)===S(p.id))
        .reduce((total,item)=>total+N(item.qty),0),0);
  }
  function collect(data,helpers){
    const source=data||{},m=helpers||{};
    return A(source.parts).map(p=>{
      const rawOn=m.onHand?m.onHand(p):onHandFallback(p,source);
      const onHand=rawOn===null||rawOn===undefined||rawOn===''?null:Number(rawOn);
      const reserved=N(m.reserved?m.reserved(p):reservedFallback(p,source));
      const free=onHand===null||!Number.isFinite(onHand)?null:onHand-reserved;
      const min=minimum(p),incoming=incomingFor(p.id,source.orders);
      const below=min!==null&&free!==null&&free<min-0.000001;
      const shortfall=below?dec(min-free):0,need=below?dec(shortfall-incoming):0;
      const priced=p.unitCost!==undefined&&p.unitCost!==null&&S(p.unitCost).trim()!==''&&
        Number.isFinite(Number(p.unitCost))&&Number(p.unitCost)>=0;
      const orders=A(source.orders).filter(o=>S(o.partId)===S(p.id)&&
        ['Ordered','Backordered','Shipped'].includes(o.status)&&o.inventoryApplied!==true&&
        Math.max(0,N(o.qty)-N(o.receivedQty??o.inventoryAppliedQty??0))>0).map(o=>o.id);
      return {id:p.id,name:S(p.name||'Unnamed part'),partNo:S(p.partNo||''),alternatePartNos:aliases(p),
        vendor:vendor(p),system:S(p.system||'General'),unit:S(p.unit||'ea'),description:S(p.description||''),
        location:S(p.location||''),onHand,reserved,free,minimum:min,incoming,shortfall,need,
        below,covered:below&&need===0,orders,priced,unitCost:priced?Number(p.unitCost):null,
        status:free===null?'Count not recorded':min===null?'No minimum set':!below?'Above minimum':
          need===0?'Covered by incoming':incoming>0?'Partly covered':'Needs reorder'};
    });
  }
  function filter(rows,options){
    const o=options||{},v=S(o.vendor||'all').trim().toLowerCase(),mode=o.mode||'below',q=S(o.search).toLowerCase().trim();
    return A(rows).filter(r=>(v==='all'||r.vendor.toLowerCase()===v)&&
      (mode==='all'||(mode==='needs'?r.need>0:r.below))&&
      (!q||[r.name,r.partNo,...r.alternatePartNos,r.vendor,r.system,r.description,r.location]
        .join(' ').toLowerCase().includes(q)))
      .sort((a,b)=>a.vendor.localeCompare(b.vendor)||Number(b.need>0)-Number(a.need>0)||
        Number(b.below)-Number(a.below)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  }
  const active=()=>collect(db,{
    onHand:p=>typeof partAvailable==='function'?partAvailable(p):onHandFallback(p,db),
    reserved:p=>typeof partReservedQty==='function'?partReservedQty(p.id):reservedFallback(p,db)
  });
  const views={ops:{edits:new Map()},parts:{edits:new Map(),shown:false}};
  const panelId=v=>v==='parts'?'reorderReportParts':'reorderReportOps';
  const panel=v=>document.getElementById(panelId(v));
  const count=(x,r)=>x===null?'—':fmt(x)+' '+r.unit;
  const quantity=(r,v)=>views[v].edits.has(S(r.id))?S(views[v].edits.get(S(r.id))):fmt(r.need);
  const options=p=>({vendor:p.querySelector('[data-rr-vendor]')?.value||'all',
    mode:p.querySelector('[data-rr-mode]')?.value||'below',search:p.querySelector('[data-rr-search]')?.value||''});
  const groups=rows=>{
    const map=new Map();for(const r of rows){if(!map.has(r.vendor))map.set(r.vendor,[]);map.get(r.vendor).push(r);}
    return [...map.entries()];
  };
  function header(view){
    const vendors=[...new Set(A(db.parts).map(vendor))].sort((a,b)=>a.localeCompare(b));
    return '<div class="rr-header"><div><div class="ops-eyebrow">INVENTORY · SHOPPING LIST</div>'+
      '<h2>Reorder Report</h2><p class="muted">Review stock shortages, shop by vendor, and prepare individual orders.</p></div>'+
      '<div class="rr-buttons"><button type="button" class="secondary" data-rr-action="csv">Export CSV</button>'+
      '<button type="button" class="secondary" data-rr-action="print">Print / Save PDF</button>'+
      (view==='parts'?'<button type="button" class="secondary" data-rr-action="close">Close</button>':'')+
      '</div></div>'+
      '<div class="rr-filters"><label>Vendor<select data-rr-vendor><option value="all">All vendors</option>'+
      vendors.map(v=>'<option value="'+E(v)+'">'+E(v)+'</option>').join('')+'</select></label>'+
      '<label>View<select data-rr-mode><option value="below">Below reorder minimum</option>'+
      '<option value="needs">Still needs ordering</option><option value="all">All vendor items</option></select></label>'+
      '<label>Search<input type="search" data-rr-search placeholder="Part, primary or alternate PN…"></label>'+
      '<button type="button" class="secondary" data-rr-action="reset">Reset quantities</button></div>'+
      '<p class="rr-help">A part is below its minimum when <b>Free (on hand minus reservations)</b> is less than its saved minimum. '+
      '<b>Existing unreceived orders</b> reduce the suggested purchase amount, but do not increase stock. '+
      'Parts without a known count or minimum are excluded from the default list. Select <b>All vendor items</b> to see add-ons.</p>'+
      '<div data-rr-results aria-live="polite"></div>';
  }
  function partHTML(r){
    return '<button class="linkbtn rr-part" type="button" data-rr-part="'+E(r.id)+'">'+E(r.name)+'</button>'+
      '<div class="rr-pn">'+E(r.partNo||'No primary PN')+(r.alternatePartNos.length?' · Alt: '+E(r.alternatePartNos.join(', ')):'')+'</div>'+
      '<div class="rr-status">'+E(r.status)+'</div>';
  }
  function qtyInput(r,v){
    return '<input type="number" min="0" step="any" inputmode="decimal" value="'+E(quantity(r,v))+
      '" data-rr-qty="'+E(r.id)+'" aria-label="Quantity to order for '+E(r.name)+'">';
  }
  function actions(r){
    return '<button type="button" class="primary" data-rr-order="'+E(r.id)+'">Draft order</button>'+
      (r.orders.length?' <button type="button" class="secondary" data-rr-existing="'+E(r.id)+'">Incoming order</button>':'');
  }
  function deskRow(r,v){
    return '<tr><td>'+partHTML(r)+'</td><td>'+E(r.system)+'</td>'+
      '<td>'+E(count(r.onHand,r))+'</td><td>'+E(count(r.reserved,r))+'</td>'+
      '<td>'+E(count(r.free,r))+'</td><td>'+E(count(r.minimum,r))+'</td>'+
      '<td>'+E(count(r.incoming,r))+'</td><td><div class="rr-orderqty">'+qtyInput(r,v)+' '+E(r.unit)+'</div></td>'+
      '<td class="rr-actions-cell">'+actions(r)+'<small>'+
      E(r.priced?'Recorded unit cost '+money(r.unitCost):'No recorded unit cost')+'</small></td></tr>';
  }
  function mobileRow(r,v){
    return '<article class="rr-card">'+partHTML(r)+
      '<div class="rr-card-system">'+E(r.system)+' · '+E(r.vendor)+'</div>'+
      '<div class="rr-metrics">'+
      [['On hand',count(r.onHand,r)],['Reserved',count(r.reserved,r)],['Free',count(r.free,r)],
       ['Reorder min',count(r.minimum,r)],['On order',count(r.incoming,r)],['Suggested',count(r.need,r)]]
        .map(x=>'<div><small>'+E(x[0])+'</small><b>'+E(x[1])+'</b></div>').join('')+
      '</div><div class="rr-card-bottom"><label>Quantity to order '+qtyInput(r,v)+'</label>'+
      '<div>'+actions(r)+'</div></div>'+
      '<small class="rr-cost">'+E(r.priced?'Recorded unit cost '+money(r.unitCost):'No recorded unit cost')+
      '</small></article>';
  }
  function results(rows,v,o){
    const all=filter(active(),{vendor:o.vendor,search:o.search,mode:'all'});
    const low=all.filter(r=>r.below),needs=all.filter(r=>r.need>0),covered=low.filter(r=>r.covered);
    const estimate=needs.reduce((sum,r)=>sum+(r.priced?r.unitCost*r.need:0),0);
    const unpriced=needs.filter(r=>!r.priced).length;
    const summary='<div class="rr-summary">'+
      [['Below minimum',low.length],['Still to order',needs.length],['Covered by incoming',covered.length],['Showing',rows.length]]
        .map(x=>'<div><span>'+E(x[0])+'</span><b>'+x[1]+'</b></div>').join('')+
      '</div><div class="rr-summary-note">Estimated replenishment at recorded unit costs: '+E(money(estimate))+
      (unpriced?' · '+unpriced+' unpriced item(s)':'')+
      '. Not a supplier quote. Suggested quantities are editable and do not change inventory.</div>';
    if(!rows.length)return summary+'<div class="empty rr-empty">No matching parts. Set a Minimum / reorder qty in Parts → Edit, or select a vendor and All vendor items.</div>';
    return summary+groups(rows).map(([vName,items])=>
      '<section class="rr-supplier"><h3>'+E(vName)+' <small>'+items.length+' items</small></h3>'+
      '<div class="table-wrap rr-desktop"><table><thead><tr><th>Part / PN</th><th>System</th>'+
      '<th>On hand</th><th>Reserved</th><th>Free</th><th>Minimum</th><th>On order</th>'+
      '<th>Order qty</th><th>Actions</th></tr></thead><tbody>'+items.map(r=>deskRow(r,v)).join('')+
      '</tbody></table></div><div class="rr-mobile">'+items.map(r=>mobileRow(r,v)).join('')+
      '</div></section>').join('');
  }
  function refresh(v){
    const p=panel(v);if(!p)return;
    const o=options(p),rows=filter(active(),o),box=p.querySelector('[data-rr-results]');
    if(box)box.innerHTML=results(rows,v,o);
  }
  function draft(v,id){
    const p=panel(v),part=A(db.parts).find(x=>S(x.id)===S(id));
    if(!p||!part)return alert('Part not found. Reopen the report.');
    if(typeof canCloudEdit==='function'&&!canCloudEdit())return alert('Viewer access is read-only.');
    const q=Number(p.querySelector('[data-rr-qty="'+id+'"]')?.value);
    if(!Number.isFinite(q)||q<=0)return alert('Enter a positive quantity to order first.');
    const row=active().find(r=>S(r.id)===S(id));
    if(row?.covered&&!confirm('An existing order already covers the reorder minimum. Create another order anyway?'))return;
    if(typeof openOrderModal!=='function')return alert('The Order editor is unavailable.');
    // This opens a draft; user reviews/saves it. No automatic receipt or stock write.
    openOrderModal(null,null,Number(id));
    const qty=document.getElementById('orQty');if(qty)qty.value=fmt(q);
    const status=document.getElementById('orStatus');if(status)status.value='Need to Order';
    const notes=document.getElementById('orNotes');
    if(notes&&!notes.value)notes.value='Prepared from Reorder Report. Verify quantity, current price and vendor before purchasing.';
  }
  function incoming(id){
    const r=active().find(x=>S(x.id)===S(id));
    if(!r?.orders.length)return alert('No open linked order found.');
    if(typeof openOrderDetail==='function')return openOrderDetail(Number(r.orders[0]));
    if(typeof navTo==='function')navTo('orders');
  }
  function report(v){
    const p=panel(v);if(!p)return null;
    const o=options(p),rows=filter(active(),o).map(r=>({...r,orderQty:Number(quantity(r,v))||0}));
    return {options:o,rows};
  }
  const csvCell=x=>'"'+S(x).replace(/"/g,'""')+'"';
  function csvText(data){
    const header=['Vendor','Part','Primary PN','Alternate PNs','System','Unit','On hand','Reserved',
      'Free','Reorder minimum','On order','Suggested qty','Quantity to order','Status','Recorded unit cost'];
    const rows=A(data?.rows).map(r=>[r.vendor,r.name,r.partNo,r.alternatePartNos.join('; '),r.system,r.unit,
      r.onHand??'',r.reserved,r.free??'',r.minimum??'',r.incoming,r.need,r.orderQty,r.status,r.priced?r.unitCost:'']);
    return [header,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  function printMarkup(data){
    const o=data.options,rows=data.rows;
    const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
    const tables=groups(rows).map(([supplier,items])=>
      '<section><h2>'+E(supplier)+' · '+items.length+' items</h2>'+
      '<table><thead><tr><th>Part / PN</th><th>Unit</th><th>On hand</th><th>Reserved</th>'+
      '<th>Free</th><th>Min</th><th>On order</th><th>Order qty</th><th>Status</th></tr></thead><tbody>'+
      items.map(r=>'<tr><td><b>'+E(r.name)+'</b><small>'+E(r.partNo)+
        (r.alternatePartNos.length?' · Alt '+E(r.alternatePartNos.join(', ')):'')+'</small></td>'+
        '<td>'+E(r.unit)+'</td><td>'+E(r.onHand===null?'—':fmt(r.onHand))+'</td>'+
        '<td>'+E(fmt(r.reserved))+'</td><td>'+E(r.free===null?'—':fmt(r.free))+'</td>'+
        '<td>'+E(r.minimum===null?'—':fmt(r.minimum))+'</td><td>'+E(fmt(r.incoming))+'</td>'+
        '<td><b>'+E(r.orderQty>0?fmt(r.orderQty):'—')+'</b></td><td>'+E(r.status)+'</td></tr>').join('')+
      '</tbody></table></section>').join('')||'<p>No matching parts.</p>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>N594ZS Reorder Report</title>'+
      '<style>@page{size:letter landscape;margin:.45in}body{font:10pt Arial,sans-serif;color:#1b3246}'+
      'h1{font-size:19pt}h2{font-size:12pt;margin:17pt 0 7pt}p,footer{color:#5f7485;font-size:9pt}'+
      'table{border-collapse:collapse;width:100%;font-size:8pt}td,th{border:1px solid #cedbe5;padding:5pt;text-align:left}'+
      'th{background:#eff4f7}td small{display:block;font-size:7pt;color:#627b8f}tr{break-inside:avoid}'+
      '</style></head><body><h1>N594ZS · Reorder Report</h1><p>Prepared '+E(date)+' · Vendor: '+
      E(o.vendor==='all'?'All vendors':o.vendor)+' · '+E(o.mode==='below'?'Below minimum':o.mode==='needs'?'Needs ordering':'All vendor items')+
      (o.search?' · Search: '+E(o.search):'')+' · '+rows.length+' items</p>'+
      tables+'<footer>Free = calculated on hand − reservations. Open incoming orders are not stock. '+
      'Quantities are shopping suggestions, not placed orders. Verify stock, part suitability, supplier prices and shipping before ordering.</footer></body></html>';
  }
  function download(v){
    const data=report(v);if(!data)return;
    const url=URL.createObjectURL(new Blob([csvText(data)],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='N594ZS-reorder-report.csv';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function print(v){
    const data=report(v);if(!data)return;
    const popup=window.open('','_blank');
    if(!popup)return alert('Allow pop-ups to print or save the report as a PDF.');
    popup.document.open();popup.document.write(printMarkup(data));popup.document.close();
    popup.addEventListener('load',()=>setTimeout(()=>{popup.focus();popup.print()},200));
  }
  function bind(p,v){
    p.addEventListener('change',event=>{
      if(event.target.matches('[data-rr-mode],[data-rr-vendor]'))refresh(v);
    });
    p.addEventListener('input',event=>{
      if(event.target.matches('[data-rr-search]'))refresh(v);
      if(event.target.matches('[data-rr-qty]')){
        const id=event.target.getAttribute('data-rr-qty');
        views[v].edits.set(S(id),event.target.value);
        p.querySelectorAll('[data-rr-qty]').forEach(other=>{
          if(other!==event.target&&other.getAttribute('data-rr-qty')===id)other.value=event.target.value;
        });
      }
    });
    p.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b||!p.contains(b))return;
      const id=b.getAttribute('data-rr-part');if(id!==null)return openPartDetail(Number(id));
      const order=b.getAttribute('data-rr-order');if(order!==null)return draft(v,order);
      const received=b.getAttribute('data-rr-existing');if(received!==null)return incoming(received);
      const action=b.getAttribute('data-rr-action');
      if(action==='print')return print(v);
      if(action==='csv')return download(v);
      if(action==='reset'){views[v].edits.clear();return refresh(v)}
      if(action==='close')return closeParts();
    });
  }
  function mount(v){
    const host=document.getElementById(v==='parts'?'page-parts':'opsContent');
    if(!host||(v==='parts'&&!views.parts.shown)||panel(v))return;
    const p=document.createElement('section');
    p.id=panelId(v);p.className='ops-panel rr-report';p.innerHTML=header(v);
    host.insertBefore(p,host.firstChild);bind(p,v);refresh(v);
  }
  function openParts(){
    views.parts.shown=true;mount('parts');
    panel('parts')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  function closeParts(){views.parts.shown=false;panel('parts')?.remove()}
  const style=document.createElement('style');
  style.textContent=
    '.rr-report{margin-bottom:16px;background:#fff;min-width:0}.rr-header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}'+
    '.rr-header h2{margin:0 0 5px;font-size:21px}.rr-header p{font-size:12px}.rr-buttons{display:flex;gap:7px;flex-wrap:wrap}'+
    '.rr-filters{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:10px;align-items:end;margin:16px 0}'+
    '.rr-filters label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;min-width:0}'+
    '.rr-filters select,.rr-filters input{width:100%;min-width:0;min-height:40px;padding:8px}.rr-filters button{min-height:40px}'+
    '.rr-help{font-size:11px;line-height:1.6;color:#5d7587;background:#f4f8fc;padding:11px;border-radius:8px}'+
    '.rr-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}'+
    '.rr-summary>div{background:#f7fafc;border:1px solid #e0eaf1;border-radius:9px;padding:11px;min-width:0}'+
    '.rr-summary span,.rr-summary b{display:block}.rr-summary span{font-size:11px;color:#667f8f}'+
    '.rr-summary b{font-size:22px;font-variant-numeric:tabular-nums;margin-top:4px}'+
    '.rr-summary-note,.rr-cost{font-size:11px;color:#678294;line-height:1.5;margin-top:10px}'+
    '.rr-supplier{margin-top:20px}.rr-supplier h3{display:flex;justify-content:space-between;border-bottom:1px solid #e1e9f0;padding-bottom:8px;font-size:16px}'+
    '.rr-supplier h3 small{color:#637e92;font-size:11px}.rr-desktop table{min-width:1000px}'+
    '.rr-desktop td{font-size:11px;vertical-align:middle}.rr-desktop td:last-child{min-width:155px}'+
    '.rr-actions-cell button{font-size:10px;padding:7px;margin:2px}.rr-actions-cell small{display:block;color:#6d8391;font-size:10px}'+
    '.rr-orderqty{display:flex;gap:5px;align-items:center}.rr-orderqty input{width:75px;min-height:38px;padding:6px}'+
    '.rr-part{display:block;font-size:12px;text-align:left;white-space:normal;font-weight:800}.rr-pn{font-size:10px;color:#6c8191;overflow-wrap:anywhere;margin-top:4px}'+
    '.rr-status{font-size:10px;color:#42617a;font-weight:700;margin-top:4px}.rr-mobile{display:none}'+
    '@media(max-width:850px){.rr-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.rr-summary{grid-template-columns:repeat(2,minmax(0,1fr))}'+
    '.rr-desktop{display:none}.rr-mobile{display:grid;gap:10px}.rr-card{border:1px solid #dce7ef;border-radius:10px;padding:12px;min-width:0}'+
    '.rr-card-system,.rr-card-bottom label{font-size:11px;color:#708797}.rr-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:11px 0}'+
    '.rr-metrics>div{background:#f6f9fc;border-radius:8px;padding:8px 7px;min-width:0}.rr-metrics small,.rr-metrics b{display:block;font-size:10px}.rr-metrics b{font-size:12px;margin-top:4px}'+
    '.rr-card-bottom{display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap;align-items:end}.rr-card-bottom label{display:grid;gap:5px}'+
    '.rr-card-bottom input{min-height:38px;width:100px;padding:7px}.rr-card-bottom button{margin:2px;padding:8px;font-size:11px}'+
    '.rr-cost{display:block}.rr-card .rr-part{font-size:14px}}'+
    '@media(max-width:500px){.rr-header h2{font-size:19px}.rr-buttons{width:100%}.rr-filters label:nth-child(3){grid-column:span 2}'+
    '.rr-filters button{grid-column:span 2}.rr-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(style);
  window.N594ZSReorderReport=Object.freeze({
    collect,filter,incomingFor,csvText,printMarkup,mountOps:()=>mount('ops'),
    mountParts:()=>mount('parts'),openParts,closeParts
  });
})();