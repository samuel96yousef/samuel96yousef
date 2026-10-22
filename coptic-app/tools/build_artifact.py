#!/usr/bin/env python3
"""Bundle the prototype into one self-contained HTML fragment.

The output has no <html>/<head>/<body> tags because the artifact host wraps
the page itself. CSS, app code and the exported texts are inlined.

Usage:
    python3 tools/build_artifact.py <out.html>
"""

import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def read(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()


def between(text, start, end):
    m = re.search(re.escape(start) + r'(.*?)' + re.escape(end), text, re.S)
    if not m:
        sys.exit(f'Marker {start} not found in index.html')
    return m.group(1).strip()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    index = read('index.html')
    head = between(index, '<!-- HEAD:START -->', '<!-- HEAD:END -->')
    body = between(index, '<!-- BODY:START -->', '<!-- BODY:END -->')
    data = read(os.path.join('data', 'texts.js')).replace('</script', '<\\/script')
    out = '\n'.join([
        head,
        '<style>', read('styles.css'), '</style>',
        body,
        '<script>', data, '</script>',
        '<script>', read('app.js'), '</script>',
    ])
    with open(sys.argv[1], 'w', encoding='utf-8') as f:
        f.write(out)
    print(f'Wrote {sys.argv[1]} ({len(out.encode("utf-8")) / 1024:.0f} KB)', file=sys.stderr)


if __name__ == '__main__':
    main()
