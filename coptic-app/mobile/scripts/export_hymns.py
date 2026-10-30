#!/usr/bin/env python3
"""Export the hymn texts and the Synaxarium.

The zip holds two EPUBs, gathered from the hymn library at tasbeha.org and the
Synaxarium at copticchurch.net:

    الألحان_عربي_وقبطي.epub   1233 hymns in 26 groups (occasions), each verse a
                              Coptic line with its Arabic, or Arabic alone
    السنكسار_العربي.epub      the Synaxarium in Arabic, one file per Coptic day

The Coptish Datastore (github.com/markrofail/coptish-datastore, MPL-2.0) has
the Psalmody, the doxologies and the liturgy with the Arabic in running
paragraphs, the Coptic written in Arabic letters, as it is sung, and the
Coptic itself; each stanza keeps all three, and the reader picks. Those come
first in their groups; the tasbeha.org texts follow where they add something,
their Arabic lines joined into a paragraph per stanza and the Coptic script
left out (it stays only where a stanza has no Arabic).

Writes assets/hymns/ (not checked in, like the other texts):

    <group>.hymns     one group's hymns (JSON), read when the group is opened
    <month>.synax     one Coptic month of the Synaxarium (JSON), read with the day
    index.ts          the groups' names and counts, and the asset modules

Usage:
    python3 scripts/export_hymns.py <collection.zip> <coptish-datastore/data>
"""

import glob
import io
import json
import os
import re
import shutil
import sys
import zipfile
from html.parser import HTMLParser

import yaml

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'hymns')

# The groups in Swedish. The Arabic names come from the book.
GROUPS_SV = {
    'التسبحة السنوية': 'Den årliga tasbeha',
    'رفع بخور عشية وباكر': 'Rökelsens upptagande, kväll och morgon',
    'القداس السنوي': 'Den årliga liturgin',
    'كيهك': 'Kiahk',
    'الصوم الكبير': 'Stora fastan',
    'أسبوع الآلام وسبت النور': 'Påskveckan och Ljusets lördag',
    'صوم الرسل': 'Apostlarnas fasta',
    'صوم نينوى': 'Nineves fasta',
    'سبت لعازر': 'Lasarus lördag',
    'عيد البشارة': 'Bebådelsen',
    'عيد الصعود': 'Kristi himmelsfärd',
    'أحد الشعانين': 'Palmsöndagen',
    'عيد الميلاد': 'Julen',
    'عيد العنصرة': 'Pingst',
    'عيد القيامة والخمسين المقدسة': 'Påsken och de heliga femtio dagarna',
    'عيد الغطاس': 'Teofanin, Herrens dop',
    'دخول المسيح أرض مصر': 'Kristi ankomst till Egypten',
    'دخول المسيح الهيكل': 'Kristi frambärande i templet',
    'عيد الختان': 'Kristi omskärelse',
    'خميس العهد': 'Skärtorsdagen',
    'أحد توما': 'Tomas söndag',
    'عيد التجلي': 'Kristi förklaring',
    'عرس قانا الجليل': 'Bröllopet i Kana',
    'عيد الرسل': 'Apostlarnas högtid',
    'عيد النيروز': 'Nayrouz, det koptiska nyåret',
    'عيد الصليب': 'Korsets högtid',
}


def clean(s):
    return re.sub(r'\s+', ' ', s).strip()


class Hymn(HTMLParser):
    """A hymn page: its title (h1) and its verses, each a Coptic line, its Arabic, or both; a gap ends a stanza."""

    def __init__(self):
        super().__init__()
        self.title = ''
        self.units = []
        self.verse = None
        self.cur = None
        self.text = ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class', '')
        if tag == 'h1':
            self.cur, self.text = 'h1', ''
        elif tag == 'div' and cls == 'verse':
            self.verse = {}
        elif tag == 'div' and cls == 'gap':
            if self.units and self.units[-1]['t'] != 'gap':
                self.units.append({'t': 'gap'})
        elif tag == 'p' and self.verse is not None:
            self.cur, self.text = ('cop' if a.get('lang') == 'cop' else 'ar'), ''

    def handle_endtag(self, tag):
        if tag == 'h1' and self.cur == 'h1':
            self.title, self.cur = clean(self.text), None
        elif tag == 'p' and self.cur in ('cop', 'ar') and self.verse is not None:
            t = clean(self.text)
            if t:
                self.verse[self.cur] = t
            self.cur = None
        elif tag == 'div' and self.verse is not None:
            v, self.verse = self.verse, None
            if 'cop' in v:
                self.units.append({'t': 'cop', 'cop': v['cop'], **({'ar': v['ar']} if 'ar' in v else {})})
            elif 'ar' in v:
                self.units.append({'t': 'p', 'ar': v['ar']})

    def handle_data(self, data):
        if self.cur:
            self.text += data


