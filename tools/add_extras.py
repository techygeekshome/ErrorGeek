#!/usr/bin/env python3
"""Adds ErrorGeek's own notes (tools/extras.json) to errors.json: curated codes ('c') and fix hints ('x').
Safe to run more than once. build_db.py runs it at the end. Usage: add_extras.py [errors.json]"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'errors.json')
ex = json.load(open(os.path.join(HERE, 'extras.json'), encoding='utf-8'))
db = json.load(open(OUT, encoding='utf-8'))
for k in list(ex['codes']) + list(ex['hints']):
    assert re.fullmatch(r'[0-9A-F]{8}', k), k
for k, v in list(ex['codes'].items()) + list(ex['hints'].items()):
    s = v if isinstance(v, str) else v[1]
    assert '—' not in s and '–' not in s, k
db['c'] = ex['codes']
db['x'] = ex['hints']
json.dump(db, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print('codes', len(db['c']), 'hints', len(db['x']), 'bytes', os.path.getsize(OUT))
