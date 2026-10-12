#!/usr/bin/env python3
"""Builds errors.json, the offline ErrorGeek database, from open source headers and message files.

Sources (see README.md for licences):
  WINE  = a checkout of https://gitlab.winehq.org/wine/wine (mirror github.com/wine-mirror/wine), LGPL-2.1-or-later
  ROS   = a checkout of https://github.com/reactos/reactos, GPL-2.0-or-later
  MINGW = a checkout of https://github.com/mingw-w64/mingw-w64 (headers are public domain)

Usage: build_db.py WINE ROS MINGW OUT.json
"""
import json, os, re, sys

WINE, ROS, MINGW, OUT = sys.argv[1:5]

DEF = re.compile(r'^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.+?)\s*(?:/\*.*)?(?://.*)?$')
SKIP_NAME = re.compile(r'^(_|FACILITY_|SEVERITY_|STATUS_SEVERITY_|__|WINE_|.*_H$|.*_H_$|MAKE_|HRESULT_|SCODE_|SUCCEEDED|FAILED|IS_ERROR|HRESULT_CODE|NT_|GetScode|ResultFromScode)')


def read_defines(path):
    out = {}
    if not os.path.exists(path):
        print('missing', path); return out
    for line in open(path, encoding='utf-8', errors='replace'):
        m = DEF.match(line.rstrip())
        if not m: continue
        name, expr = m.group(1), m.group(2).strip()
        if '(' in name: continue
        out.setdefault(name, expr)
    return out


def evaluate(name, defs, seen=None):
    seen = seen or set()
    if name in seen or name not in defs: return None
    seen = seen | {name}
    e = defs[name]
    e = re.sub(r'\((?:HRESULT|NTSTATUS|DWORD|LONG|ULONG|SCODE|int|long|unsigned long|unsigned int)\)', '', e)
    e = re.sub(r'\b(?:_HRESULT_TYPEDEF_|_NDIS_ERROR_TYPEDEF_|_SCODE_TYPEDEF_)\b', '', e)
    def h32(m):
        v = sub_eval(m.group(1), defs, seen)
        if v is None: return 'None'
        return str(v if v <= 0 or v & 0x80000000 else (v & 0xFFFF) | 0x80070000)
    e = re.sub(r'\b_*HRESULT_FROM_WIN32\(([^()]*)\)', h32, e)
    return sub_eval(e, defs, seen)


def sub_eval(e, defs, seen):
    e = re.sub(r'\b(0[xX][0-9a-fA-F]+|\d+)[uUlL]+\b', r'\1', e)
    def rep(m):
        n = m.group(0)
        if re.match(r'^0[xX]', n) or n.isdigit(): return n
        v = evaluate(n, defs, seen)
        return 'None' if v is None else str(v)
    e2 = re.sub(r'\b[A-Za-z_]\w*\b', rep, e)
    if 'None' in e2 or not re.fullmatch(r'[\s0-9a-fA-FxX()+\-|&<>~*]+', e2): return None
    try:
        v = eval(e2, {'__builtins__': {}}, {})
    except Exception:
        return None
    return int(v) & 0xFFFFFFFF if isinstance(v, int) else None


def read_mc(path, lang):
    """Returns {SymbolicName: message} for one language of a .mc file."""
    if not os.path.exists(path):
        print('missing', path); return {}
    t = open(path, encoding='utf-8', errors='replace').read().replace('\r', '')
    out = {}
    for block in re.split(r'\n(?=MessageId=)', t):
        m = re.search(r'SymbolicName=(\w+)', block)
        if not m: continue
        mm = re.search(r'\nLanguage=' + lang + r'\n(.*?)\n\.(?:\n|$)', block, re.S)
        if mm: out.setdefault(m.group(1), mm.group(1))
    return out


def clean(msg, name):
    if msg is None: return None
    s = msg.strip()
    s = s.replace('%n', '\n').replace('%r', '').replace('%0\n', '\n').replace('%%', '%').replace('%.', '.')
    s = re.sub(r'%0(?![0-9])', '', s)
    s = re.sub(r'%(\d+)!.*?!', r'%\1', s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s).strip()
    if not s or s == name or re.fullmatch(r'[A-Z0-9_]+', s): return None
    return s

# ---- collect defines -------------------------------------------------------
wine_inc = os.path.join(WINE, 'include')
mgw_inc = os.path.join(MINGW, 'mingw-w64-headers', 'include')

