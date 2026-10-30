#!/usr/bin/env python3
"""Export the order of Holy Week (Pascha), from Lazarus Saturday to Easter.

The pack (Coptic_Orthodox_Holy_Week_..._v1.zip) holds the days in their
order, the readings of each service as references, the Pascha praise
"Thok te ti gom" with the invocations added as the week goes on, and Tennav.
The readings' text comes from the app's own Bible: this writes references in
the form the Katameros uses ("isa 5 : 1 - 9 / jer 9 : 12 - 19"), and checks
that each one is in the Bible.

Writes assets/holyweek/holyweek.json (not checked in, like the other texts).

Usage:
    python3 scripts/export_holy_week.py <pack.zip>
"""

import json
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'holyweek')
BOOKS = os.path.join(ROOT, 'assets', 'data', 'books.json')

# OSIS book codes → the Katameros abbreviations (src/lib/refs.ts).
OSIS = {
    'GEN': 'gen', 'EXO': 'ex', 'LEV': 'lev', 'NUM': 'num', 'DEU': 'deut', 'JOS': 'josh', '1SA': '1sam',
    '1KI': '1kings', '1CH': '1chron', 'JOB': 'job', 'PSA': 'ps', 'PRO': 'prov', 'WIS': 'wis', 'SIR': 'sir',
    'ISA': 'isa', 'JER': 'jer', 'LAM': 'lam', 'BAR': 'bar', 'EZK': 'ezek', 'DAN': 'dan', 'HOS': 'hos',
    'JOL': 'joel', 'AMO': 'amos', 'JON': 'jonah', 'MIC': 'mic', 'NAM': 'nah', 'HAB': 'hab', 'ZEP': 'zeph',
    'ZEC': 'zech', 'MAL': 'mal', 'MAT': 'matt', 'MRK': 'mark', 'LUK': 'luke', 'JHN': 'john', 'ACT': 'acts',
    '1CO': '1cor', 'GAL': 'gal', 'EPH': 'eph', 'PHP': 'phil', 'COL': 'col', '1TI': '1tim', '1PE': '1pet',
}

DAYS_SV = {
    'lazarus_saturday': 'Lasarus lördag', 'palm_sunday': 'Palmsöndagen', 'holy_monday': 'Måndag i påskveckan',
    'holy_tuesday': 'Tisdag i påskveckan', 'holy_wednesday': 'Onsdag i påskveckan', 'covenant_thursday': 'Skärtorsdagen',
    'good_friday': 'Långfredagen', 'bright_saturday': 'Ljusets lördag', 'resurrection_sunday': 'Påskdagen',
}

# The services in Swedish: a night's hours are "the night to Monday, first hour" and so on.
SERVICE_SV = {
    'عشية': 'Aftonen', 'باكر': 'Morgonen, första timmen', 'الثالثة': 'Tredje timmen', 'السادسة': 'Sjätte timmen',
    'التاسعة': 'Nionde timmen', 'الحادية عشرة': 'Elfte timmen', 'الثانية عشرة': 'Tolfte timmen', 'القداس': 'Liturgin',
    'التوزيع': 'Distributionen', 'الجناز العام - السادسة': 'Den allmänna begravningsbönen, sjätte timmen',
    'لقان خميس العهد': 'Fottvagningen', 'الأبوغلمسيس': 'Apocalypsis-natten', 'ليلة القيامة': 'Påsknatten',
    'تسبحة القيامة': 'Uppståndelsens lovsång',
}
NIGHT_SV = {'ليلة الاثنين': 'måndag', 'ليلة الثلاثاء': 'tisdag', 'ليلة الأربعاء': 'onsdag', 'ليلة الخميس': 'torsdag', 'ليلة الجمعة': 'fredag'}
HOUR_SV = {'الأولى': 'första timmen', 'الثالثة': 'tredje timmen', 'السادسة': 'sjätte timmen', 'التاسعة': 'nionde timmen', 'الحادية عشرة': 'elfte timmen'}

KINDS = {
    'نبوة': ('prophecy', 'Profetia'), 'إنجيل': ('gospel', 'Evangelium'), 'مزمور': ('psalm', 'Psalm'),
    'بولس': ('pauline', 'Paulus brev'), 'كاثوليكون': ('catholic', 'Katholikon'), 'إبركسيس': ('praxis', 'Praxis'),
    'تسبحة كتابية': ('ode', 'Biblisk lovsång'),
}

