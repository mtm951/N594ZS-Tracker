// ---------- V4.3 INVOICE PDF WORKFLOW ----------

RECORD_ARRAYS.invoice='invoices';
SYNC_RECORD_TYPES.add('invoice');
SEED.invoices=SEED.invoices||[];

const blankCloudDBInvoiceBase=blankCloudDB;
blankCloudDB=function(){const out=blankCloudDBInvoiceBase();out.invoices=[];return out};

const normalizeDBInvoiceBase=normalizeDB;
normalizeDB=function(){
  normalizeDBInvoiceBase();
  db.invoices=arr(db.invoices);
  db.invoices.forEach(x=>{
    x.id=String(x.id||x.invoice||'');x.invoice=String(x.invoice||x.id||'');x.vendor=x.vendor||'Vendor';x.order=String(x.order||'');x.invoiceDate=x.invoiceDate||'';
    ['subtotal','tax','miscCharge','freight','paidWithOrder','balanceDue','total'].forEach(k=>{x[k]=Number(x[k])||0});
    x.pdfBase64=x.pdfBase64||'';x.pdfMime=x.pdfMime||'application/pdf';x.pdfName=x.pdfName||`Invoice ${x.invoice}.pdf`;
  });
};
normalizeDB();

function invoiceRecord(invoice){return db.invoices.find(x=>String(x.invoice)===String(invoice))||null}
function invoicePdfBlob(x){
  if(!x?.pdfBase64)return null;
  const raw=atob(x.pdfBase64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Blob([bytes],{type:x.pdfMime||'application/pdf'});
}
function openImportedInvoicePDF(invoice){const x=invoiceRecord(invoice),blob=invoicePdfBlob(x);if(!blob)return;const u=URL.createObjectURL(blob);objectUrls.push(u);window.open(u,'_blank')}
function downloadImportedInvoicePDF(invoice){const x=invoiceRecord(invoice),blob=invoicePdfBlob(x);if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=x.pdfName||`Invoice ${invoice}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}

const openInvoiceGroupPdfBase=openInvoiceGroup;
openInvoiceGroup=function(invoice){
  openInvoiceGroupPdfBase(invoice);
  const x=invoiceRecord(invoice),modal=document.getElementById('modalBox');if(!x||!modal)return;
  const cards=[...modal.querySelectorAll('.detail-card')],target=cards[0]||modal.querySelector('.summary-strip');
  const pdfActions=x.pdfBase64?`<div class="action-row"><button class="primary" onclick="openImportedInvoicePDF('${esc(x.invoice)}')">Open Original PDF</button><button class="secondary" onclick="downloadImportedInvoicePDF('${esc(x.invoice)}')">Save PDF</button></div>`:'';
  const card=document.createElement('div');card.className='detail-card invoice-source-card';card.innerHTML=`<div class="section-tools"><h3>Invoice Totals</h3><span class="mini-badge">${x.pdfBase64?'Original PDF imported':'Invoice data matched'}</span></div><div class="invoice-total-grid"><div><span>Subtotal</span><b>${fmtMoney(x.subtotal)}</b></div><div><span>Tax</span><b>${fmtMoney(x.tax)}</b></div><div><span>Freight</span><b>${fmtMoney(x.freight)}</b></div><div><span>Invoice total</span><b>${fmtMoney(x.total)}</b></div></div>${pdfActions}`;
  if(target?.nextSibling)modal.insertBefore(card,target.nextSibling);else modal.appendChild(card);
};

const renderPurchasesPdfBase=renderPurchases;
renderPurchases=function(){
  renderPurchasesPdfBase();
  const toolbar=document.querySelector('#page-purchases .toolbar');if(!toolbar)return;
  const actions=toolbar.querySelector('.action-row')||toolbar.lastElementChild;
  if(actions&&!document.getElementById('bulkInvoicePdfBtn')){
    const b=document.createElement('button');b.className='secondary';b.id='bulkInvoicePdfBtn';b.textContent='Bulk Invoice PDFs';b.onclick=chooseBulkInvoicePDFs;actions.appendChild(b);
  }
  const intro=toolbar.querySelector('.muted');if(intro&&db.invoices.length)intro.insertAdjacentHTML('beforeend',` <span class="mini-badge">${db.invoices.length} invoices matched</span>`);
};

function chooseBulkInvoicePDFs(){document.getElementById('invoiceBulkFile')?.click()}
async function pdfText(file){
  if(typeof pdfjsLib==='undefined')throw new Error('PDF reader library is not available. Refresh the page while online and try again.');
  const buf=await file.arrayBuffer(),doc=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;let text='';
  for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i),tc=await p.getTextContent();text+=' '+tc.items.map(x=>x.str).join(' ')}
  return text.replace(/\s+/g,' ');
}
async function matchInvoicePDF(file){
  const text=await pdfText(file),known=[...new Set(db.purchases.map(p=>String(p.invoice||'')).filter(Boolean))];
  const matches=known.filter(inv=>text.includes(inv));
  if(matches.length===1)return {invoice:matches[0],text};
  const orderMatches=[...new Set(db.purchases.filter(p=>p.order&&text.includes(String(p.order))).map(p=>String(p.invoice)).filter(Boolean))];
  if(orderMatches.length===1)return {invoice:orderMatches[0],text};
  return {invoice:null,text,matches:[...new Set([...matches,...orderMatches])]};
}
async function existingInvoiceFiles(invoice){try{return await getAttachments('purchase-invoice',Number(invoice))}catch(_e){return []}}
async function handleBulkInvoicePDFs(files){
  if(!files?.length)return;const pdfs=[...files].filter(f=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'));if(!pdfs.length)return alert('Choose one or more PDF invoices.');
  let imported=0,skipped=0;const unmatched=[];
  toast(`Reading ${pdfs.length} invoice PDF${pdfs.length===1?'':'s'}…`);
  for(const file of pdfs){
    try{
      const m=await matchInvoicePDF(file);if(!m.invoice){unmatched.push(file.name);continue}
      const existing=await existingInvoiceFiles(m.invoice);if(existing.length){skipped++;continue}
      const named=new File([file],`${db.purchases.find(p=>String(p.invoice)===m.invoice)?.vendor||'Invoice'} ${m.invoice}.pdf`,{type:'application/pdf',lastModified:file.lastModified});
      await addAttachments('purchase-invoice',Number(m.invoice),[named]);imported++;
    }catch(e){unmatched.push(`${file.name} (${e.message})`)}
  }
  const msg=[`${imported} PDF${imported===1?'':'s'} matched and uploaded`,skipped?`${skipped} already had an invoice file`:null,unmatched.length?`${unmatched.length} need review`:null].filter(Boolean).join(' • ');
  toast(msg,unmatched.length?'':'good');
  if(unmatched.length)openModal(`${modalHeader('Invoice PDF Import','Most files were matched automatically.')}<div class="notice"><b>${esc(msg)}</b></div><div class="detail-card"><h3>Could not match automatically</h3>${unmatched.map(x=>`<div class="kv"><span>${esc(x)}</span></div>`).join('')}</div><div class="modal-actions"><button class="primary" onclick="closeModal()">Done</button></div>`);
}

let invoiceBulkFile=document.getElementById('invoiceBulkFile');
if(!invoiceBulkFile){invoiceBulkFile=document.createElement('input');invoiceBulkFile.type='file';invoiceBulkFile.id='invoiceBulkFile';invoiceBulkFile.className='file-input';invoiceBulkFile.accept='application/pdf,.pdf';invoiceBulkFile.multiple=true;document.body.appendChild(invoiceBulkFile)}
invoiceBulkFile.addEventListener('change',async e=>{const files=[...(e.target.files||[])];e.target.value='';await handleBulkInvoicePDFs(files)});