winerr = {}
for p in (os.path.join(wine_inc, 'winerror.h'), os.path.join(mgw_inc, 'winerror.h')):
    for k, v in read_defines(p).items(): winerr.setdefault(k, v)
nt = {}
for p in (os.path.join(wine_inc, 'ntstatus.h'), os.path.join(mgw_inc, 'ntstatus.h'), os.path.join(ROS, 'sdk/include/psdk/ntstatus.h')):
    for k, v in read_defines(p).items(): nt.setdefault(k, v)
wu = read_defines(os.path.join(mgw_inc, 'wuerror.h'))
lm = read_defines(os.path.join(wine_inc, 'lmerr.h'))
inet = read_defines(os.path.join(wine_inc, 'wininet.h'))
whttp = read_defines(os.path.join(wine_inc, 'winhttp.h'))
setup = read_defines(os.path.join(wine_inc, 'setupapi.h'))
setup.setdefault('APPLICATION_ERROR_MASK', '0x20000000')
setup.setdefault('ERROR_SEVERITY_ERROR', '0xC0000000')
for k, v in winerr.items(): wu.setdefault(k, v)

# ---- messages --------------------------------------------------------------
msgs = {}   # name -> (text, source)
for name, text in read_mc(os.path.join(ROS, 'sdk/include/reactos/mc/errcodes.mc'), 'English').items():
    c = clean(text, name)
    if c: msgs.setdefault(name, (c, 'r'))
for name, text in read_mc(os.path.join(WINE, 'dlls/kernelbase/winerror.mc'), 'ENU').items():
    c = clean(text, name)
    if c: msgs.setdefault(name, (c, 'w'))
for name, text in read_mc(os.path.join(WINE, 'dlls/wininet/winineterror.mc'), 'ENU').items():
    c = clean(text, name)
    if c: msgs.setdefault(name, (c, 'w'))
for name, text in read_mc(os.path.join(ROS, 'sdk/include/reactos/mc/netmsgmsg.mc'), 'English').items():
    if name.startswith('NERR_'):
        c = clean(text, name)
        if c: msgs.setdefault(name, (c, 'r'))
for name, text in read_mc(os.path.join(ROS, 'sdk/include/reactos/mc/ntstatus.mc'), 'English').items():
    c = clean(text, name)
    if c: msgs.setdefault(name, (c, 'r'))

# Short notes written for ErrorGeek (own words) for common Windows Update codes,
# which have no message text in any open source header.
NOTES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notes.json')))
for name, text in NOTES.items():
    msgs.setdefault(name, (text, 'e'))

# ---- tables ----------------------------------------------------------------
W, H, N = {}, {}, {}

def add(table, code, name):
    lst = table.setdefault(code, [])
    if name not in lst: lst.append(name)

for name in winerr:
    v = evaluate(name, winerr)
    if v is None: continue
    if name in ('S_OK', 'S_FALSE', 'NOERROR'):
        add(H, v, name); continue
    if SKIP_NAME.match(name): continue
    if v < 0x10000 and not re.match(r'^(S_|E_|CO_|RPC_E_|DRAGDROP_|CLASS_|MK_|OLE_|DV_|VIEW_|REGDB_|CACHE_|CONVERT10_|CLIPBRD_|DATA_|CS_|INPLACE_|ENUM_|STG_|MEM_)', name):
        add(W, v, name)
    elif v >= 0x10000:
        add(H, v, name)
for name in nt:
    if SKIP_NAME.match(name): continue
    if not re.match(r'^(STATUS_|DBG_|RPC_NT_|EPT_NT_|NDIS_|NT_STATUS_)', name): continue
    v = evaluate(name, nt)
    if v is None: continue
    add(N, v, name)
for name in wu:
    if not re.match(r'^WU_[SE]_', name): continue
    v = evaluate(name, wu)
    if v is not None: add(H, v, name)
for defs, pat in ((lm, r'^NERR_'), (inet, r'^ERROR_(INTERNET|FTP|GOPHER|HTTP)_'), (whttp, r'^ERROR_WINHTTP_')):
    for name in defs:
        if not re.match(pat, name): continue
        v = evaluate(name, defs)
        if v is not None and v < 0x10000: add(W, v, name)
S = {}
for name in setup:
    if not name.startswith('ERROR_'): continue
    v = evaluate(name, setup)
    if v is not None and (v & 0xE0000000) == 0xE0000000: add(S, v & 0xFFFF, name)

# Facility names (HRESULT)
FH = {}
for name in winerr:
    if name.startswith('FACILITY_'):
        v = evaluate(name, winerr)
        if v is not None and v < 0x2000 and v not in FH: FH[v] = name[9:]