class Group(HTMLParser):
    """A group page: its name and its hymns' files, in order."""

    def __init__(self):
        super().__init__()
        self.title = ''
        self.files = []
        self.in_h1 = False

    def handle_starttag(self, tag, attrs):
        if tag == 'h1':
            self.in_h1 = True
        elif tag == 'a':
            href = dict(attrs).get('href', '')
            if href.startswith('h_'):
                self.files.append(href)

    def handle_endtag(self, tag):
        if tag == 'h1':
            self.in_h1 = False

    def handle_data(self, data):
        if self.in_h1:
            self.title += data


class Day(HTMLParser):
    """A Synaxarium day: its entries, each a title (h2) and its paragraphs."""

    def __init__(self):
        super().__init__()
        self.entries = []
        self.cur = None
        self.text = ''

    def handle_starttag(self, tag, attrs):
        if tag == 'h2':
            self.entries.append({'title': '', 'paras': []})
            self.cur, self.text = 'h2', ''
        elif tag == 'p' and self.entries:
            self.cur, self.text = 'p', ''

    def handle_endtag(self, tag):
        if tag == 'h2' and self.cur == 'h2':
            self.entries[-1]['title'] = clean(self.text)
            self.cur = None
        elif tag == 'p' and self.cur == 'p':
            t = clean(self.text)
            if t:
                self.entries[-1]['paras'].append(t)
            self.cur = None

    def handle_data(self, data):
        if self.cur:
            self.text += data


# Which Coptish texts lead which group, in order. A '*' is every text of a
# folder; in the raising of incense the doxologies stand where the rite has them.
COPTISH = {
    '01': ['psalmody/*'],
    '02': ['liturgy-st-basil/00-matins-raising-of-incense/*'],
    '03': ['liturgy-st-basil/01-offering-of-the-lamb/*', 'liturgy-st-basil/02-liturgy-of-the-word/*',
           'liturgy-st-basil/03-liturgy-of-the-believers/*', 'liturgy-st-basil/04-the-distribution-of-the-holy-mysteries/*'],
    '05': ['doxologies/02-great-lent-doxology-1.yml'],
}
# The Psalmody has English titles only. Its Arabic titles, and the tasbeha.org
# text each one replaces (the same hymn, which would otherwise stand twice).
THEOTOKY = 'ثيؤطوكية الأحد: القطعة {}'
ORDINALS = {1: 'الأولى', 2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة', 5: 'الخامسة', 6: 'السادسة', 10: 'العاشرة', 11: 'الحادية عشرة',
            12: 'الثانية عشرة', 13: 'الثالثة عشرة', 14: 'الرابعة عشرة', 15: 'الخامسة عشرة', 16: 'السادسة عشرة', 17: 'السابعة عشرة', 18: 'الثامنة عشرة'}
