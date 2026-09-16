// ---------- V4.6 UNIVERSAL RECEIPT / SOURCE ATTACHMENTS ----------

// Attachment storage already supports string entity IDs. Allow purchase source
// documents for alphanumeric order/invoice numbers (for example Speedway E6247419)
// instead of limiting the UI to numeric invoice IDs.
existingInvoiceFiles=async function(invoice){
  try{return await getAttachments('purchase-invoice',String(invoice))}catch(_e){return []}
};

const openInvoiceGroupReceiptBase=openInvoiceGroup;
openInvoiceGroup=function(invoice){
  openInvoiceGroupReceiptBase(invoice);
  const key=String(invoice||''),modal=document.getElementById('modalBox');if(!modal||!key)return;

  // Remove the old numeric-only limitation message, if present.
  [...modal.querySelectorAll('.notice')].forEach(n=>{
    if(/numeric invoice IDs/i.test(n.textContent||''))n.remove();
  });

  let card=[...modal.querySelectorAll('.detail-card')].find(c=>/Invoice PDF \/ Receipt|Receipt \/ Source Files/i.test(c.querySelector('h3')?.textContent||''));
  if(card){
    const h=card.querySelector('h3');if(h)h.textContent='Receipt / Source Files';
  }else{
    card=document.createElement('div');card.className='detail-card';card.dataset.receiptSourceCard='1';
    card.innerHTML=`<div class="section-tools"><h3>Receipt / Source Files</h3><button class="icon-btn" data-add-source>+ Upload Receipt</button></div><div class="attach-drop" data-source-drop>Drop the original invoice, order PDF, receipt, or screenshot here</div><div id="attachments-purchase-invoice-${esc(key)}"></div>`;
    card.querySelector('[data-add-source]')?.addEventListener('click',()=>chooseAttachments('purchase-invoice',key));
    const drop=card.querySelector('[data-source-drop]');
    drop?.addEventListener('click',()=>chooseAttachments('purchase-invoice',key));
    drop?.addEventListener('dragover',e=>e.preventDefault());
    drop?.addEventListener('drop',e=>handleEntityDrop(e,'purchase-invoice',key));
    modal.appendChild(card);
  }
  queueMicrotask(()=>renderAttachments('purchase-invoice',key));
};

// Make the bulk uploader store matches under the exact invoice/order key instead
// of coercing them to Number(), which breaks alphanumeric references.
const handleBulkInvoicePDFsReceiptBase=handleBulkInvoicePDFs;
handleBulkInvoicePDFs=async function(files){
  if(!files?.length)return;
  const pdfs=[...files].filter(f=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'));if(!pdfs.length)return alert('Choose one or more PDF invoices.');
  let imported=0,skipped=0;const unmatched=[];
  toast(`Reading ${pdfs.length} invoice PDF${pdfs.length===1?'':'s'}…`);
  for(const file of pdfs){
    try{
      const m=await matchInvoicePDF(file);if(!m.invoice){unmatched.push(file.name);continue}
      const key=String(m.invoice),existing=await existingInvoiceFiles(key);if(existing.length){skipped++;continue}
      const vendor=db.purchases.find(p=>String(p.invoice)===key)?.vendor||'Invoice';
      const named=new File([file],`${vendor} ${key}.pdf`,{type:'application/pdf',lastModified:file.lastModified});
      await addAttachments('purchase-invoice',key,[named]);imported++;
    }catch(e){unmatched.push(`${file.name} (${e.message})`)}
  }
  const msg=[`${imported} PDF${imported===1?'':'s'} matched and uploaded`,skipped?`${skipped} already had a source file`:null,unmatched.length?`${unmatched.length} need review`:null].filter(Boolean).join(' • ');
  toast(msg,unmatched.length?'':'good');
  if(unmatched.length)openModal(`${modalHeader('Invoice PDF Import','Most files were matched automatically.')}<div class="notice"><b>${esc(msg)}</b></div><div class="detail-card"><h3>Could not match automatically</h3>${unmatched.map(x=>`<div class="kv"><span>${esc(x)}</span></div>`).join('')}</div><div class="modal-actions"><button class="primary" onclick="closeModal()">Done</button></div>`);
};
