"""The order of each Holy Week service, for scripts/export_holy_week.py.

A Pascha hour, Monday to Friday, day and night, goes in the church's order:
the prophecies, each with its opening and closing; the Pascha praise; the
epistles, where the hour has them; the psalm; the gospel, with the deacon's
call and the priest's prayer before it; the exposition (tarh); "Christ our
Saviour"; the litanies, ending with Kyrie eleison twelve times; and the close.
The fixed texts are the ones the app's hymn library (tasbeha.org, group 06,
"Holy Week") gives for the Pascha; the Swedish is the app's own translation.

Other services (the general funeral, the foot washing, the liturgies, the
Apocalypse night, Bright Saturday) keep their readings, with the texts the
hymn library has for them put in the order it gives. Where the library has a
text for a service but not where in it it is said, it follows the readings
under its own heading, and says so.

A service comes out as a list of items, in the order they are read:
    {'t': 'reading', ...}             a reading, from the app's Bible
    {'t': 'praise'}                   the Pascha praise, with the invocations said by then
    {'t': 'say', 'ar', 'sv', 'r'?}    a fixed text, said by the priest, deacon or people
    {'t': 'rubric'|'note'|'h', 'ar', 'sv'}
    {'t': 'lib', 'ar', 'units'}       a text from the hymn library, as it is there
"""

import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
HYMNS = os.path.join(ROOT, 'assets', 'hymns')

_lib = {}


def lib(ref):
    """A hymn library text by 'group:id', as an item."""
    group, hid = ref.split(':')
    if group not in _lib:
        _lib[group] = {h['id']: h for h in json.load(open(os.path.join(HYMNS, f'{group}.hymns'), encoding='utf-8'))}
    h = _lib[group][hid]
    return {'t': 'lib', 'ar': re.sub(r'^المطلع\s+', '', h['ar']).strip(), 'units': h['units']}


def lib_lines(ref):
    """The Arabic lines of a library text."""
    return [u.get('ar', '') for u in lib(ref)['units']]


# ---------- The fixed texts of a Pascha hour ----------

# Before a prophecy: "From ... the prophet; his holy blessing be with us. Amen." (06:1717)
PROPHET_SUFFIX = {
    'gen': ' لموسى النبي', 'ex': ' لموسى النبي', 'lev': ' لموسى النبي', 'num': ' لموسى النبي', 'deut': ' لموسى النبي',
    'job': ' الصديق', 'prov': '', 'wis': '', 'sir': '', 'josh': '', '1sam': '', '1kings': '', '1chron': '',
}
EVANGELIST = {'matt': ('متى', 'Matteus'), 'mark': ('مرقس', 'Markus'), 'luke': ('لوقا', 'Lukas'), 'john': ('يوحنا', 'Johannes')}


def prophecy_intro(book, books_by_abbr):
    b = books_by_abbr[book]
    name = b['ar'] + PROPHET_SUFFIX.get(book, ' النبي')
    return {'t': 'say', 'f': True, 'ar': f'من {name}، بركته المقدسة تكون معنا. آمين.',
            'sv': f"Ur {b['sv']}. Hans heliga välsignelse vare med oss. Amen."}


def prophecy_close():
    return {'t': 'say', 'f': True, 'ar': lib_lines('06:1717')[1],
            'sv': 'Ära vare den heliga Treenigheten, vår Gud, i evigheters evighet. Amen.'}


PSALM_INTRO = {'t': 'say', 'f': True, 'ar': 'من مزامير معلمنا داود النبي، بركته المقدسة تكون معنا. آمين.',
               'sv': 'En psalm av vår lärare David, profeten. Hans heliga välsignelse vare med oss. Amen.'}
PSALM_TUNE = {'t': 'rubric', 'ar': 'يُرتّل المزمور باللحن الحزايني.', 'sv': 'Psalmen sjungs med påskveckans sorgmelodi.'}


