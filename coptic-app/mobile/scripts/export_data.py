#!/usr/bin/env python3
"""Export the CopticPrayers text databases into assets/data for the app.

The APK ships its texts as SQLite databases under assets/ (Katamars, Bible,
Agpeya, Kholagy). This script dumps them as JSON. The app resolves the day's
readings itself, so every date works.

Output (assets/data/, not committed):
    katameros.json   lectionary tables, psalms and liturgical formulas
    agpeya.json      the eight canonical hours
    kholagy.json     the liturgies, with speaker roles
    books.json       the 74 books of the Bible
    bible/<bid>.bible   one book per file: [[chapter, [[verse, ar, sv], ...]], ...]
    index.ts         require() map so Metro bundles the files above

Usage:
    python3 scripts/export_data.py <Coptic.apk or its assets/ directory>
"""

import json
import os
import re
import sqlite3
import sys
import tempfile
import zipfile

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'data')

KHOLAGY = [
    ('vespers', 'عشية', 'Aftontjänst'),
    ('matins', 'باكر', 'Morgontjänst'),
    ('offering', 'تقديم الحمل', 'Lammets offer'),
    ('basil', 'القداس الباسيلي', 'Basilios liturgi'),
    ('gregory', 'القداس الغريغوري', 'Gregorios liturgi'),
    ('cyril', 'القداس الكيرلسي', 'Kyrillos liturgi'),
    ('fraction', 'القسمة', 'Brödbrytelsebön'),
    ('distribution', 'التوزيع', 'Distributionen'),
]
# Kholagy sentence styles in the source database
ROLE = {1: 'priest', 2: 'deacon', 3: 'people'}
KIND = {0: 'p', 4: 'H', 5: 'rubric', 6: 'secret'}


def clean_sv(s):
    if not s:
        return ''
    s = re.sub(r'([.!?])(?=[A-ZÅÄÖ])', r'\1 ', s)
    s = re.sub(r'([,;:])(?=[A-Za-zÅÄÖåäöÉé])', r'\1 ', s)
    return re.sub(r'\s+', ' ', s).strip()


def clean_ar(s):
    if not s:
        return ''
    return re.sub(r'\s+', ' ', s).strip()


def open_assets(path):
    if os.path.isdir(path):
        return path
    tmp = tempfile.mkdtemp(prefix='coptic-apk-')
    with zipfile.ZipFile(path) as z:
        for name in ('Agpeya', 'Katamars', 'Bible', 'Kholagy'):
            z.extract(f'assets/{name}', tmp)
    return os.path.join(tmp, 'assets')


def connect(assets, name):
    return sqlite3.connect(f'file:{os.path.join(assets, name)}?mode=ro', uri=True)


def rows(con, sql, args=()):
    cur = con.execute(sql, args)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


READING_COLS = ['vespers_psalm', 'vespers_psalm_id', 'vespers_gospel', 'matins_psalm', 'matins_psalm_id',
                'matins_gospel', 'pauline', 'catholic', 'praxis', 'psalm', 'psalm_id', 'gospel', 'prophecies']


def reading_row(r):
    return {k: r[k] for k in READING_COLS if k in r and r[k] not in (None, '')}


def export_katameros(kat):
    days = {f"{r['month']}-{r['day']}": reading_row(r) for r in rows(kat, 'select * from days')}
    relations = {f"{r['month']}-{r['day']}": f"{r['instead_month']}-{r['instead_day']}"
                 for r in rows(kat, 'select * from days_relations')}
    sundays = [dict(month=r['month'], n=r['sunday_number'], **reading_row(r))
               for r in rows(kat, 'select * from sundays order by rowid')]
    lent = {str(r['_id']): reading_row(r) for r in rows(kat, 'select * from great_lent')}
    fifty = {str(r['_id']): reading_row(r) for r in rows(kat, 'select * from fifty_feast')}
    psalms = {str(r['_id']): [r['reference'], clean_ar(r['arabic']), clean_sv(r['swedish'])]
              for r in rows(kat, 'select * from Psalms')}
    formulas = {}
    for r in rows(kat, 'select reading, arabic, swedish from repeated_sentences order by rowid'):
        formulas.setdefault(r['reading'], []).append([clean_ar(r['arabic']), clean_sv(r['swedish'])])
    return dict(days=days, relations=relations, sundays=sundays, lent=lent, fifty=fifty,
                psalms=psalms, formulas=formulas)


