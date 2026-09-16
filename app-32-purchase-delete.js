// ---------- V4.9.2 PURCHASE DELETE / TRASH ----------

function deletePurchaseRecord(id){
  const p=db.purchases.find(x=>String(x.id)===String(id));
  if(!p)return;
  const linkedEquipment=arr(db.equipment).filter(e=>String(e.purchaseId||'')===String(id));
  const inventoryPart=p.inventoryPartId?partById(Number(p.inventoryPartId)):null;
  const notes=[];
  if(linkedEquipment.length)notes.push(`${linkedEquipment.length} equipment record${linkedEquipment.length===1?' is':'s are'} linked; the equipment will be kept but the direct purchase link will be removed.`);
  if(inventoryPart)notes.push(`The linked inventory part “${inventoryPart.name}” will be kept; deleting the purchase will not subtract inventory.`);
  const extra=notes.length?`\n\n${notes.join('\n')}`:'';
  if(!confirm(`Delete this purchase?\n\n${p.description||p.pn||'Purchase'}${p.vendor?`\n${p.vendor}`:''}${p.invoice?`\nInvoice / order: ${p.invoice}`:''}${extra}\n\nIt will be moved to Trash and can be restored later.`))return;
  linkedEquipment.forEach(e=>{e.purchaseId='';});
  db.purchases=db.purchases.filter(x=>String(x.id)!==String(id));
  closeModal();
  saveDB('Purchase moved to Trash.');
  if(typeof renderPurchases==='function')renderPurchases();
}

const openPurchaseDetailDeleteBase=openPurchaseDetail;
openPurchaseDetail=function(id){
  openPurchaseDetailDeleteBase(id);
  const p=db.purchases.find(x=>String(x.id)===String(id)),modal=document.getElementById('modalBox');
  if(!p||!modal||modal.querySelector('[data-delete-purchase]'))return;
  let row=[...modal.querySelectorAll('.action-row')].find(r=>r.textContent.includes('Create Reorder'));
  if(!row){row=document.createElement('div');row.className='action-row';modal.appendChild(row);}
  const b=document.createElement('button');b.className='danger';b.dataset.deletePurchase='1';b.textContent='Delete Purchase';b.addEventListener('click',()=>deletePurchaseRecord(id));row.appendChild(b);
};

const openPurchaseModalDeleteBase=openPurchaseModal;
openPurchaseModal=function(id=null){
  openPurchaseModalDeleteBase(id);
  if(!id)return;
  const modal=document.getElementById('modalBox'),actions=modal?.querySelector('.modal-actions');
  if(!actions||actions.querySelector('[data-delete-purchase]'))return;
  const b=document.createElement('button');b.className='danger';b.dataset.deletePurchase='1';b.textContent='Delete Purchase';b.addEventListener('click',()=>deletePurchaseRecord(id));actions.insertBefore(b,actions.firstChild);
};