def gospel_call():
    # Ke eperto (06:56): the deacon's call before the gospel in the Pascha.
    return {'t': 'say', 'r': 'deacon', 'ar': lib_lines('06:56')[0],
            'sv': 'För att vi ska bli värdiga att höra det heliga, gudomliga evangeliet, låt oss bönfalla vår Herre och Gud. Lyssna i vishet till det heliga evangeliet.'}


def gospel_prayer(book):
    ar, sv = EVANGELIST[book]
    return {'t': 'say', 'r': 'priest',
            'ar': f'اللهم تراءف علينا وارحمنا واجعلنا مستحقين لسماع إنجيلك المقدس. فصل من إنجيل معلمنا مار {ar} البشير، بركاته علينا. آمين.',
            'sv': f'Gud, förbarma dig över oss och gör oss värdiga att höra ditt heliga evangelium. Läsning ur evangeliet enligt vår lärare {sv}, evangelisten. Hans välsignelse vare över oss. Amen.'}


GOSPEL_END = {'t': 'say', 'f': True, 'ar': 'والمجد لله دائماً.', 'sv': 'Ära vare Gud alltid.'}


def exposition(night, text=None):
    l = lib_lines('06:1720')
    items = [
        {'t': 'h', 'ar': 'الطرح', 'sv': 'Utläggningen (tarh)'},
        {'t': 'say', 'ar': l[0], 'sv': 'I den jämlika Treenighetens namn, Fadern, Sonen och den helige Ande.'},
        # The greeting of the night's hours, or of the day's.
        {'t': 'say', 'ar': re.sub(r'^فى ساعات (الليل|النهار)\s*', '', l[1 if night else 2]),
         'sv': 'Var hälsad, Maria, du sköna duva, som har fött åt oss Gud Ordet.' if night
         else 'Du sanna ljus, som lyser upp varje människa som kommer till världen.'},
    ]
    if text:
        items.append(lib(text))
    else:
        items.append({'t': 'note', 'ar': 'يُقرأ طرح الساعة. نصه غير موجود في التطبيق بعد.', 'sv': 'Timmens utläggning läses här. Dess text finns inte i appen än.'})
    l = lib_lines('06:1722')
    items.append({'t': 'say', 'ar': f'{l[0]} {l[1]}',
                  'sv': 'Kristus, vår Frälsare, kom och led, för att genom sitt lidande frälsa oss. Låt oss förhärliga honom och upphöja hans namn, ty han har gjort barmhärtighet med oss efter sin stora barmhärtighet.'})
    return items


def litanies(night, conclusion='06:388'):
    items = [
        {'t': 'h', 'ar': 'الطلبات', 'sv': 'Förbönerna'},
        {'t': 'rubric', 'ar': f"يصلي الكاهن طلبات {'الليل' if night else 'النهار'}.", 'sv': f"Prästen ber {'nattens' if night else 'dagens'} förböner."},
        {'t': 'note', 'ar': 'نص الطلبات غير موجود في التطبيق بعد.', 'sv': 'Förbönernas text finns inte i appen än.'},
    ]
    if conclusion != '06:388':
        items.append(lib(conclusion))
        return items
    # 06:388: the priest's petitions, each answered with Kyrie eleison; the first answer twelve times.
    l = lib_lines(conclusion)
    sv = [
        'Gud, förbarma dig över oss, besluta barmhärtighet för oss, gör barmhärtighet med oss i ditt rike.',
        'Fridens konung, ge oss din frid, besluta din frid för oss och förlåt oss våra synder.',
        'Skingra kyrkans fiender och befäst henne, så att hon aldrig vacklar.',
        'Emmanuel, vår Gud, är nu mitt ibland oss i sin gode Faders och den helige Andes härlighet.',
        'Må han välsigna oss alla, rena våra hjärtan och hela våra själars och kroppars sjukdomar.',
    ]
    for i, k in enumerate(range(0, 10, 2)):
        items.append({'t': 'say', 'r': 'priest', 'ar': l[k], 'sv': sv[i]})
        items.append({'t': 'say', 'r': 'people', 'ar': 'يا رب ارحم.', 'sv': 'Herre, förbarma dig.'})
        if k == 0:
            items.append({'t': 'rubric', 'ar': 'اثنتا عشرة مرة، ثلاثاً كل خورس.', 'sv': 'Tolv gånger, tre för varje kör.'})
    items.append({'t': 'say', 'r': 'people', 'ar': l[10], 'sv': 'Vi tillber dig, Kristus, med din gode Fader och den helige Ande, ty du blev korsfäst och frälste oss.'})
    return items


