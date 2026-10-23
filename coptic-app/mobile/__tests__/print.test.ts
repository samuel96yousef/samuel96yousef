import type { Row } from '../src/components/Reader';
import { DEFAULT_PRINT, printHtml } from '../src/print/html';

const rows: Row[] = [
  { k: 'top' },
  { k: 'run', ar: 'الأجبية', sv: 'Agpeya' },
  { k: 'cart', ar: 'صلاة باكر', sv: 'Morgonbönen' },
  { k: 'role', r: 'deacon' },
  { k: 'u', u: { t: 'p', ar: 'قوموا', sv: 'Stå upp <nu> & be' }, role: 'deacon' },
  { k: 'u', u: { t: 'v', c: 3, n: 16, ar: 'لأنه هكذا', sv: 'Ty så älskade' }, showC: true },
  { k: 'u', u: { t: 'ref', ar: 'يو 3 : 16', sv: 'Joh 3:16' } },
  { k: 'u', u: { t: 'p', ar: 'فقط عربي' } },
  { k: 'bottom' },
];

describe('printHtml', () => {
  it('sets both languages side by side and escapes the text', () => {
    const html = printHtml([{ rows }], DEFAULT_PRINT, 'Agpeya – Morgon');
    expect(html).toContain('<title>Agpeya – Morgon</title>');
    expect(html).toContain('<div class="sv">Stå upp &lt;nu&gt; &amp; be</div><div class="ar">قوموا</div>');
    expect(html).toContain('<span class="n">3:16</span> Ty så älskade');
    expect(html).toContain('<span class="n">٣:١٦</span> لأنه هكذا');
    expect(html).toContain('class="u t-p r-deacon pair"');
    expect(html).toContain('size: A4');
  });

  it('prints one language, falling back to the other where a unit has only that', () => {
    const html = printHtml([{ rows }], { ...DEFAULT_PRINT, langs: 'sv' }, 'x');
    expect(html).not.toContain('قوموا');
    expect(html).toContain('<div class="ar">فقط عربي</div>');
    expect(html).toContain('<div class="sv">Joh 3:16</div>');
    expect(html).not.toContain('يو ٣');
  });

  it('starts each part on a new page and honours paper and colour', () => {
    const html = printHtml([{ rows }, { rows }], { langs: 'ar', paper: 'A5', size: 'L', color: false }, 'x');
    expect(html.match(/<section class="part">/g)).toHaveLength(2);
    expect(html).toContain('.part + .part { break-before: page; }');
    expect(html).toContain('size: A5');
    expect(html).toContain('--rule: #111');
    expect(html).toContain('lang="ar"');
  });
});
