#!/usr/bin/env python3
"""Export the text material from the CopticPrayers APK into data/texts.js.

The APK ships its texts as SQLite databases under assets/ (Agpeya, Katamars,
Bible, Kholagy, Dlal). This script reads them and writes a JS file the
prototype loads with a plain <script> tag, so it also works from file://.

Usage:
    python3 tools/export_data.py <apk-or-assets-dir> [--start 2026-10-15] [--days 36]

The Katameros part is resolved per Gregorian date for a window of days, using
the same selection rules as the original app (Holy Week, Jonah's fast, Great
Lent, the Fifty Days, Sundays and the days_relations table). Kiahk/Touba
special cases (paramoun, Nativity in leap years) are not handled yet; those
dates are flagged with "approx": true.
"""

import argparse
import datetime as dt
import json
import math
import os
import re
import sqlite3
import sys
import tempfile
import zipfile

COPTIC_EPOCH_JDN = 1825030  # 1 Tout, year 1 of the Martyrs

# Abbreviation table from the original app. Index == bid in the Bible table.
# Columns: abbr, short Arabic name, Arabic name used in the epistle intro,
# Swedish name used in the intro formulas.
BOOKS = [
    ['gen', 'تك'], ['ex', 'خر'], ['lev', 'لا'], ['num', 'عد'], ['deut', 'تث'],
    ['josh', 'يش'], ['judg', 'قض'], ['ruth', 'را'], ['1sam', '١صم'], ['2sam', '٢صم'],
    ['1kings', '١مل'], ['2kings', '٢مل'], ['1chron', '١أخ'], ['2chron', '٢أخ'],
    ['ezra', 'عز'], ['neh', 'نح'], ['tob', 'طو'], ['jth', 'يهوديت'], ['est', 'أس'],
    ['job', 'أي'], ['ps', 'مز'], ['prov', 'أم'], ['eccles', 'جا'], ['song', 'نش'],
    ['wis', 'حكمة'], ['sir', 'سيراخ'], ['isa', 'إش'], ['jer', 'إر'], ['lam', 'مرا'],
    ['bar', 'باروخ'], ['ezek', 'حز'], ['dan', 'دا'], ['hos', 'هو'], ['joel', 'يؤ'],
    ['amos', 'عا'], ['obad', 'عو'], ['jonah', 'يون'], ['mic', 'مي'], ['nah', 'نا'],
    ['hab', 'حب'], ['zeph', 'صف'], ['hag', 'حج'], ['zech', 'زك'], ['mal', 'ملا'],
    ['1macc', '١مكا'], ['2macc', '٢مكا'],
    ['matt', 'متى', 'متى', 'Matteus'], ['mark', 'مرقس', 'مرقس', 'Markus'],
    ['luke', 'لوقا', 'لوقا', 'Lukas'], ['john', 'يوحنا', 'يوحنا', 'Johannes'],
    ['acts', 'أعمال الرسل'],
    ['rom', 'رومية', 'إلى أهل رومية', 'Rom'],
    ['1cor', '١ كورنثوس', 'الأولى إلى أهل كورنثوس', 'Korint'],
    ['2cor', '٢ كورنثوس', 'الثانية إلى أهل كورنثوس', 'Korint'],
    ['gal', 'غلاطية', 'إلى أهل غلاطية', 'Galatien'],
    ['eph', 'أفسس', 'إلى أهل أفسس', 'Efesos'],
    ['phil', 'فيلبي', 'إلى أهل فيلبي', 'Filippi'],
    ['col', 'كولوسي', 'إلى أهل كولوسي', 'Kolosse'],
    ['1thess', '١ تسالونيكي', 'الأولى إلى أهل تسالونيكي', 'Tessalonike'],
    ['2thess', '٢ تسالونيكي', 'الثانية إلى أهل تسالونيكي', 'Tessalonike'],
    ['1tim', '١ تيموثاوس', 'الأولى إلى تيموثاوس', 'Timoteus'],
    ['2tim', '٢ تيموثاوس', 'الثانية إلى تيموثاوس', 'Timoteus'],
    ['titus', 'تيطس', 'تيطس', 'Titus'],
    ['philem', 'فليمون', 'فليمون', 'Filemon'],
    ['heb', 'عبرانيين', 'إلى العبرانيين', 'Hebreerna'],
    ['james', 'يعقوب', 'يعقوب الرسول', 'aposteln Jakob'],
    ['1pet', '١ بطرس', 'بطرس الرسول الأولى', 'aposteln Petrus'],
    ['2pet', '٢ بطرس', 'بطرس الرسول الثانية', 'aposteln Petrus'],
    ['1john', '١ يوحنا', 'يوحنا الرسول الأولى', 'aposteln Johannes'],
    ['2john', '٢ يوحنا', 'يوحنا الرسول الثانية', 'aposteln Johannes'],
    ['3john', '٣ يوحنا', 'يوحنا الرسول الثالثة', 'aposteln Johannes'],
    ['jude', 'يهوذا', 'يهوذا الرسول', 'aposteln Judas'],
    ['rev', 'رؤيا'],
]
BOOK_INDEX = {b[0]: i for i, b in enumerate(BOOKS)}

