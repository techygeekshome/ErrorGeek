// Unit tests for the parser and decoder. Run: node tests/unit.test.js
const assert = require('assert');
const path = require('path');
const EG = require('../decode.js');
const db = require(path.join(__dirname, '..', 'errors.json'));
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ', name); } catch (e) { fail++; console.log('FAIL ', name, '\n     ', e.message); } }
const L = (q) => { const p = EG.parseInput(q); assert.ok(p, 'parsed ' + q); return EG.lookup(db, p.value); };
const names = (r) => r.matches.flatMap((m) => m.names);
const has = (r, n) => assert.ok(names(r).includes(n), 'expected ' + n + ' in ' + names(r).join(','));

// Parser
t('parse 0x80070005', () => assert.deepStrictEqual([EG.parseInput('0x80070005').value, EG.parseInput('0x80070005').read], [0x80070005, 'hex']));
t('parse 80070005 as hex', () => { const p = EG.parseInput('80070005'); assert.strictEqual(p.value, 0x80070005); assert.strictEqual(p.altDecimal, 80070005); });
t('no decimal hint with 0x prefix', () => assert.strictEqual(EG.parseInput('0x80070005').altDecimal, undefined));
t('parse -2147024891', () => assert.strictEqual(EG.parseInput('-2147024891').value, 0x80070005));
t('parse 2147942405', () => assert.strictEqual(EG.parseInput('2147942405').value, 0x80070005));
t('parse 5', () => assert.strictEqual(EG.parseInput('5').value, 5));
t('parse 0xC0000005', () => assert.strictEqual(EG.parseInput('0xC0000005').value, 0xC0000005));
t('parse lower case 0x8024402c', () => assert.strictEqual(EG.parseInput('0x8024402c').value, 0x8024402C));
t('parse inside a sentence', () => assert.strictEqual(EG.parseInput('Install failed with error 0x800F0922 (see CBS.log)').value, 0x800F0922));
t('parse "Error 1603."', () => assert.strictEqual(EG.parseInput('Error 1603.').value, 1603));
t('parse spaced 0x8007 0005', () => assert.strictEqual(EG.parseInput('0x8007 0005').value, 0x80070005));
t('parse unicode minus', () => assert.strictEqual(EG.parseInput('−2147024891').value, 0x80070005));
t('parse C0000005 no prefix', () => assert.strictEqual(EG.parseInput('c0000005').value, 0xC0000005));
t('parse nothing', () => assert.strictEqual(EG.parseInput('hello there'), null));
t('parse empty', () => assert.strictEqual(EG.parseInput('  '), null));
t('parse too big decimal rejected', () => assert.strictEqual(EG.parseInput('99999999999'), null));

