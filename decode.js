// ErrorGeek decoder: turns typed or selected text into an error code and looks it up
// in the offline database (errors.json). Works in the extension pages and in Node (tests).
(function (root) {
  'use strict';

  const hex8 = (v) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const signed = (v) => v | 0;

  // Finds the first thing in the text that looks like an error code.
  // Returns { value, read: 'hex' | 'decimal', token, altDecimal? } or null.
  function parseInput(text) {
    if (text == null) return null;
    let s = String(text).trim();
    if (!s) return null;
    s = s.replace(/[‐-―−]/g, '-');           // fancy minus signs
    const compact = s.replace(/(0x)?([0-9a-f]{4})[\s_'`]([0-9a-f]{4})\b/i, (m, p, a, b) => (p || '') + a + b);
    const tries = [
      // 0x80070005, 0X5, 0x8007_0005
      { re: /(?:^|[^0-9a-z])(0x[0-9a-f]{1,8})(?![0-9a-z])/i, read: 'hex', strip: 2 },
      // 8 hex digits with no prefix: 80070005, C0000005, 8024402c
      { re: /(?:^|[^0-9a-z\-])([0-9a-f]{8})(?![0-9a-z])/i, read: 'hex', strip: 0 },
      // hex with letters and no prefix (fewer digits), like 2EE2 or 7D0
      { re: /(?:^|[^0-9a-z\-])((?=[0-9a-f]*[a-f])[0-9a-f]{3,7}h?)(?![0-9a-z])/i, read: 'hex', strip: 0, weak: true },
      // signed or unsigned decimal: -2147024891, 2147942405, 1603, 5
      { re: /(?:^|[^0-9a-z.])(-?\d{1,10})(?![0-9a-z]|\.\d)/i, read: 'decimal', strip: 0 },
    ];
    for (const t of tries) {
      const m = compact.match(t.re);
      if (!m) continue;
      let tok = m[1];
      if (t.weak && /^[a-z]{3,}$/i.test(tok)) continue;   // plain words like "bad" or "face"
      if (t.read === 'hex') {
        const digits = tok.slice(t.strip).replace(/h$/i, '');
        const value = parseInt(digits, 16) >>> 0;
        const out = { value, read: 'hex', token: tok };
        if (t.strip === 0 && /^\d{8}$/.test(digits)) out.altDecimal = parseInt(digits, 10) >>> 0;
        return out;
      }
      const n = Number(tok);
      if (!Number.isFinite(n) || n < -2147483648 || n > 4294967295) continue;
      return { value: n >>> 0, read: 'decimal', token: tok };
    }
    return null;
  }

  const AREAS = {
    WU: { PT: 'server communication', DM: 'download manager', UH: 'update handler', DS: 'data store',
          AU: 'Automatic Updates', AUCLIENT: 'Automatic Updates client', INVENTORY: 'inventory', EE: 'expression evaluator',
          REPORTER: 'reporting', SETUP: 'agent setup', DRV: 'driver', SIH: 'service healing', XML: 'XML', SLS: 'service list',
          WUTASK: 'scheduled task', OOBE: 'out of box experience', EP: 'endpoint', SETUPFAILED: 'setup', MSI: 'Windows Installer' },
  };
  const WORDS = { WINHTTP: 'WinHTTP', HTTP: 'HTTP', DNS: 'DNS', RPC: 'RPC', BITS: 'BITS', COM: 'COM', SSL: 'SSL', TLS: 'TLS',
    XML: 'XML', URL: 'URL', ID: 'ID', GUID: 'GUID', MSI: 'MSI', SID: 'SID', ACL: 'ACL', DLL: 'DLL', EXE: 'EXE', EULA: 'EULA',
    EULAS: 'EULAs', UNAVAIL: 'unavailable', REQ: 'required', AUTH: 'authentication', SUP: 'supported', TPM: 'TPM', VHD: 'VHD',
    WSUS: 'WSUS', SUS: 'WSUS', CAB: 'cab', ECP: 'external cab processing', NOTDOWNLOADED: 'not downloaded',
    INVALIDMETADATA: 'invalid metadata', INCORRECTFILEHASH: 'incorrect file hash', NODATA: 'no data', MAX: 'maximum' };

  // A readable phrase built from a symbolic name, used only when there is no message text.
  function fromName(name) {
    let n = name, area = '';
    let m = n.match(/^WU_[ES]_([A-Z]+)_(.+)$/);
    if (m && AREAS.WU[m[1]]) { area = AREAS.WU[m[1]]; n = m[2]; }
    else n = n.replace(/^(WU_[ES]_|ERROR_DS_|ERROR_|STATUS_|E_|S_|[A-Z0-9]+_E_|[A-Z0-9]+_S_|NERR_)/, (p) => {
      if (p === 'ERROR_DS_') area = 'directory service';
      return '';
    });
    const words = n.split(/_+|(?<=[a-z])(?=[A-Z])/).filter(Boolean).map((w) => WORDS[w.toUpperCase()] || w.toLowerCase());
    let s = words.join(' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return (area ? area.charAt(0).toUpperCase() + area.slice(1) + ': ' + (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s) : s) + '.';
  }

  const NT_SEV = ['Success', 'Information', 'Warning', 'Error'];

  function entry(db, kind, label, code, names, extra) {
    const name = names[0];
    const msgName = names.find((n) => db.m[n]);
    const e = { kind, label, code, names, name, message: msgName ? db.m[msgName] : null,
      source: msgName ? ({ w: 'Wine', r: 'ReactOS', e: 'ErrorGeek note' }[db.src[msgName]] || '') : '' };
    if (!e.message) e.guess = fromName(name);
    return Object.assign(e, extra || {});
  }

  function lookup(db, value) {
    const v = value >>> 0;
    const r = { value: v, hex: hex8(v), unsigned: v, signed: signed(v), matches: [], notes: [] };
    const H = (x) => db.h[(x >>> 0).toString(16).toUpperCase()];
    const N = (x) => db.n[(x >>> 0).toString(16).toUpperCase()];
    const W = (x) => db.w[String(x)];

    if (v <= 0xFFFF) {
      const w = W(v);
      if (w) r.matches.push(entry(db, 'win32', 'Win32 error', String(v), w));
      const asH = v === 0 ? 0 : (0x80070000 | v) >>> 0;
      r.hresultForm = hex8(asH);
      const h = H(asH);
      if (h && v !== 0) r.matches.push(entry(db, 'hresult', 'HRESULT', hex8(asH), h, { via: 'Same error as an HRESULT' }));
      if (!w) {
        const n = N(v);
        if (n) r.matches.push(entry(db, 'ntstatus', 'NTSTATUS', hex8(v), n));
      }
      r.layout = 'win32';
    } else {
      const sev = v >>> 31, rbit = (v >>> 30) & 1, cbit = (v >>> 29) & 1, nbit = (v >>> 28) & 1;
      const fac = (v >>> 16) & 0x7FF, code = v & 0xFFFF;
      const n = N(v), h = H(v);
      const top = v >>> 30;
      const wrappedNt = !n && !h && nbit && sev;
      const isNt = !wrappedNt && (Boolean(n && !h) || (!h && (top === 3 || top === 1)) || Boolean(n && h && top === 3));
      if (isNt) {
        const nfac = (v >>> 16) & 0xFFF;
        r.layout = 'ntstatus';
        r.parts = { severity: NT_SEV[v >>> 30], customer: !!cbit, facility: nfac, facilityName: db.fn[nfac] || null, code };
      } else {
        r.layout = 'hresult';
        r.parts = { severity: sev ? 'Failure' : 'Success', customer: !!cbit, ntMapped: !!nbit, reserved: !!rbit,
          facility: fac, facilityName: db.fh[fac] || null, code };
      }
      if (h) {
        const wu = fac === 36 && !isNt;
        r.matches.push(entry(db, wu ? 'wu' : 'hresult', wu ? 'Windows Update' : 'HRESULT', hex8(v), h));
      }
      if (n) r.matches.push(entry(db, 'ntstatus', 'NTSTATUS', hex8(v), n));
      if (!isNt) {
        if (fac === 7 && sev) {
          const w = W(code);
          if (w) r.matches.push(entry(db, 'win32', 'Win32 error', String(code), w, { via: 'Underlying Win32 error ' + code }));
          r.win32 = code;
        }
        if (nbit && sev) {
          const nt = (v & ~0x10000000) >>> 0, nn = N(nt);
          if (nn) r.matches.push(entry(db, 'ntstatus', 'NTSTATUS', hex8(nt), nn, { via: 'Wrapped NTSTATUS ' + hex8(nt) }));
        }
        if (fac === 15 && sev) {
          const s = db.s[(code & 0x7FFF).toString(16).toUpperCase()];
          if (s) r.matches.push(entry(db, 'setupapi', 'Setup API', hex8((0xE0000000 | (code & 0x7FFF)) >>> 0), s, { via: 'Setup API error' }));
          if (!s && code >= 0x800 && code < 0xA00) r.notes.push('Facility 15 codes in the 0x800F08xx and 0x800F09xx range come from Windows servicing (CBS and DISM), used when installing updates, features and language packs.');
        }
        if ((fac === 0x7D0 || fac === 0x7D1) && sev) {
          r.configmgr = true;
          if (r.parts) r.parts.facilityName = 'CONFIGMGR';
        }
        if (fac === 4 && !h) r.notes.push('FACILITY_ITF codes are defined by each COM interface, so the same number can mean different things in different programs.');
      }
      if ((v & 0xE0000000) === 0xE0000000 && !n && !h) {
        const s = db.s[(v & 0x7FFF).toString(16).toUpperCase()];
        if (s) r.matches.push(entry(db, 'setupapi', 'Setup API', hex8(v), s));
      }
    }
    // ErrorGeek's own notes: common codes that no open source header lists, and fix hints.
    const key = r.hex.slice(2);
    const c = db.c && db.c[key];
    if (c && !r.matches.some((m) => m.code === r.hex)) {
      const kind = r.configmgr ? 'configmgr' : (r.parts && r.parts.facility === 15 ? 'servicing' : 'hresult');
      const label = { configmgr: (r.parts.facility === 0x7D1 ? 'Intune' : 'ConfigMgr'), servicing: 'Servicing', hresult: 'HRESULT' }[kind];
      r.matches.unshift({ kind, label, code: r.hex, names: c[0] ? [c[0]] : [], name: c[0] || '', message: c[1], source: 'ErrorGeek note' });
    }
    if (r.configmgr) r.notes.push(c ? 'Configuration Manager (SCCM) and Intune client code. Check the client logs named in the fix.'
      : 'This is a Configuration Manager (SCCM) or Intune client code that is not in the offline list. Use the search links below.');
    const x = db.x || {};
    r.hint = x[key] || (r.hresultForm && x[r.hresultForm.slice(2)]) || null;
    r.found = r.matches.length > 0;
    return r;
  }

  function searchTerm(r) {
    return r.layout === 'win32' ? String(r.value) : r.hex;
  }
  function links(r) {
    const t = searchTerm(r);
    const learn = r.layout === 'win32' ? 'error ' + t : t;
    return {
      tgh: 'https://techygeekshome.info/?s=' + encodeURIComponent(t),
      learn: 'https://learn.microsoft.com/en-gb/search/?terms=' + encodeURIComponent(learn),
    };
  }

  const api = { parseInput, lookup, links, fromName, hex8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ErrorGeek = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