# The hours of the Pascha, Monday to Friday, in which the praise is said.
PASCHA_DAYS = {'holy_monday', 'holy_tuesday', 'holy_wednesday', 'covenant_thursday', 'good_friday'}
PASCHA_HOURS = ('باكر', 'الأولى', 'الثالثة', 'السادسة', 'التاسعة', 'الحادية عشرة', 'الثانية عشرة')


def service_sv(name):
    if name in SERVICE_SV:
        return SERVICE_SV[name]
    night, _, hour = name.partition(' - ')
    if night in NIGHT_SV and hour in HOUR_SV:
        return f'Natten till {NIGHT_SV[night]}, {HOUR_SV[hour]}'
    sys.exit(f'No Swedish name for the service {name}')


def to_ref(osis, passage):
    """'تك 1:1-31؛ 2:1-2' → 'gen 1 : 1 - 31 / gen 2 : 1 - 2'; 'مز 10-11' → 'ps 10 / ps 11'."""
    book = OSIS[osis]
    rest = re.sub(r'^\S+\s+', '', passage.strip())
    parts = []
    for part in re.split(r'\s*؛\s*', rest):
        part = part.replace('،', ',').replace('–', '-').strip()
        if ':' not in part and '-' in part:
            parts += [f'{book} {c}' for c in range(int(part.split('-')[0]), int(part.split('-')[1]) + 1)]
            continue
        part = re.sub(r'\s*([:,-])\s*', r' \1 ', part)
        parts.append(f'{book} {part}')
    return ' / '.join(parts)


def lxx_to_hebrew(ch):
    """The church's psalm number (the Septuagint's) → the app's Bible (the Hebrew's), or None where
    one psalm of one is two of the other and the verse would have to decide (9, 113-115, 146-147)."""
    if ch <= 8 or ch >= 148:
        return ch
    if ch in (9, 113, 114, 115, 146, 147):
        return None
    return ch + 1


def psalm_ref(passage):
    """'مز 87:3؛ 43:19،22' → 'ps 88 : 3 / ps 44 : 19 , 22' in the Bible's numbering, the verses as they are
    (as the Katameros' psalms are given, src/lib/refs.ts psalmLabel); None when a psalm can't be renumbered."""
    parts = []
    for part in to_ref('PSA', passage).split(' / '):
        m = re.match(r'ps (\d+)(.*)$', part)
        ch = lxx_to_hebrew(int(m.group(1)))
        if ch is None:
            return None
        parts.append(f'ps {ch}{m.group(2)}')
    return ' / '.join(parts)


def check(ref, books, bible):
    """Every chapter and verse the reference names is in the Bible."""
    for part in ref.split(' / '):
        m = re.match(r'(\S+) (\d+)(?: : (.*))?$', part)
        bid = ABBR.index(m.group(1))
        chapters = dict(bible(bid))
        ch = int(m.group(2))
        if ch not in chapters:
            return f'{part}: no chapter {ch}'
        nums = [int(n) for n in re.findall(r'\d+', m.group(3) or '')]
        verses = {v[0] for v in chapters[ch]}
        # Across chapters ("1 : 16 - 3 : 23") only the first chapter's verse is checked here.
        if nums and nums[0] not in verses:
            return f'{part}: no verse {nums[0]}'
    return None