def close():
    l = lib_lines('06:1723')
    return [
        {'t': 'h', 'ar': 'الختام', 'sv': 'Avslutningen'},
        {'t': 'say', 'ar': l[0], 'sv': 'Ära vare Fadern och Sonen och den helige Ande, nu och alltid och i evigheters evighet. Amen.'},
        {'t': 'say', 'ar': f'{l[1]} {l[2].split(".")[0]}.',
         'sv': 'Vi ropar och säger: Vår Herre Jesus Kristus, du som blev korsfäst på korset och krossade Satan under våra fötter, frälsa oss och förbarma dig över oss.'},
        {'t': 'say', 'ar': '.'.join(l[2].split('.')[1:]).strip(),
         'sv': 'Herre, förbarma dig. Herre, förbarma dig. Herre, välsigna. Amen. Välsigna denna metania. Förlåt mig. Säg välsignelsen.'},
        {'t': 'rubric', 'ar': 'ويختم الكاهن بالبركة.', 'sv': 'Prästen avslutar med välsignelsen.'},
    ]


# ---------- What the hymn library adds to particular services ----------

# A Pascha hour: texts that take a place of the hour's own (its exposition, its psalm, the close of its
# litanies), texts said at a known point, and texts the library has for the hour without saying where.
HOURS = {
    ('holy_monday', 'باكر'): {'tarh': '06:1721'},
    ('covenant_thursday', 'باكر'): {
        'start': ['20:1725'], 'after_epistles': ['20:1727'], 'before_gospel': ['20:1728'],
        'tarh': '20:1731', 'conclusion': '20:1740',
    },
    ('good_friday', 'السادسة'): {'psalm': '06:1758', 'also': ['06:380', '06:1757', '06:149', '06:1819', '06:1759', '06:381']},
    ('good_friday', 'التاسعة'): {'psalm': '06:1764', 'also': ['06:1763']},
    ('good_friday', 'الحادية عشرة'): {'psalm': '06:1766'},
    # After the litanies (06:1769 says so): the cross raised, Golgotha, and the burial.
    ('good_friday', 'الثانية عشرة'): {'psalm': '06:1767', 'after_litanies': ['06:1768', '06:1769', '06:209', '06:1770']},
}

# Other services in the library's order: 'r0', 'r1'... are the service's readings, in their order.
ORDERS = {
    ('palm_sunday', 'الجناز العام - السادسة'): ['06:1827', '06:1706', 'r0', '06:1708', 'r1', '06:1710', '06:1711', '06:1712', 'r2', '06:1714'],
    ('covenant_thursday', 'لقان خميس العهد'): ['20:1733', '20:1734', 'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', '20:1737', 'r8', 'r9', 'r10',
                                              '20:1742', '20:1741', '20:1743', '20:1744', '20:1745', '20:1746', '20:1747', '20:1748', '20:2660'],
    ('covenant_thursday', 'القداس'): ['r0', '20:1511', 'r1', 'r2', '20:1752', '20:1753'],
    ('bright_saturday', 'باكر'): ['r0', '06:1788', 'r1', '06:950', 'r2', 'r3', '06:952', '06:1791', '06:953'],
}
# The Apocalypse night: the biblical odes; the library's hymns of the night; then the Revelation, read whole.
APOCALYPSE_ALSO = ['06:91', '06:284', '06:154', '06:1781', '06:946', '06:947', '06:1516', '06:962', '06:965']
REVELATION = {'kind': 'reading', 'kindAr': 'سفر الرؤيا', 'kindSv': 'Uppenbarelseboken', 'ref': ' / '.join(f'rev {c}' for c in range(1, 23)), 'wholeChapter': True}