SECTIONS = [
    # key, Arabic title, Swedish title, plain-language caption, formula group
    ('vespers', 'عشية', 'Aftontjänst', 'Kvällens psalm och evangelium', 'gospel'),
    ('matins', 'باكر', 'Morgontjänst', 'Morgonens psalm och evangelium', 'gospel'),
    ('pauline', 'البولس', 'Paulus epistel', 'Ur aposteln Paulus brev', 'pauline'),
    ('catholic', 'الكاثوليكون', 'Katholikon', 'Ur de allmänna breven', 'catholic'),
    ('praxis', 'الإبركسيس', 'Praxis', 'Ur Apostlagärningarna', 'praxis'),
    ('liturgy', 'إنجيل القداس', 'Evangeliet', 'Liturgins psalm och evangelium', 'gospel'),
]


# --- Calendar -----------------------------------------------------------------

def gregorian_to_jdn(d):
    return d.toordinal() + 1721425


def coptic_from_gregorian(d):
    jdn = gregorian_to_jdn(d)
    year = (4 * (jdn - COPTIC_EPOCH_JDN) + 1463) // 1461
    start = COPTIC_EPOCH_JDN - 1 + 365 * (year - 1) + year // 4
    day_of_year = jdn - start  # 1-based
    month = (day_of_year - 1) // 30 + 1
    day = day_of_year - 30 * (month - 1)
    return year, month, day


def orthodox_easter(year):
    a, b, c = year % 4, year % 7, year % 19
    d = (19 * c + 15) % 30
    e = (2 * a + 4 * b - d + 34) % 7
    month = (d + e + 114) // 31
    day = (d + e + 114) % 31 + 1
    julian = dt.date(year, month, day)
    return julian + dt.timedelta(days=13)  # valid 1900-2099


# --- Text helpers -------------------------------------------------------------

