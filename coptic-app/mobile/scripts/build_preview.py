#!/usr/bin/env python3
"""Turn the Expo web export (dist/) into a preview that works from any folder.

`expo export --platform web` writes root-relative URLs ("/_expo/...",
"/assets/..."), which only work when the site is served from the domain root.
This copies dist/ to <out>, makes those URLs relative, and adds a <base> that
pins them to the folder the page was loaded from (expo-router changes the
path with pushState while you navigate). "_expo" becomes "app", since some
hosts reserve names that start with an underscore.

Usage:
    npx expo export --platform web
    python3 scripts/build_preview.py <out-dir>
"""

import os
import re
import shutil
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DIST = os.path.join(ROOT, 'dist')

PAGE = """<title>Koptisk bönbok</title>
<style>
  :root { --bg: #F3F1F2; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0F0D0E; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #0F0D0E; color-scheme: dark; }
  html, body { height: 100%; }
  body { overflow: hidden; background: var(--bg); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<script>
  // Resolve the app's relative URLs against the folder this page was loaded from.
  (function () {
    var base = document.createElement('base');
    base.href = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    document.head.prepend(base);
  })();
</script>
<div id="root"></div>
"""


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = os.path.abspath(sys.argv[1])
    if os.path.exists(out):
        shutil.rmtree(out)
    shutil.copytree(DIST, out, ignore=shutil.ignore_patterns('index.html', 'favicon.ico', 'metadata.json'))

    os.rename(os.path.join(out, '_expo'), os.path.join(out, 'app'))
    for dirpath, _, names in os.walk(os.path.join(out, 'app')):
        for name in names:
            if not name.endswith('.js'):
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding='utf-8') as f:
                js = f.read()
            js = js.replace('"/_expo/static/', '"app/static/').replace('"/assets/', '"assets/')
            with open(path, 'w', encoding='utf-8') as f:
                f.write(js)

    with open(os.path.join(DIST, 'index.html'), encoding='utf-8') as f:
        scripts = re.findall(r'<script src="/(_expo/[^"]+)" defer></script>', f.read())
    page = PAGE + ''.join(f'<script src="{s.replace("_expo/", "app/", 1)}" defer></script>\n' for s in scripts)
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(page)

    files = sum(len(n) for _, _, n in os.walk(out))
    size = sum(os.path.getsize(os.path.join(d, x)) for d, _, n in os.walk(out) for x in n)
    print(f'Wrote {out}: {files} files, {size / 1e6:.1f} MB', file=sys.stderr)


if __name__ == '__main__':
    main()