ALSO_HEADING = {'t': 'h', 'ar': 'يُقال أيضاً في هذه الخدمة', 'sv': 'Sägs också i denna gudstjänst'}
ALSO_NOTE = {'t': 'note', 'ar': 'نصوص من مكتبة الألحان بترتيبها هناك، دون تحديد موضعها في الخدمة.',
             'sv': 'Texter ur hymnbiblioteket i den ordning de står där. Exakt var i gudstjänsten de sägs anges inte.'}


def book_of(ref):
    return ref.split()[0]


def reading_items(r, books_by_abbr, pascha):
    """A reading, with the opening and closing the Pascha gives it."""
    if not pascha:
        return [{'t': 'reading', **r}]
    if r['kind'] == 'prophecy':
        return [prophecy_intro(book_of(r['ref']), books_by_abbr), {'t': 'reading', **r}, prophecy_close()]
    if r['kind'] == 'psalm':
        return [PSALM_INTRO, {'t': 'reading', **r}, PSALM_TUNE]
    return [{'t': 'reading', **r}]


def pascha_hour(day_id, service, night, books_by_abbr):
    extra = HOURS.get((day_id, service['ar'].split(' - ')[-1]), {})
    rs = service['readings']
    kinds = lambda *ks: [r for r in rs if r['kind'] in ks]
    items = [lib(x) for x in extra.get('start', [])]
    for r in kinds('prophecy'):
        items += reading_items(r, books_by_abbr, True)
    items.append({'t': 'praise'})
    for r in kinds('pauline', 'catholic', 'praxis', 'ode'):
        items += reading_items(r, books_by_abbr, True)
    items += [lib(x) for x in extra.get('after_epistles', [])]
    if extra.get('psalm'):
        items += [lib(extra['psalm']), PSALM_TUNE]
    for r in kinds('psalm'):
        items += reading_items(r, books_by_abbr, True)
    if not extra.get('psalm') and not kinds('psalm'):
        items.append({'t': 'note', 'ar': 'مزمور الساعة غير موجود في المصدر بعد.', 'sv': 'Timmens psalm finns inte i källan än.'})
    items += [lib(x) for x in extra.get('before_gospel', [])]
    gospels = kinds('gospel')
    if gospels:
        items.append(gospel_call())
    for r in gospels:
        items += [gospel_prayer(book_of(r['ref'])), {'t': 'reading', **r}, GOSPEL_END]
    items += exposition(night, extra.get('tarh'))
    items += litanies(night, extra.get('conclusion', '06:388'))
    items += [lib(x) for x in extra.get('after_litanies', [])]
    items += close()
    if extra.get('also'):
        items += [ALSO_HEADING, ALSO_NOTE] + [lib(x) for x in extra['also']]
    return items


def other_service(day_id, service, books_by_abbr):
    rs = service['readings']
    order = ORDERS.get((day_id, service['ar']))
    if order:
        used = {int(x[1:]) for x in order if x.startswith('r')}
        missing = [i for i in range(len(rs)) if i not in used]
        if missing:
            raise SystemExit(f'{day_id} {service["ar"]}: readings {missing} have no place in the order')
        return [{'t': 'reading', **rs[int(x[1:])]} if x.startswith('r') else lib(x) for x in order]
    items = [{'t': 'reading', **r} for r in rs]
    if service['ar'] == 'الأبوغلمسيس':
        items += [ALSO_HEADING, ALSO_NOTE] + [lib(x) for x in APOCALYPSE_ALSO]
        items += [lib('06:957'), lib('06:958'), {'t': 'reading', **REVELATION}]
    return items