// Lookups
t('0x80070005 E_ACCESSDENIED + ERROR_ACCESS_DENIED', () => {
  const r = L('0x80070005'); has(r, 'E_ACCESSDENIED'); has(r, 'ERROR_ACCESS_DENIED');
  assert.strictEqual(r.layout, 'hresult'); assert.strictEqual(r.parts.facility, 7); assert.strictEqual(r.parts.facilityName, 'WIN32');
  assert.strictEqual(r.parts.code, 5); assert.strictEqual(r.parts.severity, 'Failure'); assert.strictEqual(r.win32, 5);
  assert.strictEqual(r.signed, -2147024891); assert.strictEqual(r.unsigned, 2147942405);
  assert.strictEqual(r.matches.find((m) => m.kind === 'win32').message, 'Access is denied.');
});
t('-2147024891 same as 0x80070005', () => { const r = L('-2147024891'); assert.strictEqual(r.hex, '0x80070005'); has(r, 'ERROR_ACCESS_DENIED'); });
t('5 ERROR_ACCESS_DENIED with HRESULT form', () => { const r = L('5'); has(r, 'ERROR_ACCESS_DENIED'); has(r, 'E_ACCESSDENIED'); assert.strictEqual(r.hresultForm, '0x80070005'); assert.strictEqual(r.layout, 'win32'); });
t('0xC0000005 STATUS_ACCESS_VIOLATION', () => { const r = L('0xC0000005'); has(r, 'STATUS_ACCESS_VIOLATION'); assert.strictEqual(r.layout, 'ntstatus'); assert.strictEqual(r.parts.severity, 'Error'); assert.ok(/referenced memory/.test(r.matches[0].message)); });
t('0x8024402C WU_E_PT_WINHTTP_NAME_NOT_RESOLVED', () => { const r = L('0x8024402C'); has(r, 'WU_E_PT_WINHTTP_NAME_NOT_RESOLVED'); assert.strictEqual(r.matches[0].kind, 'wu'); assert.strictEqual(r.parts.facilityName, 'WINDOWSUPDATE'); assert.ok(r.matches[0].message); });
t('0x80244022 WU_E_PT_HTTP_STATUS_SERVICE_UNAVAIL', () => has(L('0x80244022'), 'WU_E_PT_HTTP_STATUS_SERVICE_UNAVAIL'));
t('0x800F0922 decoded as servicing', () => { const r = L('0x800F0922'); assert.strictEqual(r.parts.facility, 15); assert.strictEqual(r.parts.code, 0x922); assert.ok(r.notes.some((n) => /servicing/.test(n))); });
t('0x87D00324 ConfigMgr', () => { const r = L('0x87D00324'); assert.ok(r.configmgr); assert.strictEqual(r.parts.facility, 0x7D0); assert.strictEqual(r.parts.facilityName, 'CONFIGMGR'); assert.strictEqual(r.parts.code, 0x324); });
t('0x80004005 E_FAIL', () => has(L('0x80004005'), 'E_FAIL'));
t('0x80072EE2 WinINet timeout via Win32 12002', () => { const r = L('0x80072EE2'); has(r, 'ERROR_INTERNET_TIMEOUT'); assert.strictEqual(r.win32, 12002); });
t('1603 ERROR_INSTALL_FAILURE', () => has(L('1603'), 'ERROR_INSTALL_FAILURE'));
t('2221 NERR_UserNotFound', () => has(L('2221'), 'NERR_UserNotFound'));
t('0xC000006D STATUS_LOGON_FAILURE', () => has(L('0xC000006D'), 'STATUS_LOGON_FAILURE'));
t('0x800F0101 Setup API section not found', () => has(L('0x800F0101'), 'ERROR_SECTION_NOT_FOUND'));
t('0xD0000022 HRESULT_FROM_NT access denied', () => has(L('0xD0000022'), 'STATUS_ACCESS_DENIED'));
t('0 is success', () => { const r = L('0'); has(r, 'ERROR_SUCCESS'); });
t('fromName for name-only entry', () => assert.strictEqual(EG.fromName('WU_E_PT_HTTP_STATUS_NOT_MAPPED'), 'Server communication: HTTP status not mapped.'));
t('links', () => { const k = EG.links(L('0x80070005')); assert.strictEqual(k.tgh, 'https://techygeekshome.info/?s=0x80070005'); assert.ok(k.learn.startsWith('https://learn.microsoft.com/')); });
t('database size', () => { assert.ok(Object.keys(db.w).length > 3000); assert.ok(Object.keys(db.h).length > 4000); assert.ok(Object.keys(db.n).length > 2500); assert.ok(Object.keys(db.m).length > 3000); });

// ErrorGeek notes: curated codes and fix hints
t('0x87D00324 has own-words ConfigMgr text and a fix', () => { const r = L('0x87D00324'); assert.strictEqual(r.matches[0].kind, 'configmgr'); assert.ok(/detection method/.test(r.matches[0].message)); assert.ok(/AppEnforce\.log/.test(r.hint)); });
t('-2016410844 is 0x87D00324', () => assert.strictEqual(L('-2016410844').hex, '0x87D00324'));
t('0x87D1041C labelled Intune', () => assert.strictEqual(L('0x87D1041C').matches[0].label, 'Intune'));
t('unknown ConfigMgr code still decoded', () => { const r = L('0x87D00ABC'); assert.ok(r.configmgr); assert.strictEqual(r.matches.length, 0); assert.ok(r.notes.some((n) => /not in the offline list/.test(n))); });
t('0x800F081F CBS_E_SOURCE_MISSING with fix', () => { const r = L('0x800F081F'); has(r, 'CBS_E_SOURCE_MISSING'); assert.ok(/Source/.test(r.hint)); });
t('fix hint for 0x80070005', () => assert.ok(/administrator/.test(L('0x80070005').hint)));
t('fix hint for Win32 1603 through its HRESULT form', () => assert.ok(/msiexec/.test(L('1603').hint)));
t('fix hint for 0x80070643', () => { const r = L('0x80070643'); has(r, 'ERROR_INSTALL_FAILURE'); assert.ok(/msiexec/.test(r.hint)); });
t('no hint for an obscure code', () => assert.strictEqual(L('0x8007001F').hint, null));
t('every hint key is a known or curated code', () => { for (const k of Object.keys(db.x)) assert.ok(db.h[k] || db.n[k] || db.c[k] || k.startsWith('8007') || k.startsWith('800F'), k); });
t('no em or en dashes in own text', () => { for (const v of [...Object.values(db.x), ...Object.values(db.c).map((c) => c[1])]) assert.ok(!/[–—]/.test(v), v); });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
