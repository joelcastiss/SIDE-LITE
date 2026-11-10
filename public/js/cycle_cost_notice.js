/* A receipt of existing cash movements. This module never calculates charges. */
let activeCycleCostNotice=null;
function cycleCostNoticeOwner(){
  return JSON.stringify([currentStudent.game?.id||currentStudent.game?.codigo,currentStudent.empresaId||null,currentStudent.legalName||'',currentStudent.company]);
}
function cycleCostAcknowledgementKey(round){return 'SIDE_CYCLE_COSTS_ACK_'+cycleCostNoticeOwner()+'_'+round;}
function cycleCostNoticeMoney(value){return 'S/ '+Number(value||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function acknowledgeCycleCostNotice(){
  if(!activeCycleCostNotice||$('cycleCostsModal')?.classList.contains('hidden'))return;
  const {owner,round}=activeCycleCostNotice;
  activeCycleCostNotice=null;
  if(owner!==cycleCostNoticeOwner())return;
  const receipt=decisionState.__cycleCosts?.[round];if(!receipt)return;
  receipt.acknowledged=true;
  try{localStorage.setItem(cycleCostAcknowledgementKey(round),'1');persistGameState();queueStudentSnapshot(buildStudentSnapshot());}
  catch(error){console.warn('SIDE: el aviso se cerró; su confirmación sigue pendiente de guardar.',error);}
}
function maybeShowCycleCostNotice(){
  // Economic receipts wait for the 2D interface; they never interrupt play.
  if(['simulator3d','simulationLoading'].some(id=>{const screen=$(id);return screen&&!screen.classList.contains('hidden');}))return null;
  if(!studentConnected||!studentAccess().canOperate)return null;
  // Admission, recovery and other dialogs take priority; never replace them.
  if(!$('modalRoot')?.classList.contains('hidden')&&$('cycleCostsModal')?.classList.contains('hidden'))return null;
  if(activeCycleCostNotice?.owner===cycleCostNoticeOwner()&&activeCycleCostNotice.round===currentRound()&&!$('cycleCostsModal')?.classList.contains('hidden'))return null;
  const receipt=ensureCycleFixedCosts();
  if(!receipt||!(receipt.total>0))return null;
  try{if(localStorage.getItem(cycleCostAcknowledgementKey(receipt.round))==='1')receipt.acknowledged=true;}catch{}
  if(receipt.acknowledged)return receipt;
  const list=$('cycleCostsItems');if(!list)return receipt;
  updateCashHud();
  syncReportToSupabase(syncStudentReportPreview());
  list.replaceChildren();
  for(const item of receipt.items){
    const row=document.createElement('li'),label=document.createElement('span'),amount=document.createElement('strong');
    label.textContent=item.label;amount.textContent='− '+cycleCostNoticeMoney(item.amount);row.append(label,amount);list.append(row);
  }
  $('cycleCostsCycle').textContent='Ciclo '+receipt.round;
  $('cycleCostsTotal').textContent='− '+cycleCostNoticeMoney(receipt.total);
  $('cycleCostsBefore').textContent=cycleCostNoticeMoney(receipt.before);
  $('cycleCostsAfter').textContent=cycleCostNoticeMoney(receipt.after);
  activeCycleCostNotice={owner:cycleCostNoticeOwner(),round:receipt.round};
  showModal('cycleCostsModal');
  return receipt;
}
