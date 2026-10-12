// ErrorGeek popup and lookup window.
'use strict';
const $ = (id) => document.getElementById(id);
const api = globalThis.browser && globalThis.browser.storage ? globalThis.browser : chrome;
let db = null;
const params = new URLSearchParams(location.search);
if (params.get('win')) document.body.classList.add('win');

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

async function loadDb() {
  const res = await fetch(api.runtime.getURL('errors.json'));
  db = await res.json();
}

async function getRecent() {
  try { const r = await api.storage.local.get('recent'); return Array.isArray(r.recent) ? r.recent : []; } catch (e) { return []; }
}
async function addRecent(r) {
  const top = r.matches[0];
  const item = { q: r.layout === 'win32' ? String(r.value) : r.hex, name: top ? (top.name || top.label + ' code') : (r.configmgr ? 'ConfigMgr code' : '') };
  let list = (await getRecent()).filter((x) => x.q !== item.q);
  list.unshift(item); list = list.slice(0, 8);
  try { await api.storage.local.set({ recent: list }); } catch (e) {}
  showRecent(list);
}
function showRecent(list) {
  const ul = $('recent'); ul.textContent = '';
  $('recentBox').hidden = !list.length;
  for (const it of list) {
    const li = el('li'); const b = el('button'); b.type = 'button';
    b.append(el('span', 'rc', it.q), el('span', 'rn', it.name || ''));
    b.addEventListener('click', () => { $('q').value = it.q; run(it.q, true); });
    li.append(b); ul.append(li);
  }
}

function copyBtn(text) {
  const b = el('button', 'copy', 'Copy'); b.type = 'button'; b.title = 'Copy ' + text;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Copy failed'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1200);
  });
  return b;
}

function render(parsed, r) {
  const out = $('out'); out.textContent = '';
  if (!parsed) {
    const c = el('div', 'card empty');
    c.append(el('div', null, 'No error code found in that text.'), el('div', 'small muted', 'Try something like 0x80070005, 80070005, -2147024891 or 1603.'));
    out.append(c); return;
  }
  const c = el('div', 'card'); c.id = 'result';
  const head = el('div', 'code');
  head.append(el('span', 'big', r.layout === 'win32' ? String(r.value) : r.hex), copyBtn(r.layout === 'win32' ? String(r.value) : r.hex));
  c.append(head);

  const dl = el('dl', 'forms');
  const row = (k, v) => { dl.append(el('dt', null, k), el('dd', null, v)); };
  row('Hex', r.hex); row('Decimal', String(r.unsigned)); row('Signed', String(r.signed));
  if (r.hresultForm && r.value) row('As HRESULT', r.hresultForm);
  c.append(dl);

  if (r.parts) {
    const chips = el('div', 'chips');
    const chip = (k, v) => { const s = el('span', 'chip'); s.append(el('b', null, k + ' '), document.createTextNode(v)); chips.append(s); };
    chip('Type', r.layout === 'ntstatus' ? 'NTSTATUS' : 'HRESULT');
    chip('Severity', r.parts.severity);
    chip('Facility', (r.parts.facilityName || 'unknown') + ' (' + r.parts.facility + ')');
    chip('Code', r.parts.code + ' (0x' + r.parts.code.toString(16).toUpperCase().padStart(4, '0') + ')');
    if (r.parts.customer) chip('Customer bit', 'set');
    if (r.parts.ntMapped) chip('N bit', 'NTSTATUS inside');
    c.append(chips);
  }

  if (!r.matches.length) {
    c.append(el('p', 'msg', r.configmgr ? 'Configuration Manager or Intune code.' : 'This code is not in the offline list.'));
  }
  for (const m of r.matches) {
    const box = el('div', 'match');
    const h = el('div', 'mhead');
    h.append(el('span', 'kind ' + m.kind, m.label), el('span', 'small muted', m.code));
    box.append(h);
    if (m.name) {
      const n = el('div', 'name', m.name); n.title = 'Click to copy';
      n.addEventListener('click', () => navigator.clipboard.writeText(m.name).catch(() => {}));
      box.append(n);
    }
    if (m.names.length > 1) box.append(el('div', 'alias', 'Also: ' + m.names.slice(1).join(', ')));
    if (m.message) box.append(el('p', 'msg', m.message));
    else box.append(el('p', 'guess', m.guess), el('div', 'src', 'No message text in the offline list. This is read from the name.'));
    if (m.via) box.append(el('div', 'via', m.via));
    if (m.message && m.source) box.append(el('div', 'src', 'Text: ' + m.source));
    c.append(box);
  }
  if (r.hint) {
    const fx = el('div', 'fix'); fx.id = 'fix';
    fx.append(el('div', 'fixhead', 'How to fix'), el('p', null, r.hint));
    c.append(fx);
  }
  for (const note of r.notes) c.append(el('div', 'note', note));

  const k = ErrorGeek.links(r);
  const links = el('div', 'links');
  const a1 = el('a', 'tgh', 'Search TechyGeeksHome'); a1.href = k.tgh; a1.target = '_blank'; a1.rel = 'noopener'; a1.id = 'tgh';
  const a2 = el('a', 'learn', 'Search Microsoft Learn'); a2.href = k.learn; a2.target = '_blank'; a2.rel = 'noopener'; a2.id = 'learn';
  links.append(a1, a2); c.append(links);

  if (parsed.altDecimal != null) {
    const alt = el('div', 'alt muted', 'Read as hex. ');
    const a = el('a', null, 'Look up decimal ' + parsed.altDecimal + ' instead'); a.href = '#';
    a.addEventListener('click', (e) => { e.preventDefault(); $('q').value = String(parsed.altDecimal); run(String(parsed.altDecimal), true, true); });
    alt.append(a); c.append(alt);
  }
  out.append(c);
}

function run(text, save, forceDecimal) {
  if (!db) return;
  let parsed = ErrorGeek.parseInput(text);
  if (parsed && forceDecimal) parsed = { value: Number(text) >>> 0, read: 'decimal', token: text };
  if (!text.trim()) { $('out').textContent = ''; $('hint').hidden = false; return; }
  $('hint').hidden = true;
  const r = parsed ? ErrorGeek.lookup(db, parsed.value) : null;
  render(parsed, r);
  if (save && r) addRecent(r);
  return r;
}

$('f').addEventListener('submit', (e) => { e.preventDefault(); run($('q').value, true); });
let t = 0;
$('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run($('q').value, false), 250); });
$('clear').addEventListener('click', async () => { try { await api.storage.local.set({ recent: [] }); } catch (e) {} showRecent([]); });

(async () => {
  await loadDb();
  $('loading').hidden = true;
  showRecent(await getRecent());
  const q = params.get('q');
  if (q) { $('q').value = q; run(q, true); }
  $('q').focus();
  document.body.dataset.ready = '1';
})();