TITLES = {
    'psalmody/00-ten-thino': ('قوموا يا بني النور (تين ثينو)', 'لحن تين ثينو'),
    'psalmody/01-resurrection-tennav': ('لحن القيامة (تين ناف)', 'لحن القيامة - تينناف'),
    'psalmody/02-first-hoos': ('الهوس الأول', 'الهوس الأول'),
    'psalmody/03-lobsh-of-first-hoos': ('لبش الهوس الأول', 'لبش الهوس الأول'),
    'psalmody/04-second-hoos': ('الهوس الثاني', 'الهوس الثاني'),
    'psalmody/05-second-lobsh': ('لبش الهوس الثاني', 'لبش الهوس الثاني'),
    'psalmody/06-third-hoos': ('الهوس الثالث', 'الهوس الثالث'),
    'psalmody/07-arepsalin': ('أريبصالين', 'إبصالية واطس للثلاثة فتية القديسين - رومية'),
    'psalmody/08-ten-oweeh-enthok': ('تين أوويه إنثوك', 'مديح واطس للثلاثة فتية القديسين - تين اوويه إنسوك'),
    'psalmody/09-comemoration': ('مجمع القديسين', 'مجمع القديسين'),
    'psalmody/10-doxology-st-mary': ('ذكصولوجية العذراء مريم', 'ذكصولوجية للعذراء مريم - تسبحة نصف الليل'),
    'psalmody/11-doxology-archangel-michael': ('ذكصولوجية رئيس الملائكة ميخائيل', None),
    'psalmody/12-doxology-st-anthony': ('ذكصولوجية الأنبا أنطونيوس', None),
    'psalmody/13-conclusion-of-doxologies': ('ختام الذكصولوجيات', None),
    'psalmody/14-fourth-hoos': ('الهوس الرابع', 'الهوس الرابع'),
    'psalmody/15-aynahti': ('إبصالية آدام (آي ناهتي)', 'إبصالية الأحد الأول'),
    'psalmody/16-aykoti': ('إبصالية الأحد (آي كوتي)', 'إبصالية الأحد الثانية'),
    'psalmody/17-theotoky-adam-intro': ('مقدمة الثيؤطوكيات الآدام', None),
    'psalmody/18-theotoky-watos-intro': ('مقدمة الثيؤطوكيات الواطس', None),
    'psalmody/25-gospel': ('الإنجيل', 'الإنجيل لمعلمنا مار لوقا'),
    'psalmody/26-shere-ne-maria': ('شيري ني ماريا', 'القطعة السابعة - شيري نيه ماريا'),
    'psalmody/27-semouti': ('سيموتي', 'القطعة السابعة - سيموتي'),
    'psalmody/28-seven-times': ('سبع مرات', 'القطعة الثامنة - شاشف إنسوب'),
    'psalmody/38-your-mercies': ('مراحمك يا إلهي', None),
    'psalmody/39-creed-intro': ('مقدمة قانون الإيمان', None),
    'psalmody/40-creed': ('قانون الإيمان', None),
    'psalmody/41-amen-keryalison': ('آمين كيرياليسون', None),
    'doxologies/02-great-lent-doxology-1': ('ذكصولوجية الصوم الكبير الأولى', None),
    'liturgy-st-basil/00-matins-raising-of-incense/03-eshleel': ('صلوا – إشليل', None),
    'liturgy-st-basil/00-matins-raising-of-incense/06-eshleel': ('صلوا – إشليل', None),
}
# The Sunday Theotokia in its parts; the tasbeha.org pieces they replace.
THEOTOKY_PARTS = {1: 'ثيؤطوكية الأحد', 10: 'القطعة العاشرة - تي اوي إنهيكانوس', 15: 'القطعة الخامسة عشر - أف إن بي أرشي إريفس', 16: 'القطعة السادسة عشر - نيم غار'}
for n, file in [(1, 19), (2, 20), (3, 21), (4, 22), (5, 23), (6, 24)] + [(k, 19 + k) for k in range(10, 19)]:
    TITLES[f'psalmody/{file:02d}-theotoky-part-{n}'] = (THEOTOKY.format(ORDINALS[n]), THEOTOKY_PARTS.get(n))

ANNUAL_DOXOLOGIES = ['01-intro', '03-st-mary', '04-archangel-michael', '05-st-pishoy-and-st-paul', '06-conclusion']
ROLES = {'priest', 'deacon', 'people'}


def coptish_units(doc):
    """A Coptish text as units: a stanza in up to three forms (Arabic, Coptic in Arabic letters, Coptic), who sings it, the rubrics."""
    units = []
    for sec in doc.get('sections') or []:
        kind = sec.get('type')
        if kind == 'info':
            t = clean((sec.get('text') or {}).get('arabic') or '')
            if t:
                units.append({'t': 'rubric', 'ar': t})
        elif kind == 'verses':
            v = sec.get('verses') or {}
            forms = {k: v.get(src) or [] for k, src in (('ar', 'arabic'), ('ca', 'coptic_arabic'), ('cop', 'coptic'))}
            if sec.get('speaker') in ROLES:
                units.append({'t': 'role', 'r': sec['speaker']})
            for i in range(max(len(x) for x in forms.values())):
                st = {k: clean(x[i]) for k, x in forms.items() if i < len(x) and x[i] and clean(x[i])}
                if st:
                    units.append({'t': 'st', **st})
        # Readings ('reading') are in the day's readings; the fractions ('compound-prayer') in the Kholagy.
    while units and units[-1]['t'] == 'role':
        units.pop()
    return units


def coptish_item(data, path):
    doc = yaml.safe_load(open(os.path.join(data, path), encoding='utf-8'))
    units = coptish_units(doc)
    if not any(u.get('ca') for u in units):
        return None
    t = doc.get('title') or {}
    title, replaces = TITLES.get(path[:-4], (clean(t.get('arabic') or t.get('english') or ''), None))
    item = {'id': 'c-' + re.sub(r'[^a-z0-9]+', '-', path[:-4].lower()).strip('-'), 'ar': title, 'ca': True, 'units': units}
    return item, replaces