ABBR = []


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    z = zipfile.ZipFile(sys.argv[1])
    name = next(n for n in z.namelist() if n.endswith('library_all_in_one.json'))
    pack = json.loads(z.read(name).decode('utf-8'))

    refs_ts = open(os.path.join(ROOT, 'src', 'lib', 'refs.ts'), encoding='utf-8').read()
    ABBR.extend(re.findall(r"\['([0-9a-z]+)', '", refs_ts[refs_ts.index('export const BOOKS'):refs_ts.index('const INDEX')]))
    books = json.load(open(BOOKS, encoding='utf-8'))
    cache = {}

    def bible(bid):
        if bid not in cache:
            cache[bid] = json.load(open(os.path.join(ROOT, 'assets', 'data', 'bible', f'{bid}.bible'), encoding='utf-8'))
        return cache[bid]

    readings = sorted(pack['bible_reading_references'], key=lambda r: r['source_entry_no'])
    praise = next(p for p in pack['prayers_and_praises'] if p['id'] == 'hw-pascha-thok-te-ti-gom')
    tennav = next(p for p in pack['prayers_and_praises'] if p['id'] == 'hw-resurrection-tennav')
    # From where in the week each invocation of the praise is added: the first service it is said in.
    start = {'default': 0}
    for r in readings:
        if r['day_id'] == 'holy_tuesday' and r['service_ar'] == 'الحادية عشرة':
            start.setdefault('tuesday_11th_hour', r['source_entry_no'])
        if r['day_id'] == 'good_friday':
            start.setdefault('good_friday_eve', r['source_entry_no'])

    def stanza(v):
        return {k: v[src] for k, src in (('ar', 'arabic'), ('ca', 'coptic_arabic'), ('cop', 'coptic')) if v.get(src)}

    problems = []
    days = []
    for d in sorted(pack['days'], key=lambda d: d['days_from_resurrection']):
        services = []
        for r in readings:
            if r['day_id'] != d['id']:
                continue
            if not services or services[-1]['ar'] != r['service_ar']:
                services.append({'ar': r['service_ar'], 'sv': service_sv(r['service_ar']), 'from': r['source_entry_no'], 'readings': []})
            kind, kind_sv = KINDS[r['reading_type_ar']]
            ref = to_ref(r['osis_book'], r['passage_ar'])
            if r['osis_book'] == 'PSA':
                # The psalms are numbered as the church numbers them (the Septuagint), the app's Bible as the
                # Hebrew. Where one psalm is one psalm in both, it is renumbered; elsewhere the reference
                # is shown without the text.
                # One reference in the pack is in the Bible's numbering already ("78:65", Easter matins): a
                # verse found only under the number as given keeps it.
                lxx = psalm_ref(r['passage_ar'])
                ref = lxx if lxx and not check(lxx, books, bible) else ref if not check(ref, books, bible) else None
                if ref is None:
                    services[-1]['readings'].append({'kind': kind, 'kindAr': r['reading_type_ar'], 'kindSv': kind_sv, 'psalm': re.sub(r'^\S+\s+', '', r['passage_ar'])})
                    continue
            bad = check(ref, books, bible)
            if bad:
                problems.append(f"{d['id']} {r['service_ar']} {r['passage_ar']}: {bad}")
            services[-1]['readings'].append({'kind': kind, 'kindAr': r['reading_type_ar'], 'kindSv': kind_sv, 'ref': ref,
                                             # The source names the whole chapter, without verses.
                                             **({'wholeChapter': True} if ':' not in r['passage_ar'] else {})})
        for s in services:
            hour = s['ar'].split(' - ')[-1]
            if d['id'] in PASCHA_DAYS and hour in PASCHA_HOURS:
                s['praise'] = [k for k, n in start.items() if n <= s['from']]
            del s['from']
        if d['id'] == 'resurrection_sunday':
            services.insert(1, {'ar': 'تسبحة القيامة', 'sv': service_sv('تسبحة القيامة'), 'readings': [],
                                'hymn': {'ar': 'لحن القيامة (تين ناف)', 'stanzas': [stanza(v) for v in tennav['verses']]}})
        days.append({'id': d['id'], 'ar': d['title_ar'], 'sv': DAYS_SV[d['id']], 'offset': d['days_from_resurrection'], 'services': services})

    out = {
        'days': days,
        'praise': {
            'ar': praise['title_ar'],
            'repeat': praise['usage']['repeat_each_hour'],
            'stanza': stanza(praise['verses'][0]),
            'invocations': [{**stanza(i), 'from': i['from']} for i in praise['invocations']],
        },
    }
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    with open(os.path.join(OUT, 'holyweek.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    n = sum(len(s['readings']) for d in days for s in d['services'])
    print(f"{len(days)} days, {sum(len(d['services']) for d in days)} services, {n} readings")
    for p in problems:
        print('  not in the Bible:', p)


if __name__ == '__main__':
    main()