def clean_sv(s):
    if s is None:
        return None
    s = re.sub(r'([.!?])(?=[A-ZÅÄÖ])', r'\1 ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def clean_ar(s):
    if s is None:
        return None
    return re.sub(r'\s+', ' ', s).strip()


def parse_ref(ref):
    """Port of the original app's reference parser."""
    ref = ref.strip()
    m = re.match(r'(\d?[A-Za-z]+)\s*(.*)', ref)
    abbr, rest = m.group(1).lower(), m.group(2)
    toks = re.findall(r'[,:-]?\s*\d+', rest)
    chapters, first, last, continuous, first_colon = [], None, [], None, True
    for t in toks:
        head = t[0]
        num = int(re.sub(r'\D', '', t))
        if head == ':' and first_colon:
            first, first_colon = num, False
        elif head == ':':
            chapters.append(last)
            last = num
        elif head == '-':
            continuous, last = True, num
        elif head == ',':
            continuous = False
            if not isinstance(last, list):
                last = []
            last.append(num)
        else:
            chapters.append(num)
    return abbr, chapters, first, last, continuous


def fetch_passage(bible, ref):
    verses = []
    for part in ref.split('/'):
        abbr, chapters, first, last, continuous = parse_ref(part)
        bid = BOOK_INDEX[abbr]
        if len(chapters) == 1:
            if continuous:
                rows = bible.execute(
                    'select cid, vid, vtd, vse from bible where bid=? and cid=? and vid between ? and ? order by vid',
                    (bid, chapters[0], first, last)).fetchall()
            else:
                wanted = [first] + (last if isinstance(last, list) else [])
                rows = []
                for v in wanted:
                    rows += bible.execute(
                        'select cid, vid, vtd, vse from bible where bid=? and cid=? and vid=?',
                        (bid, chapters[0], v)).fetchall()
        else:
            c1, c2 = chapters[0], chapters[1]
            rows = bible.execute(
                'select cid, vid, vtd, vse from bible where bid=? and '
                '((cid=? and vid>=?) or (cid>? and cid<?) or (cid=? and vid<=?)) order by cid, vid',
                (bid, c1, first, c1, c2, c2, last)).fetchall()
        for cid, vid, ar, sv in rows:
            verses.append({'t': 'v', 'c': cid, 'n': vid, 'ar': clean_ar(ar), 'sv': clean_sv(sv)})
    return verses


def ref_label(ref, books_sv):
    """Return (Arabic label, Swedish label) for a reference like 'matt 13 : 44 - 52'."""
    parts_ar, parts_sv = [], []
    for part in ref.split('/'):
        m = re.match(r'\s*(\d?[A-Za-z]+)\s*(.*)', part)
        abbr, rest = m.group(1).lower(), m.group(2)
        nums = re.sub(r'\s*:\s*', ':', rest.strip())
        nums = re.sub(r'\s*-\s*', '–', nums)
        nums = re.sub(r'\s*,\s*', ', ', nums)
        nums = re.sub(r'\s*;\s*', '; ', nums)
        bid = BOOK_INDEX[abbr]
        sv_name = BOOKS[bid][3] if len(BOOKS[bid]) > 3 and bid in range(46, 50) else books_sv.get(bid, abbr)
        parts_sv.append(f'{sv_name} {nums}')
        parts_ar.append(f'{BOOKS[bid][1]} {nums}')
    return ' / '.join(parts_ar), ' / '.join(parts_sv)


# --- Katameros ----------------------------------------------------------------

def resolve_row(kat, d):
    """Pick the Katameros row for a Gregorian date. Returns (table, row, note)."""
    cy, cm, cd = coptic_from_gregorian(d)
    easter = orthodox_easter(d.year)
    delta = (d - easter).days
    sunday = d.weekday() == 6
    q = lambda sql, args=(): kat.execute(sql, args).fetchone()

    if -6 <= delta < 0:
        return None, None, 'holy_week'
    if -69 <= delta < -66:
        return 'great_lent', q('select * from great_lent where _id=?', (delta + 69 + 52,)), 'jonah'
    if delta == -66:
        return 'great_lent', q('select * from great_lent where _id=55'), 'jonah'
    if -57 <= delta < -6:
        return 'great_lent', q('select * from great_lent where _id=?', (delta + 57 + 1,)), 'lent'
    if 0 <= delta < 49:
        return 'fifty_feast', q('select * from fifty_feast where _id=?', (delta + 1,)), 'fifty'
    if sunday and cd == 29 and (cm < 4 or cm > 6):
        return 'days', q('select * from days where month=7 and day=29'), 'sunday29'
    if sunday:
        n = math.ceil(cd / 7)
        if n == 5:
            return 'sundays', q('select * from sundays where sunday_number=5'), 'sunday'
        return 'sundays', q('select * from sundays where month=? and sunday_number=?', (cm, n)), 'sunday'
    row = q('select days.* from days join days_relations r on days.month=r.instead_month '
            'and days.day=r.instead_day where r.month=? and r.day=?', (cm, cd))
    return 'days', row, 'weekday'


def formulas(kat):
    out = {}
    for reading, ar, sv in kat.execute('select reading, arabic, swedish from repeated_sentences order by rowid'):
        out.setdefault(reading, []).append((ar, sv))
    return out


def fill(text, value):
    if text is None:
        return None
    return re.sub(r'\s*\.{3,}\s*', f' {value} ', text).replace(' .', '.').strip()


def build_section(key, row, cols, kat, bible, forms, books_sv):
    rec = dict(zip(cols, row))
    title = next(s for s in SECTIONS if s[0] == key)
    _, ar_title, sv_title, caption, group = title
    units = []
    if group == 'gospel':
        prefix = {'vespers': 'vespers_', 'matins': 'matins_', 'liturgy': ''}[key]
        psalm_id = rec.get(prefix + 'psalm_id')
        gospel = rec.get(prefix + 'gospel') if key != 'liturgy' else rec.get('gospel')
        psalm_ref = rec.get(prefix + 'psalm')
        if not gospel:
            return None
        abbr = parse_ref(gospel)[0]
        b = BOOKS[BOOK_INDEX[abbr]]
        psalm = kat.execute('select arabic, swedish from Psalms where _id=?', (psalm_id,)).fetchone()
        g_ar, g_sv = ref_label(gospel, books_sv)
        p_ar, p_sv = psalm_ar_label(psalm_ref), psalm_sv_label(psalm_ref)
        for ar, sv in forms['gospel']:
            if ar == 'psalmShahed':
                units.append({'t': 'ref', 'ar': p_ar, 'sv': p_sv})
            elif ar == 'psalm':
                if psalm:
                    units.append({'t': 'psalm', 'ar': clean_ar(psalm[0]), 'sv': clean_sv(psalm[1])})
            elif ar == 'gospelShahed':
                units.append({'t': 'ref', 'ar': g_ar, 'sv': g_sv})
            elif ar == 'gospel':
                units += fetch_passage(bible, gospel)
            else:
                units.append({'t': 'f', 'ar': clean_ar(fill(ar, b[2])), 'sv': clean_sv(fill(sv, b[3]))})
        refs = {'ar': [p_ar, g_ar], 'sv': [p_sv.replace('Psaltaren', 'Ps', 1), g_sv]}
    else:
        ref = rec.get(key)
        if not ref:
            return None
        abbr = parse_ref(ref)[0]
        b = BOOKS[BOOK_INDEX[abbr]]
        r_ar, r_sv = ref_label(ref, books_sv)
        for ar, sv in forms[group]:
            if ar == 'shahed':
                units.append({'t': 'ref', 'ar': r_ar, 'sv': r_sv})
            elif ar == 'text':
                units += fetch_passage(bible, ref)
            else:
                ar_v = b[2] if len(b) > 2 else b[1]
                sv_v = b[3] if len(b) > 3 else ''
                units.append({'t': 'f', 'ar': clean_ar(fill(ar, ar_v)), 'sv': clean_sv(fill(sv, sv_v))})
        refs = {'ar': [r_ar], 'sv': [r_sv]}
    return {'key': key, 'ar': ar_title, 'sv': sv_title, 'caption': caption, 'refs': refs, 'units': units}


def heb_to_lxx(ch, verse):
    if ch <= 8 or ch >= 148:
        return ch
    if ch in (9, 10):
        return 9
    if 11 <= ch <= 113:
        return ch - 1
    if ch in (114, 115):
        return 113
    if ch == 116:
        return 114 if verse <= 9 else 115
    if 117 <= ch <= 146:
        return ch - 1
    if ch == 147:
        return 146 if verse <= 11 else 147
    return ch


def psalm_sv_label(ref):
    if not ref:
        return ''
    nums = ref.strip()[2:].strip()
    nums = re.sub(r'\s*:\s*', ':', nums)
    nums = re.sub(r'\s*-\s*', '–', nums)
    nums = re.sub(r'\s*,\s*', ', ', nums)
    nums = re.sub(r'\s*;\s*', '; ', nums)
    return f'Psaltaren {nums}'


def psalm_ar_label(ref):
    """Arabic psalm label in the Septuagint numbering used by the Coptic books."""
    if not ref:
        return ''
    out = []
    for seg in ref.replace('ps', '', 1).split(';'):
        m = re.match(r'\s*(\d+)\s*:\s*(.*)', seg)
        if not m:
            continue
        ch, verses = int(m.group(1)), m.group(2)
        first_v = int(re.match(r'\d+', verses.strip()).group(0))
        v = re.sub(r'\s*-\s*', '–', verses.strip())
        v = re.sub(r'\s*,\s*', '، ', v)
        out.append(f'{heb_to_lxx(ch, first_v)}:{v}')
    return 'مزمور ' + ' ؛ '.join(out)


def export_katameros(kat, bible, start, days):
    books_sv = {bid: sv for sv, bid in bible.execute('select swedish, bid from bible_books')}
    forms = formulas(kat)
    out = {}
    for i in range(days):
        d = start + dt.timedelta(days=i)
        cy, cm, cd = coptic_from_gregorian(d)
        table, row, note = resolve_row(kat, d)
        entry = {'coptic': [cy, cm, cd], 'season': note, 'source': table,
                 'approx': cm in (4, 5), 'sections': []}
        if row is not None:
            cols = [c[1] for c in kat.execute(f'pragma table_info({table})')]
            for key, *_ in SECTIONS:
                sec = build_section(key, row, cols, kat, bible, forms, books_sv)
                if sec:
                    entry['sections'].append(sec)
        out[d.isoformat()] = entry
    return out


# --- Agpeya and Bible index ---------------------------------------------------

def export_agpeya(agp):
    hours = []
    for ar, sv, pid, img in agp.execute('select title_arabic, title_swedish, pray_id, pray_image from pray_hours order by pray_id'):
        units = []
        rows = agp.execute('select s.is_title, s.arabic, s.swedish from prays_relations r '
                           'join sentences s on s._id = r.sentence_id where r.pray_id=? order by r.rowid', (pid,))
        for kind, a, s in rows:
            units.append({'t': ['p', 'h', 'H'][kind or 0], 'ar': clean_ar(a), 'sv': clean_sv(s)})
        hours.append({'id': img, 'ar': clean_ar(ar), 'sv': clean_sv(sv), 'units': units})
    return hours


def export_books(bible):
    books = []
    for ar, sv, bid, n in bible.execute('select arabic, swedish, bid, chapters_number from bible_books order by _id'):
        books.append({'ar': ar, 'sv': sv, 'chapters': n, 'nt': 46 <= bid <= 72})
    return books


def open_assets(path):
    if os.path.isdir(path):
        return path
    tmp = tempfile.mkdtemp(prefix='coptic-apk-')
    with zipfile.ZipFile(path) as z:
        for name in ('Agpeya', 'Katamars', 'Bible'):
            z.extract(f'assets/{name}', tmp)
    return os.path.join(tmp, 'assets')


def connect(assets, name):
    return sqlite3.connect(f'file:{os.path.join(assets, name)}?mode=ro', uri=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', help='CopticPrayers .apk or its extracted assets/ directory')
    ap.add_argument('--start', default=(dt.date.today() - dt.timedelta(days=7)).isoformat())
    ap.add_argument('--days', type=int, default=36)
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'texts.js'))
    args = ap.parse_args()

    assets = open_assets(args.source)
    kat, bible, agp = connect(assets, 'Katamars'), connect(assets, 'Bible'), connect(assets, 'Agpeya')
    start = dt.date.fromisoformat(args.start)
    data = {
        'generated': dt.date.today().isoformat(),
        'window': [start.isoformat(), (start + dt.timedelta(days=args.days - 1)).isoformat()],
        'katameros': export_katameros(kat, bible, start, args.days),
        'agpeya': export_agpeya(agp),
        'books': export_books(bible),
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/export_data.py from the CopticPrayers text databases.\n')
        f.write('window.COPTIC_DATA = ')
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print(f'Wrote {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)', file=sys.stderr)


if __name__ == '__main__':
    main()
