const form = document.getElementById('ksef-form');
const itemsBody = document.getElementById('items-body');
const addItemBtn = document.getElementById('add-item');
const resetBtn = document.getElementById('reset-form');
const statusEl = document.getElementById('ksef-status');
const totalNetEl = document.getElementById('total-net');
const totalKatEl = document.getElementById('total-kat');
const totalGrossEl = document.getElementById('total-gross');
let __fontPromise = null;
let __logoPromise = null;

function formatMoney(value){
  const num = Number.isFinite(value) ? value : 0;
  return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseNumber(val){
  const num = parseFloat(String(val ?? '').replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}
function formatQty(value){
  const num = parseNumber(value);
  return Number.isFinite(num) ? num.toLocaleString('pl-PL', { maximumFractionDigits: 2 }) : '0';
}
function todayIso(offsetDays = 0){
  const d = new Date();
  if(offsetDays) d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function defaultInvoiceNumber(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `KAT-${y}${m}${day}${hh}${mm}${ss}`;
}
function clearStatus(){
  statusEl.textContent = '';
  statusEl.className = 'ksef-status';
}
function setStatus(msg, kind = 'ok'){
  statusEl.textContent = msg;
  statusEl.className = 'ksef-status ' + kind;
}

function renumberRows(){
  const rows = itemsBody.querySelectorAll('tr');
  rows.forEach((row, idx)=>{
    const cell = row.querySelector('.idx');
    if(cell) cell.textContent = String(idx + 1);
  });
}

function recalcTotals(){
  let net = 0;
  let kat = 0;
  const rows = itemsBody.querySelectorAll('tr');
  rows.forEach(row => {
    const qty = parseNumber(row.querySelector('.item-qty')?.value);
    const price = parseNumber(row.querySelector('.item-price')?.value);
    const katRate = parseNumber(row.querySelector('.item-kat')?.value);
    const lineNet = qty * price;
    const lineKat = lineNet * (katRate / 100);
    const lineGross = lineNet + lineKat;
    net += lineNet;
    kat += lineKat;
    const tgt = row.querySelector('.line-total');
    if(tgt) tgt.textContent = formatMoney(lineGross);
  });
  const gross = net + kat;
  totalNetEl.textContent = formatMoney(net);
  totalKatEl.textContent = formatMoney(kat);
  totalGrossEl.textContent = formatMoney(gross);
  renumberRows();
}

function addRow(prefill = {}){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="idx"></td>
    <td><input type="text" class="item-name" placeholder="Opis towaru/usługi" value="${prefill.name ?? ''}" /></td>
    <td><input type="number" class="item-qty" min="0" step="0.01" value="${prefill.qty ?? 1}" /></td>
    <td><input type="text" class="item-unit" value="${prefill.unit ?? 'szt.'}" /></td>
    <td><input type="number" class="item-price" min="0" step="0.01" value="${prefill.price ?? 0}" /></td>
    <td><input type="number" class="item-kat" min="0" step="1" value="${prefill.kat ?? 0}" /></td>
    <td class="line-total mono">0,00</td>
    <td><button type="button" class="ksef-remove" aria-label="Usuń pozycję">Usuń</button></td>`;
  itemsBody.appendChild(tr);
  recalcTotals();
}

function collectData(){
  const data = {
    invoiceNumber: form.invoiceNumber?.value.trim() || '',
    issueDate: form.issueDate?.value || '',
    saleDate: form.saleDate?.value || '',
    currency: form.currency?.value.trim() || 'PMK',
    seller: {
      name: form.sellerName?.value.trim() || '',
      id: form.sellerId?.value.trim() || '',
      address: form.sellerAddress?.value.trim() || ''
    },
    buyer: {
      name: form.buyerName?.value.trim() || '',
      id: form.buyerId?.value.trim() || '',
      address: form.buyerAddress?.value.trim() || ''
    },
    payment: {
      method: form.paymentMethod?.value || 'Przelew',
      terms: form.paymentTerms?.value || '',
      status: form.paymentStatus?.value || 'Oczekuje',
      notes: form.extraNotes?.value.trim() || ''
    },
    items: []
  };
  const rows = itemsBody.querySelectorAll('tr');
  rows.forEach(row => {
    const name = row.querySelector('.item-name')?.value.trim() || '';
    const qty = parseNumber(row.querySelector('.item-qty')?.value);
    const unit = row.querySelector('.item-unit')?.value.trim() || 'szt.';
    const price = parseNumber(row.querySelector('.item-price')?.value);
    const katRate = parseNumber(row.querySelector('.item-kat')?.value);
    const net = qty * price;
    const kat = net * (katRate / 100);
    const gross = net + kat;
    if(!name && net === 0) return;
    data.items.push({ name, qty, unit, price, katRate, net, kat, gross });
  });
  data.totals = {
    net: data.items.reduce((s,i)=> s + i.net, 0),
    kat: data.items.reduce((s,i)=> s + i.kat, 0)
  };
  data.totals.gross = data.totals.net + data.totals.kat;
  return data;
}

function safeFileName(name){
  return name.replace(/[^a-z0-9_-]+/gi, '_').replace(/_+/g,'_').replace(/^_+|_+$/g,'') || 'faktura';
}

function bufToBase64(buf){
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for(let i=0; i<bytes.length; i+=CHUNK){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i+CHUNK));
  }
  return btoa(binary);
}

function syncPaymentTermState(){
  const status = form.paymentStatus?.value;
  const termInput = form.paymentTerms;
  if(!termInput) return;
  const shouldDisable = status === 'Opłacona';
  termInput.disabled = shouldDisable;
  if(shouldDisable) termInput.value = '';
}

async function ensurePdfFont(doc){
  if(!__fontPromise){
    __fontPromise = (async()=>{
      const url = 'https://fonts.gstatic.com/s/roboto/v50/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf';
      const r = await fetch(url);
      if(!r.ok) throw new Error('Nie udało się pobrać czcionki do PDF.');
      return bufToBase64(await r.arrayBuffer());
    })();
  }
  const b64 = await __fontPromise;
  doc.addFileToVFS('ksef-roboto.ttf', b64);
  doc.addFont('ksef-roboto.ttf','ksef-roboto','normal');
  return 'ksef-roboto';
}

async function ensureLogoData(){
  if(!__logoPromise){
    __logoPromise = (async()=>{
      const url = '/assets/ksef.png';
      const r = await fetch(url);
      if(!r.ok) throw new Error('Nie udało się pobrać logo.');
      const b64 = bufToBase64(await r.arrayBuffer());
      return `data:image/png;base64,${b64}`;
    })();
  }
  return __logoPromise;
}

async function generatePdf(data){
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF) throw new Error('Brak biblioteki PDF (jsPDF).');
  const doc = new jsPDF();
  if(typeof doc.autoTable !== 'function') throw new Error('Brak modułu tabel (autoTable).');
  const fontName = await ensurePdfFont(doc);
  doc.setFont(fontName, 'normal');
  let logoData = null;
  try {
    logoData = await ensureLogoData();
  } catch(err){
    console.warn('[kSeF] Logo PDF pominięte:', err);
  }
  if(logoData){
    const props = doc.getImageProperties(logoData);
    const pageW = doc.internal.pageSize.getWidth();
    const logoW = 40;
    const ratio = props?.height && props?.width ? props.height / props.width : 1;
    const logoH = logoW * ratio;
    doc.addImage(logoData, props?.fileType || 'PNG', pageW - logoW - 14, 10, logoW, logoH);
  }
  const cur = data.currency || 'PMK';
  doc.setFontSize(16);
  doc.text('Faktura KAT', 14, 18);
  doc.setFontSize(11);
  doc.text(`Numer: ${data.invoiceNumber || '-'}`, 14, 26);
  doc.text(`Data wystawienia: ${data.issueDate || '-'}`, 14, 32);
  doc.text(`Data sprzedaży: ${data.saleDate || '-'}`, 14, 38);
  const sellerBlock = [data.seller.name || '—', data.seller.id ? `ID: ${data.seller.id}` : '', data.seller.address || ''].filter(Boolean);
  const buyerBlock = [data.buyer.name || '—', data.buyer.id ? `ID: ${data.buyer.id}` : '', data.buyer.address || ''].filter(Boolean);
  doc.setFontSize(10);
  doc.text('Sprzedawca:', 14, 48);
  doc.text(sellerBlock.length ? sellerBlock : ['Brak danych'], 14, 54);
  doc.text('Nabywca:', 120, 48);
  doc.text(buyerBlock.length ? buyerBlock : ['Brak danych'], 120, 54);

  const tableBody = data.items.map((item, idx)=>[
    idx + 1,
    item.name || '—',
    formatQty(item.qty),
    item.unit || '',
    `${formatMoney(item.price)} ${cur}`,
    `${item.katRate}%`,
    `${formatMoney(item.net)} ${cur}`,
    `${formatMoney(item.kat)} ${cur}`,
    `${formatMoney(item.gross)} ${cur}`
  ]);
  doc.autoTable({
    head: [[ 'Lp', 'Nazwa', 'Ilość', 'Jm', `Cena netto (${cur})`, 'KAT %', `Netto (${cur})`, `KAT (${cur})`, `Brutto (${cur})` ]],
    body: tableBody,
    startY: 64,
    styles: { fontSize: 9, font: fontName },
    headStyles: { font: fontName, fillColor: [172,25,67], textColor: 255, halign: 'center' },
    bodyStyles: { font: fontName },
    columnStyles: { 0:{cellWidth:8, halign:'center'}, 2:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}, 7:{halign:'right'}, 8:{halign:'right'} }
  });
  const afterTableY = (doc.lastAutoTable?.finalY || 64) + 8;
  doc.setFontSize(11);
  doc.text(`Razem netto: ${formatMoney(data.totals.net)} ${cur}`, 14, afterTableY);
  doc.text(`KAT: ${formatMoney(data.totals.kat)} ${cur}`, 14, afterTableY + 6);
  doc.text(`Razem brutto: ${formatMoney(data.totals.gross)} ${cur}`, 14, afterTableY + 12);
  doc.text(`Płatność: ${data.payment.method || '—'}, termin: ${data.payment.terms || '-'}`, 14, afterTableY + 22);
  if(data.payment.status){ doc.text(`Status płatności: ${data.payment.status}`, 14, afterTableY + 28); }
  if(data.payment.notes){ doc.text(`Uwagi: ${data.payment.notes}`, 14, afterTableY + 34); }
  const fileName = `${safeFileName(data.invoiceNumber || 'faktura_kat')}.pdf`;
  doc.save(fileName);
}

function resetForm(){
  form.reset();
  form.invoiceNumber.value = defaultInvoiceNumber();
  form.issueDate.value = todayIso();
  form.saleDate.value = todayIso();
  form.paymentTerms.value = todayIso(7);
  form.currency.value = 'PMK';
  itemsBody.innerHTML = '';
  addRow();
  clearStatus();
}

async function handleSubmit(e){
  e.preventDefault();
  clearStatus();
  if(!form.reportValidity()) return;
  const data = collectData();
  if(!data.items.length){
    setStatus('Dodaj przynajmniej jedną pozycję.', 'err');
    return;
  }
  try {
    setStatus('Generuję PDF...', 'ok');
    await generatePdf(data);
    setStatus('PDF zapisany. Sprawdź pobrane pliki.', 'ok');
  } catch(err){
    console.error(err);
    setStatus(err.message || 'Nie udało się wygenerować PDF.', 'err');
  }
}

function bindEvents(){
  if(!form || !itemsBody){
    console.warn('[kSeF] Formularz nie został zainicjalizowany.');
    return;
  }
  itemsBody.addEventListener('input', recalcTotals);
  itemsBody.addEventListener('click', e => {
    const btn = e.target.closest('.ksef-remove');
    if(!btn) return;
    const row = btn.closest('tr');
    if(row){ row.remove(); recalcTotals(); }
  });
  addItemBtn?.addEventListener('click', ()=> { addRow(); });
  resetBtn?.addEventListener('click', ()=> { resetForm(); });
  form.paymentStatus?.addEventListener('change', syncPaymentTermState);
  form.addEventListener('submit', handleSubmit);
  resetForm();
  syncPaymentTermState();
}

bindEvents();
