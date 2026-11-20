/*
 * Ytan: det som ligger bakom innehållet.
 *
 * Två shaderytor, båda utan en enda siffra på sig:
 *   1. Bottnen bakom hela appen. En mycket dämpad gradientväv som rör sig långsamt.
 *   2. Märket F i menyn. Flytande metall.
 *
 * Regeln i DESIGN.md gäller: effekter ligger bakom innehållet, aldrig på det. Kort,
 * tabeller, nyckeltal och staplar rör den inte, eftersom färg i den här appen betyder
 * avvikelse och en gradient i ytan skulle konkurrera med gult och rött.
 *
 * Utan WebGL ritas ingenting och appen ser ut som den alltid har gjort. Har användaren
 * valt minskad rörelse ritas en enda stillbild i stället för en slinga.
 */
(function () {
  'use strict';

  var GL = [];          /* alla ytor, så att temabyte kan rita om dem */
  var running = false;

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function hex(v, fallback) {
    var s = (v || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function cssColor(name, fallback) {
    try {
      return hex(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
    } catch (e) { return fallback; }
  }

  var VERT = [
    'attribute vec2 p;',
    'void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
  ].join('\n');

  /*
   * Bottnen. Två lager mjukt brus som driver åt olika håll och blandar tre toner
   * nära appens egen bottenfärg. Amplituden är avsiktligt liten: den ska kännas,
   * inte synas.
   */
  var FRAG_MESH = [
    'precision mediump float;',
    'uniform vec2 u_res;',
    'uniform float u_t;',
    'uniform vec3 u_a;',
    'uniform vec3 u_b;',
    'uniform vec3 u_c;',
    'uniform float u_amp;',
    'float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 v){',
    '  vec2 i = floor(v); vec2 f = fract(v);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 v){',
    '  float s = 0.0; float a = 0.5;',
    '  for (int i = 0; i < 4; i++) { s += a * noise(v); v *= 2.02; a *= 0.5; }',
    '  return s;',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  vec2 q = vec2(uv.x * 1.6, uv.y);',
    '  float n1 = fbm(q * 1.7 + vec2(u_t * 0.035, u_t * -0.021));',
    '  float n2 = fbm(q * 2.3 + vec2(-u_t * 0.027, u_t * 0.019) + 4.7);',
    '  vec3 col = mix(u_a, u_b, smoothstep(0.25, 0.85, n1));',
    '  col = mix(col, u_c, smoothstep(0.35, 0.95, n2) * 0.55);',
    '  vec3 base = u_a;',
    '  gl_FragColor = vec4(mix(base, col, u_amp), 1.0);',
    '}'
  ].join('\n');

  /*
   * Märket. Flytande metall: ett veckat fält som ger ljusa band, färgat av
   * accentfärgen så att det fortfarande är Fabrikens blå och inte en regnbåge.
   */
  var FRAG_METAL = [
    'precision mediump float;',
    'uniform vec2 u_res;',
    'uniform float u_t;',
    'uniform vec3 u_a;',
    'uniform vec3 u_b;',
    'float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 v){',
    '  vec2 i = floor(v); vec2 f = fract(v);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  float w = noise(uv * 3.0 + vec2(u_t * 0.10, u_t * 0.06));',
    '  w += 0.5 * noise(uv * 6.5 - vec2(u_t * 0.07, u_t * 0.11));',
    '  float bands = sin((uv.x + uv.y) * 7.0 + w * 5.2 + u_t * 0.5);',
    '  float sheen = pow(0.5 + 0.5 * bands, 2.6);',
    '  vec3 col = mix(u_a, u_b, sheen);',
    '  col += vec3(0.10) * pow(sheen, 6.0);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }

  /* Startar en yta. Returnerar null om något saknas; då ritas ingenting alls. */
  function surface(canvas, frag, uniforms, opts) {
    var gl;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
    } catch (e) { return null; }
    if (!gl) return null;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ['u_res', 'u_t', 'u_a', 'u_b', 'u_c', 'u_amp'].forEach(function (k) {
      u[k] = gl.getUniformLocation(prog, k);
    });

    var o = opts || {};
    var dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr || 1.5);

    function size() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * dpr * (o.scale || 1)));
      var h = Math.max(1, Math.round(r.height * dpr * (o.scale || 1)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function draw(t) {
      size();
      var c = uniforms();
      gl.uniform2f(u.u_res, canvas.width, canvas.height);
      gl.uniform1f(u.u_t, t);
      if (u.u_a) gl.uniform3fv(u.u_a, c.a);
      if (u.u_b) gl.uniform3fv(u.u_b, c.b);
      if (u.u_c && c.c) gl.uniform3fv(u.u_c, c.c);
      if (u.u_amp) gl.uniform1f(u.u_amp, c.amp === undefined ? 1 : c.amp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return { draw: draw, canvas: canvas, gl: gl };
  }

  /* Botten och märke har olika toner i ljust och mörkt läge. */
  function meshColors() {
    var dark = isDark();
    return {
      a: cssColor('--canvas', dark ? [0.043, 0.059, 0.090] : [0.953, 0.961, 0.976]),
      b: dark ? [0.075, 0.110, 0.180] : [0.898, 0.925, 0.976],
      c: dark ? [0.055, 0.090, 0.130] : [0.937, 0.953, 0.937],
      /* Amplituden är liten med flit. Ytan ska kännas, inte synas. */
      amp: dark ? 0.85 : 0.70
    };
  }

  function metalColors() {
    var dark = isDark();
    return {
      a: dark ? [0.13, 0.23, 0.52] : [0.086, 0.247, 0.700],
      b: dark ? [0.72, 0.82, 1.00] : [0.72, 0.82, 1.00]
    };
  }

  function isDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }

  function loop() {
    if (!GL.length) return;
    var still = reduced();
    var t0 = (window.performance && performance.now ? performance.now() : Date.now()) / 1000;

    function frame() {
      var now = (window.performance && performance.now ? performance.now() : Date.now()) / 1000;
      var t = still ? 0 : now - t0;
      GL.forEach(function (s) { try { s.draw(t * s.speed); } catch (e) { /* ytan är inte livsviktig */ } });
      if (!still) requestAnimationFrame(frame);
    }
    frame();
  }

  function init() {
    if (running) return;
    running = true;

    var bg = document.getElementById('surface-bg');
    if (bg) {
      /* Bottnen ritas i låg upplösning: den är suddig ändå och ska inte kosta något. */
      var s = surface(bg, FRAG_MESH, meshColors, { scale: 0.35, maxDpr: 1 });
      if (s) { s.speed = 1; GL.push(s); bg.classList.add('on'); }
    }

    mountMark();
    loop();

    /* Menyn ritas om vid sidbyte, så märket måste hittas på nytt. */
    var mo = new MutationObserver(function () { mountMark(); });
    var nav = document.getElementById('nav');
    if (nav) mo.observe(nav, { childList: true, subtree: true });

    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        GL.forEach(function (s) { try { s.draw(0); } catch (e) {} });
      });
    } catch (e) { /* äldre webbläsare */ }
  }

  var markSurface = null;   /* bara en metallyta i taget */

  /*
   * Lägger metallytan i märket. Menyn ritas om vid varje sidbyte, så märket är ett
   * nytt element varje gång. Två fällor undviks här:
   *
   *   1. data-surface sätts innan canvasen läggs in. Utan den skulle ett misslyckat
   *      försök ta bort canvasen, vilket i sin tur är en DOM-ändring som väcker
   *      observatören nedan, som försöker igen: en oändlig slinga som låser sidan.
   *   2. Den gamla ytans WebGL-kontext släpps. Annars tar de slut efter ett tiotal
   *      sidbyten, eftersom webbläsare bara tillåter ett fåtal samtidigt.
   */
  function mountMark() {
    var mark = document.querySelector('.brand-mark');
    if (!mark || mark.getAttribute('data-surface')) return;
    mark.setAttribute('data-surface', 'pending');

    if (markSurface) {
      var i = GL.indexOf(markSurface);
      if (i >= 0) GL.splice(i, 1);
      try {
        var ext = markSurface.gl && markSurface.gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (e) { /* kontexten är ändå på väg bort */ }
      markSurface = null;
    }

    var c = document.createElement('canvas');
    c.className = 'mark-surface';
    c.setAttribute('aria-hidden', 'true');
    mark.insertBefore(c, mark.firstChild);

    var s = surface(c, FRAG_METAL, metalColors, { maxDpr: 2 });
    if (s) {
      s.speed = 1;
      markSurface = s;
      GL.push(s);
      mark.classList.add('has-surface');
      mark.setAttribute('data-surface', 'on');
    } else {
      c.remove();
      mark.setAttribute('data-surface', 'off');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.OOSSurface = { init: init, isDark: isDark };
})();