FH.setdefault(0x7D0, 'CONFIGMGR')
FN = {0: 'SYSTEM', 1: 'DEBUGGER', 2: 'RPC_RUNTIME', 3: 'RPC_STUBS', 4: 'IO_ERROR_CODE', 5: 'CODCLASS_ERROR_CODE',
      7: 'NTWIN32', 8: 'NTCERT', 9: 'NTSSPI', 0xA: 'TERMINAL_SERVER', 0xB: 'MUI_ERROR_CODE', 0x10: 'USB_ERROR_CODE',
      0x11: 'HID_ERROR_CODE', 0x12: 'FIREWIRE_ERROR_CODE', 0x13: 'CLUSTER_ERROR_CODE', 0x14: 'ACPI_ERROR_CODE',
      0x15: 'SXS_ERROR_CODE', 0x19: 'TRANSACTION', 0x1A: 'COMMONLOG', 0x1B: 'VIDEO', 0x1C: 'FILTER_MANAGER',
      0x1D: 'MONITOR', 0x1E: 'GRAPHICS_KERNEL', 0x20: 'DRIVER_FRAMEWORK', 0x21: 'FVE_ERROR_CODE', 0x22: 'FWP_ERROR_CODE',
      0x23: 'NDIS_ERROR_CODE', 0x27: 'QUIC_ERROR_CODE', 0x28: 'TPM', 0x29: 'RTPM', 0x32: 'HYPERVISOR', 0x33: 'IPSEC',
      0x34: 'VIRTUALIZATION', 0x35: 'VOLMGR', 0x36: 'BCD_ERROR_CODE', 0x37: 'WIN32K_NTUSER', 0x38: 'WIN32K_NTGDI',
      0x39: 'RESUME_KEY_FILTER', 0x3A: 'RDBSS', 0x3B: 'BTH_ATT', 0x3C: 'SECUREBOOT', 0x3D: 'AUDIO_KERNEL', 0x3E: 'VSM',
      0x40: 'VOLSNAP', 0x41: 'SDBUS', 0x42: 'SHARED_VHDX', 0x43: 'SMB', 0x44: 'XVS', 0x48: 'INTERIX', 0x49: 'SPACES',
      0x4A: 'SECURITY_AUDITING', 0x4B: 'SYSTEM_INTEGRITY', 0x4C: 'LICENSING', 0x4D: 'PLATFORM_MANIFEST', 0x4E: 'APP_EXEC',
      0x81: 'MAXIMUM_VALUE', 0xE8: 'IORING', 0xE9: 'OFFLOAD'}
# NTSTATUS facility names from ntstatus.h FACILITY_* when present
for name in nt:
    if name.startswith('FACILITY_'):
        v = evaluate(name, nt)
        if v is not None and v < 0x1000: FN.setdefault(v, name[9:])

names = set()
for t in (W, H, N, S):
    for lst in t.values(): names.update(lst)
M, SRC = {}, {}
for n in sorted(names):
    if n in msgs:
        M[n] = msgs[n][0]; SRC[n] = msgs[n][1]

def rank(n):
    return (0 if n in msgs else 1, 0 if re.match(r'^(ERROR_|E_|STATUS_|WU_E_|S_OK)', n) else 1)

def enc(table, hexkey):
    return {(format(k, 'X') if hexkey else str(k)): sorted(v, key=rank) for k, v in sorted(table.items())}

db = {
    'v': 1,
    'w': enc(W, False),          # Win32 error code (decimal) -> [names]
    'h': enc(H, True),           # HRESULT (hex) -> [names]
    'n': enc(N, True),           # NTSTATUS (hex) -> [names]
    's': enc(S, True),           # Setup API (low 16 bits, hex) -> [names]
    'm': M,                      # name -> message
    'src': SRC,                  # name -> source key (w Wine, r ReactOS, e ErrorGeek note)
    'fh': {str(k): v for k, v in sorted(FH.items())},
    'fn': {str(k): v for k, v in sorted(FN.items())},
}
json.dump(db, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
wu_count = sum(1 for k in H if (k >> 16) & 0x7FF == 36)
import subprocess
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'add_extras.py'), OUT], check=True)
print(f'win32 {len(W)}  hresult {len(H)} (windows update {wu_count})  ntstatus {len(N)}  setupapi {len(S)}  messages {len(M)}  bytes {os.path.getsize(OUT)}')