def coptish(data):
    """Group → its Coptish texts."""
    out = {}
    for gid, patterns in COPTISH.items():
        paths = []
        for pat in patterns:
            found = sorted(os.path.relpath(f, data) for f in glob.glob(os.path.join(data, pat)) if not f.endswith('index.yml'))
            for f in found:
                if f.endswith('/12-doxologies.yml'):
                    paths += [f'doxologies/{d}.yml' for d in ANNUAL_DOXOLOGIES]
                else:
                    paths.append(f)
        out[gid] = [r for r in (coptish_item(data, p) for p in paths) if r]
    return out


def flowing(units):
    """A tasbeha.org text as running Arabic: a stanza's lines joined into one paragraph; the Coptic script only where there is no Arabic."""
    out = []
    stanza = []

    def close():
        lines = [u['ar'] for u in stanza if 'ar' in u]
        if lines:
            out.append({'t': 'st', 'ar': ' '.join(lines)})
        elif stanza:
            out.append({'t': 'st', 'cop': ' '.join(u['cop'] for u in stanza)})
        stanza.clear()

    for u in units:
        if u['t'] == 'cop':
            stanza.append(u)
        elif u['t'] == 'gap':
            close()
        else:
            close()
            out.append(u)
    close()
    return out


def title_key(s):
    return re.sub(r'[\u064b-\u065f\u0670\s]', '', s).replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه')


def parse(cls, html):
    p = cls()
    p.feed(html)
    return p


def epub(outer, name):
    """An EPUB inside the zip, as a reader of its files."""
    inner = zipfile.ZipFile(io.BytesIO(outer.read(name)))
    return lambda path: inner.read(path).decode('utf-8')


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    outer = zipfile.ZipFile(sys.argv[1])
    lead = coptish(sys.argv[2])
    names = {n.split('/')[-1]: n for n in outer.namelist()}
    hymns = epub(outer, names['الألحان_عربي_وقبطي.epub'])
    synax = epub(outer, names['السنكسار_العربي.epub'])

    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    groups = []
    total = 0
    for g in range(1, 100):
        try:
            page = parse(Group, hymns(f'EPUB/group_{g:02d}.xhtml'))
        except KeyError:
            break
        gid = f'{g:02d}'
        ar = clean(page.title)
        items = []
        for f in page.files:
            h = parse(Hymn, hymns(f'EPUB/{f}'))
            while h.units and h.units[-1]['t'] == 'gap':
                h.units.pop()
            if h.units:
                items.append({'id': f[2:-6], 'ar': h.title, 'units': flowing(h.units)})
        # The Coptish texts first; a tasbeha.org text with the same title is not repeated.
        first = lead.get(f'{g:02d}', [])
        seen = {title_key(t) for it, rep in first for t in (it['ar'], rep) if t}
        items = [it for it, _ in first] + [it for it in items if title_key(it['ar']) not in seen]
        with open(os.path.join(OUT, f'{gid}.hymns'), 'w', encoding='utf-8') as out:
            json.dump(items, out, ensure_ascii=False, separators=(',', ':'))
        if ar not in GROUPS_SV:
            sys.exit(f'No Swedish name for the group {ar}')
        groups.append({'id': gid, 'ar': ar, 'sv': GROUPS_SV[ar], 'count': len(items)})
        total += len(items)

    days = 0
    for month in range(1, 14):
        out = {}
        for day in range(1, 31):
            try:
                entries = parse(Day, synax(f'EPUB/day_{month}_{day}.xhtml')).entries
            except KeyError:
                continue
            out[day] = [e for e in entries if e['paras']]
            days += 1
        with open(os.path.join(OUT, f'{month:02d}.synax'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    lines = [
        '// Generated by scripts/export_hymns.py. Do not edit.',
        "import type { HymnGroup } from '../../src/lib/types';",
        '',
        '// The hymns of each group are assets, read when the group is opened; the app keeps only the names.',
        f'export const hymnGroups: HymnGroup[] = {json.dumps(groups, ensure_ascii=False)};',
        '',
        'export const hymnAssets: Record<string, number> = {',
        *[f"  '{g['id']}': require('./{g['id']}.hymns')," for g in groups],
        '};',
        '',
        '// The Synaxarium, one Coptic month to a file.',
        'export const synaxAssets: Record<number, number> = {',
        *[f"  {m}: require('./{m:02d}.synax')," for m in range(1, 14)],
        '};',
        '',
    ]
    with open(os.path.join(OUT, 'index.ts'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(groups)} groups, {total} hymns ({sum(len(v) for v in lead.values())} from Coptish); Synaxarium: {days} days')


if __name__ == '__main__':
    main()
