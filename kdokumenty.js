const form = document.getElementById('kdok-form');
const bodyInput = document.getElementById('docBody');
const previewEl = document.getElementById('doc-preview');
const statusEl = document.getElementById('kdok-status');
const resetBtn = document.getElementById('reset-form');
let __fontPromise = null;
let __logoPromise = null;

function todayIso(){
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseMarkdownLineToSpans(line){
  const spans = [];
  let idx = 0;
  let bold = false;
  let italic = false;
  const pattern = /(\*\*\*|___|\*\*|__|\*|_)/g;
  while(idx <= line.length){
    pattern.lastIndex = idx;
    const match = pattern.exec(line);
    const nextIdx = match ? match.index : line.length;
    if(nextIdx > idx){
      spans.push({ text: line.slice(idx, nextIdx), bold, italic });
    }
    if(!match) break;
    const marker = match[1];
    const len = marker.length;
    if(len === 3){
      bold = !bold;
      italic = !italic;
    } else if(len === 2){
      bold = !bold;
    } else {
      italic = !italic;
    }
    idx = match.index + len;
  }
  return spans;
}

function renderMarkdownBody(doc, text, startX, startY, maxWidth, lineHeight, fontName, baseFontSize){
  const lines = (text || '').split('\n');
  let y = startY;
  const maxX = startX + maxWidth;
  lines.forEach((rawLine, lineIdx) => {
    let workingLine = rawLine;
    let lineFontSize = baseFontSize;
    let forceBold = false;
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(workingLine);
    if(headingMatch){
      const level = headingMatch[1].length;
      workingLine = headingMatch[2];
      lineFontSize = [0, 14, 13, 12, 11, 11, 11][level] || baseFontSize;
      forceBold = true;
    }
    const spans = parseMarkdownLineToSpans(workingLine);
    let x = startX;
    const lineStep = Math.max(lineHeight, lineFontSize * 0.6);
    spans.forEach(span => {
      if(!span.text) return;
      const styleBold = forceBold || span.bold;
      const styleItalic = span.italic;
      const style = styleBold && styleItalic ? 'bolditalic' : styleBold ? 'bold' : styleItalic ? 'italic' : 'normal';
      doc.setFont(fontName, style);
      doc.setFontSize(lineFontSize);
      const parts = span.text.split(/(\s+)/);
      parts.forEach(part => {
        if(!part) return;
        const w = doc.getTextWidth(part);
        if(x + w > maxX){
          y += lineStep;
          x = startX;
        }
        doc.text(part, x, y);
        x += w;
      });
    });
    if(lineIdx < lines.length - 1){
      y += lineStep;
    }
  });
  doc.setFontSize(baseFontSize);
  return y;
}
function clearStatus(){
  statusEl.textContent = '';
  statusEl.className = 'kdok-status';
}
function setStatus(msg, kind = 'ok'){
  statusEl.textContent = msg;
  statusEl.className = 'kdok-status ' + kind;
}
function safeFileName(name){
  return (name || '').replace(/[^a-z0-9_-]+/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'pismo';
}
function bufToBase64(buf){
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for(let i = 0; i < bytes.length; i += CHUNK){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
async function ensurePdfFont(doc){
  if(!__fontPromise){
    __fontPromise = (async()=>{
      const sources = {
        normal: [
          'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
          'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
          'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf'
        ],
        bold: [
          'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
          'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Bold.ttf',
          'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf'
        ],
        italic: [
          'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Italic.ttf',
          'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Italic.ttf',
          'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu51xIIzc.ttf'
        ],
        bolditalic: [
          'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-BoldItalic.ttf',
          'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-BoldItalic.ttf',
          'https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51S7ACc6CsE.ttf'
        ]
      };
      const fetchFirstAvailable = async(list, label)=>{
        let lastErr;
        for(const url of list){
          try {
            const r = await fetch(url, { mode: 'cors' });
            if(!r.ok) throw new Error(`HTTP ${r.status}`);
            return bufToBase64(await r.arrayBuffer());
          } catch(err){
            lastErr = err;
          }
        }
        throw new Error(`Nie udało się pobrać czcionki (${label}). ${lastErr?.message || ''}`.trim());
      };
      const [normalB64, boldB64, italicB64, boldItalicB64] = await Promise.all([
        fetchFirstAvailable(sources.normal, 'regular'),
        fetchFirstAvailable(sources.bold, 'bold'),
        fetchFirstAvailable(sources.italic, 'italic'),
        fetchFirstAvailable(sources.bolditalic, 'bolditalic')
      ]);
      return { normalB64, boldB64, italicB64, boldItalicB64 };
    })();
  }
  const { normalB64, boldB64, italicB64, boldItalicB64 } = await __fontPromise;
  doc.addFileToVFS('kdok-roboto.ttf', normalB64);
  doc.addFileToVFS('kdok-roboto-bold.ttf', boldB64);
  doc.addFileToVFS('kdok-roboto-italic.ttf', italicB64);
  doc.addFileToVFS('kdok-roboto-bolditalic.ttf', boldItalicB64);
  doc.addFont('kdok-roboto.ttf', 'kdok-roboto', 'normal');
  doc.addFont('kdok-roboto-bold.ttf', 'kdok-roboto', 'bold');
  doc.addFont('kdok-roboto-italic.ttf', 'kdok-roboto', 'italic');
  doc.addFont('kdok-roboto-bolditalic.ttf', 'kdok-roboto', 'bolditalic');
  return 'kdok-roboto';
}

async function ensureLogoData(){
  if(!__logoPromise){
    __logoPromise = (async()=>{
      const url = '/assets/kdokumenty.png';
      const r = await fetch(url);
      if(!r.ok) throw new Error('Nie udało się pobrać logo.');
      const b64 = bufToBase64(await r.arrayBuffer());
      return `data:image/png;base64,${b64}`;
    })();
  }
  return __logoPromise;
}

function updatePreview(){
  const val = bodyInput?.value || '';
  if(window.marked){
    window.marked.setOptions({ breaks: true });
    previewEl.innerHTML = window.marked.parse(val || '');
  } else {
    previewEl.textContent = val;
  }
}

function wrapSelection(before, after, transform){
  if(!bodyInput) return;
  const start = bodyInput.selectionStart ?? 0;
  const end = bodyInput.selectionEnd ?? 0;
  const value = bodyInput.value;
  const selected = value.slice(start, end);
  const replacement = transform ? transform(selected, { start, end }) : `${before}${selected}${after}`;
  bodyInput.value = value.slice(0, start) + replacement + value.slice(end);
  const caret = start + replacement.length;
  bodyInput.setSelectionRange(caret, caret);
  bodyInput.focus();
  updatePreview();
}

function applyFormat(action){
  switch(action){
    case 'bold':
      wrapSelection('**', '**');
      break;
    case 'italic':
      wrapSelection('_', '_');
      break;
    case 'code':
      wrapSelection('`', '`');
      break;
    case 'quote':
      wrapSelection('', '', sel => sel.split('\n').map(line => line ? `> ${line}` : '> ').join('\n'));
      break;
    case 'ul':
      wrapSelection('', '', sel => {
        const lines = (sel || '').split('\n');
        return lines.map(line => line ? `- ${line}` : '- ').join('\n');
      });
      break;
    case 'ol':
      wrapSelection('', '', sel => {
        const lines = (sel || '').split('\n');
        let idx = 1;
        return lines.map(line => `${idx++}. ${line || ''}`).join('\n');
      });
      break;
    case 'h2':
      wrapSelection('', '', sel => `## ${sel || 'Nagłówek'}`);
      break;
    case 'link':
      wrapSelection('[', '](https://)', sel => `[${sel || 'tekst'}](https://)`);
      break;
    default:
      break;
  }
}

function markdownToPlain(md){
  const txt = (md || '').replace(/\r\n/g, '\n');
  const lines = txt.split('\n').map(line => {
    let l = line;
    l = l.replace(/^\s*>\s?/, '› ');
    l = l.replace(/^#{1,6}\s+/, '');
    l = l.replace(/^\s*[-*+]\s+/, '• ');
    l = l.replace(/^\s*(\d+)\.\s+/, (_, n) => `${n}. `);
    l = l.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    l = l.replace(/`([^`]+)`/g, '$1');
    l = l.replace(/\*\*([^*]+)\*\*/g, '$1');
    l = l.replace(/__([^_]+)__/g, '$1');
    l = l.replace(/\*([^*]+)\*/g, '$1');
    l = l.replace(/_([^_]+)_/g, '$1');
    l = l.replace(/~~([^~]+)~~/g, '$1');
    return l.trimEnd();
  });
  return lines.join('\n');
}

function applyTemplate(){
  bodyInput.value = '';
  updatePreview();
}

function collectData(){
  return {
    title: form.docTitle?.value.trim() || '',
    reference: form.docReference?.value.trim() || '',
    date: form.docDate?.value || todayIso(),
    body: bodyInput?.value || '',
    sender: collectParty('sender'),
    recipient: collectParty('recipient')
  };
}

function collectParty(prefix){
  const type = form[`${prefix}Type`]?.value || 'institution';
  if(type === 'person'){
    return {
      type,
      nick: form[`${prefix}NickPerson`]?.value.trim() || '',
      pesel: form[`${prefix}Pesel`]?.value.trim() || '',
      address: form[`${prefix}AddressPerson`]?.value.trim() || ''
    };
  }
  return {
    type,
    company: form[`${prefix}Company`]?.value.trim() || '',
    knip: form[`${prefix}Knip`]?.value.trim() || '',
    unit: form[`${prefix}Unit`]?.value.trim() || '',
    address: form[`${prefix}Address`]?.value.trim() || '',
    nick: form[`${prefix}Nick`]?.value.trim() || '',
    repPesel: form[`${prefix}RepPesel`]?.value.trim() || ''
  };
}

async function generatePdf(data){
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF) throw new Error('Brak biblioteki PDF (jsPDF).');
  const doc = new jsPDF();
  const fontName = await ensurePdfFont(doc);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(11);
  const pageWidth = doc.internal.pageSize.getWidth();
  let logoData = null;
  try {
    logoData = await ensureLogoData();
  } catch(err){
    console.warn('[kDokumenty] Logo PDF pominięte:', err);
  }
  if(logoData){
    const props = doc.getImageProperties(logoData);
    const logoW = 45;
    const ratio = props?.height && props?.width ? props.height / props.width : 1;
    const logoH = logoW * ratio;
    doc.addImage(logoData, props?.fileType || 'PNG', pageWidth - logoW - 14, 10, logoW, logoH);
  }
  doc.text(`Data pisma: ${data.date || '-'}`, 14, 32);
  if(data.reference){
    doc.text(`Sygnatura: ${data.reference}`, 14, 38);
  }
  const senderLines = buildPartyLines(data.sender);
  const recipientLines = buildPartyLines(data.recipient);
  doc.setFontSize(10);
  doc.text('Nadawca:', 14, 48);
  doc.text(senderLines.length ? senderLines : ['Brak danych'], 14, 54);
  doc.text('Adresat:', 120, 48);
  doc.text(recipientLines.length ? recipientLines : ['Brak danych'], 120, 54);
  const blockHeight = Math.max(senderLines.length, recipientLines.length, 1) * 6;
  let y = 54 + blockHeight + 10;
  if(data.title){
    doc.setFontSize(12);
    doc.setFont(fontName, 'bold');
    doc.text(data.title, pageWidth / 2, y, { align: 'center' });
    doc.setFont(fontName, 'normal');
    y += 10;
  }
  doc.setFontSize(11);
  doc.text('Treść pisma:', 14, y);
  y += 8;
  const bodyText = data.body || 'Brak treści.';
  renderMarkdownBody(doc, bodyText, 14, y, 182, 6, fontName, 11);
  const fileName = safeFileName(data.title || 'pismo') + '.pdf';
  doc.save(fileName);
}

function buildPartyLines(p){
  const isPerson = p?.type === 'person';
  if(isPerson){
    return [
      'Osoba prywatna',
      p.nick || '—',
      p.address || '',
      p.pesel ? `KESEL: ${p.pesel}` : ''
    ].filter(Boolean);
  }
  return [
    'Instytucja / firma',
    p.company || '—',
    p.unit || '',
    p.address || '',
    p.knip ? `KNIP: ${p.knip}` : '',
    p.nick ? `Nick: ${p.nick}` : '',
    p.repPesel ? `KESEL reprezentanta: ${p.repPesel}` : ''
  ].filter(Boolean);
}

function resetForm(){
  form.reset();
  form.docDate.value = todayIso();
  bodyInput.value = '';
  applyTemplate();
  updatePreview();
  clearStatus();
  syncEntityUI();
}

async function handleSubmit(e){
  e.preventDefault();
  clearStatus();
  if(!form.reportValidity()) return;
  const data = collectData();
  try {
    setStatus('Generuję PDF...', 'ok');
    await generatePdf(data);
    setStatus('PDF zapisany. Sprawdź pobrane pliki.', 'ok');
  } catch(err){
    console.error(err);
    setStatus(err.message || 'Nie udało się wygenerować PDF.', 'err');
  }
}

function bindToolbar(){
  const buttons = document.querySelectorAll('.kdok-toolbar [data-action]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => applyFormat(btn.dataset.action));
  });
}

function bindEvents(){
  if(!form || !bodyInput) return;
  bindToolbar();
  bodyInput.addEventListener('input', updatePreview);
  form.addEventListener('submit', handleSubmit);
  resetBtn?.addEventListener('click', resetForm);
  resetForm();
  form.senderType?.addEventListener('change', syncEntityUI);
  form.recipientType?.addEventListener('change', syncEntityUI);
}

function syncEntityUI(){
  togglePartyFields('sender');
  togglePartyFields('recipient');
}

function togglePartyFields(prefix){
  const type = form[`${prefix}Type`]?.value || 'institution';
  const box = form.querySelector(`#${prefix}Type`)?.closest('.kdok-box');
  if(!box) return;
  const nodes = box.querySelectorAll('[data-entity]');
  nodes.forEach(el => {
    const match = el.getAttribute('data-entity') === type;
    el.hidden = !match;
  });
}

bindEvents();
