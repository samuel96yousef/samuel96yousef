/*
 * Bygger en fristående HTML-fil av POC:n (all CSS och JS inbäddad) för att dela via e-post eller Teams.
 *
 *   node tools/bundle.js                     -> dist/fabriken-oos.html
 *   node tools/bundle.js --fragment <fil>    -> sidfragment utan <html>/<head>/<body> (för publicering som artifact)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const outArg = args.filter((a) => !a.startsWith('--'))[0];
const out = outArg ? path.resolve(outArg) : path.join(root, 'dist', 'fabriken-oos.html');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) => {
  return '<style>\n' + fs.readFileSync(path.join(root, href), 'utf8') + '\n</style>';
});
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  if (code.includes('</script')) throw new Error(src + ' innehåller </script och kan inte bäddas in.');
  return '<script>\n' + code + '\n</script>';
});

if (fragment) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Skrev ' + path.relative(process.cwd(), out) + ' (' + Math.round(html.length / 1024) + ' kB)');
