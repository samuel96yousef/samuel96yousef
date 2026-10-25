#!/usr/bin/env python3
"""Export the hymn texts and the Synaxarium from their EPUB books.

The zip holds two EPUBs, gathered from the hymn library at tasbeha.org and the
Synaxarium at copticchurch.net:

    الألحان_عربي_وقبطي.epub   1233 hymns in 26 groups (occasions), each verse a
                              Coptic line with its Arabic, or Arabic alone
    السنكسار_العربي.epub      the Synaxarium in Arabic, one file per Coptic day

Writes assets/hymns/ (not checked in, like the other texts):

    <group>.hymns     one group's hymns (JSON), read when the group is opened
    <month>.synax     one Coptic month of the Synaxarium (JSON), read with the day
    index.ts          the groups' names and counts, and the asset modules

Usage:
    python3 scripts/export_hymns.py <collection.zip>
"""

import io
import json
import os
import re
import shutil
import sys
import zipfile
from html.parser import HTMLParser

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


def parse(cls, html):
    p = cls()
    p.feed(html)
    return p


def epub(outer, name):
    """An EPUB inside the zip, as a reader of its files."""
    inner = zipfile.ZipFile(io.BytesIO(outer.read(name)))
    return lambda path: inner.read(path).decode('utf-8')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    outer = zipfile.ZipFile(sys.argv[1])
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
                items.append({'id': f[2:-6], 'ar': h.title, 'units': h.units})
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
    print(f'{len(groups)} groups, {total} hymns; Synaxarium: {days} days')


if __name__ == '__main__':
    main()