def export_agpeya(agp):
    hours = []
    for h in rows(agp, 'select * from pray_hours order by pray_id'):
        units = [{'t': ['p', 'h', 'H'][s['is_title'] or 0], 'ar': clean_ar(s['arabic']), 'sv': clean_sv(s['swedish'])}
                 for s in rows(agp, 'select s.* from prays_relations r join sentences s on s._id = r.sentence_id '
                                    'where r.pray_id=? order by r.rowid', (h['pray_id'],))]
        hours.append({'id': h['pray_image'], 'ar': clean_ar(h['title_arabic']), 'sv': clean_sv(h['title_swedish']), 'units': units})
    return hours


def export_kholagy(kho):
    out = []
    for pid, (key, ar, sv) in enumerate(KHOLAGY):
        units = []
        for s in rows(kho, 'select s.* from prays_relations r join sentences s on s._id = r.sentence_id '
                           'where r.pray_id=? order by r._id', (pid,)):
            style = s['style'] or 0
            if style in ROLE:
                units.append({'t': 'role', 'r': ROLE[style]})
            else:
                units.append({'t': KIND.get(style, 'p'), 'ar': clean_ar(s['arabic']), 'sv': clean_sv(s['swedish'])})
        out.append({'id': key, 'ar': ar, 'sv': sv, 'units': units})
    return out


def export_bible(bible):
    books = []
    files = {}
    for b in rows(bible, 'select * from bible_books order by _id'):
        bid = b['bid']
        chapters = {}
        for v in rows(bible, 'select cid, vid, vtd, vse from bible where bid=? order by cid, vid', (bid,)):
            chapters.setdefault(v['cid'], []).append([v['vid'], clean_ar(v['vtd']), clean_sv(v['vse'])])
        files[bid] = [[c, vs] for c, vs in sorted(chapters.items())]
        books.append({'bid': bid, 'ar': clean_ar(b['arabic']), 'sv': clean_sv(b['swedish']),
                      'chapters': len(chapters), 'nt': 46 <= bid <= 72})
    return books, files


def write_json(name, data):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(path)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    assets = open_assets(sys.argv[1])
    sizes = {
        'katameros.json': write_json('katameros.json', export_katameros(connect(assets, 'Katamars'))),
        'agpeya.json': write_json('agpeya.json', export_agpeya(connect(assets, 'Agpeya'))),
        'kholagy.json': write_json('kholagy.json', export_kholagy(connect(assets, 'Kholagy'))),
    }
    books, files = export_bible(connect(assets, 'Bible'))
    sizes['books.json'] = write_json('books.json', books)
    sizes['bible/*.bible'] = sum(write_json(f'bible/{bid}.bible', data) for bid, data in files.items())

    with open(os.path.join(OUT, 'index.ts'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/export_data.py. Do not edit.\n')
        f.write("import type { BibleBook, KatamerosData, Prayer } from '../../src/lib/types';\n\n")
        f.write("export const katameros: KatamerosData = require('./katameros.json');\n")
        f.write("export const agpeya: Prayer[] = require('./agpeya.json');\n")
        f.write("export const kholagy: Prayer[] = require('./kholagy.json');\n")
        f.write("export const books: BibleBook[] = require('./books.json');\n\n")
        f.write('// Bible books are assets, loaded on demand.\n')
        f.write('export const bibleAssets: Record<number, number> = {\n')
        for bid in sorted(files):
            f.write(f"  {bid}: require('./bible/{bid}.bible'),\n")
        f.write('};\n')
    for k, v in sizes.items():
        print(f'{k:16} {v / 1024:8.0f} KB', file=sys.stderr)


if __name__ == '__main__':
    main()
