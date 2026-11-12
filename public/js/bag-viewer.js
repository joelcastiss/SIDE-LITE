/*
 * SIDE Lite - visor 3D de bolsos (Basica / Media / Premium)
 * Requiere Three.js r128 (js/vendor/three.min.js) cargado antes que este archivo.
 *
 * API publica (window.SideBags):
 *   SideBags.mount(canvas, 'basica' | 'media' | 'premium', opciones) -> controlador
 *     opciones: { width, height, auto, sparkles, pedestal, quality }
 *       width/height  tamano en px (por defecto 200 x 230)
 *       auto          true = da una vuelta cada ~5.6 s (por defecto true)
 *       sparkles      true/false, destellos flotantes (por defecto true)
 *       pedestal      true/false, disco y aro dorado (por defecto true)
 *       quality       'alta' | 'media' | 'baja' (pixel ratio 2 / 1.5 / 1)
 *     controlador: { spin(), setAuto(bool), setActive(bool), resize(w,h), dispose() }
 *   SideBags.supported() -> true si el navegador soporta WebGL
 *   SideBags.mountAll(root) -> monta todos los <canvas data-bag="basica|media|premium">
 *
 * Todo el modelo es procedural: no hay imagenes externas ni derechos de autor de terceros.
 */
(function (global) {
  'use strict';

  var THREE = global.THREE;
  var GOLD = 0xe8c262, GOLD_OL = 0x6d4f10, RUBY = 0xd7263d;
  var THEMES = {
    basica:  { glow: 0xf0d9a8, rim: 0xffe2a8, ped: 0x3a3320, n: 4 },
    media:   { glow: 0xffa24a, rim: 0xffb066, ped: 0x3a2616, n: 8 },
    premium: { glow: 0xd05cff, rim: 0xe08cff, ped: 0x2b2146, n: 14 }
  };
  var BUILDERS = {};
  var T_LOOP = 5.6, T_SPIN = 5.6;
  var shared = { grad: null, star: null };
  var instances = [];
  var rafId = 0;

  function supported() {
    try {
      var c = document.createElement('canvas');
      if (!global.WebGLRenderingContext) return false;
      var context = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!context) return false;
      var lose = context.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  function ensureShared() {
    if (!shared.grad) {
      var gd = new Uint8Array([70, 120, 170, 215, 255]);
      var t = new THREE.DataTexture(gd, gd.length, 1, THREE.LuminanceFormat);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.needsUpdate = true;
      shared.grad = t;
    }
    if (!shared.star) shared.star = starTex();
  }

  function toon(c) {
    var o = { color: c, gradientMap: shared.grad };
    if (c === GOLD) o.emissive = 0x3d2d00;
    if (c === RUBY) o.emissive = 0x550010;
    return new THREE.MeshToonMaterial(o);
  }
  function ob(c) { return new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }); }

  function part(parent, geo, color, olc, k, x, y, z, ry) {
    var m = new THREE.Mesh(geo, toon(color));
    m.position.set(x || 0, y || 0, z || 0);
    if (ry) m.rotation.y = ry;
    parent.add(m);
    if (olc != null) {
      var o = new THREE.Mesh(geo, ob(olc));
      o.position.copy(m.position);
      o.rotation.copy(m.rotation);
      o.scale.setScalar(k || 1.04);
      parent.add(o);
    }
    return m;
  }
  function ext(shape, depth, bt, bs, seg) {
    var g = new THREE.ExtrudeGeometry(shape, {
      depth: depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs,
      bevelSegments: seg || 5, curveSegments: 24
    });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  function rrect(x0, y0, x1, y1, r, C) {
    var s = new (C || THREE.Shape)();
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }
  function tube(parent, curve, r, color, olc, flat) {
    var m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 12, false), toon(color));
    var o = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r + 0.045, 12, false), ob(olc));
    if (flat) { m.scale.z = flat; o.scale.z = flat; }
    parent.add(m); parent.add(o);
  }
  function decal(w, h, draw, x, y, z, back) {
    var c = document.createElement('canvas');
    c.width = Math.round(w * 160); c.height = Math.round(h * 160);
    var cx = c.getContext('2d');
    cx.scale(160, 160); cx.lineCap = 'round';
    draw(cx, w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.position.set(x, y, z);
    if (back) m.rotation.y = Math.PI;
    return m;
  }

  /* ---------- Basica: tote de lona ---------- */
  BUILDERS.basica = function () {
    var g = new THREE.Group();
    var s = new THREE.Shape();
    s.moveTo(-1.45, .85); s.lineTo(1.45, .85); s.lineTo(1.62, -.95);
    s.quadraticCurveTo(1.64, -1.15, 1.44, -1.15);
    s.lineTo(-1.44, -1.15); s.quadraticCurveTo(-1.64, -1.15, -1.62, -.95); s.closePath();
    part(g, ext(s, .8, .14, .14, 6), 0xe0cba6, 0x4a3920, 1.03, 0, 0, 0);
    part(g, new THREE.BoxGeometry(3.12, .3, 1.14), 0xc4ab80, 0x4a3920, 1.03, 0, .86, 0);
    var hc = new THREE.CubicBezierCurve3(new THREE.Vector3(-.62, .95, 0), new THREE.Vector3(-.8, 3.1, 0),
      new THREE.Vector3(.8, 3.1, 0), new THREE.Vector3(.62, .95, 0));
    tube(g, hc, .1, 0xb88f58, 0x4a3920, .6);
    var tg = new THREE.Shape();
    tg.moveTo(-.2, 0); tg.lineTo(.2, 0); tg.lineTo(.2, -.55); tg.lineTo(0, -.88); tg.lineTo(-.2, -.55); tg.closePath();
    var tgeo = ext(tg, .03, .03, .03, 2);
    [1, -1].forEach(function (sg) {
      var z = sg * .60, ry = sg > 0 ? 0 : Math.PI;
      [-.62, .62].forEach(function (px) {
        part(g, tgeo, 0x9b7b52, 0x3f2f17, 1.08, px, .98, z, ry);
        var rv = new THREE.Mesh(new THREE.SphereGeometry(.065, 14, 10), toon(0xd0d6df));
        rv.scale.z = .6; rv.position.set(px, .7, sg * .655); g.add(rv);
      });
      g.add(decal(3.24, 2.0, function (x, w, h) {
        x.strokeStyle = 'rgba(120,98,62,.55)'; x.lineWidth = .02;
        for (var i = 0; i < 50; i++) {
          var px = .2 + Math.random() * (w - .4), py = .5 + Math.random() * (h - .7), l = .07 + Math.random() * .06;
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py + (Math.random() - .5) * .03); x.stroke();
        }
        var L = function (y) { return .30 - .0944 * y; };
        x.setLineDash([.07, .06]); x.strokeStyle = 'rgba(255,246,222,.9)'; x.lineWidth = .024;
        x.beginPath(); x.moveTo(L(.3), .3); x.lineTo(L(1.75), 1.75); x.stroke();
        x.beginPath(); x.moveTo(w - L(.3), .3); x.lineTo(w - L(1.75), 1.75); x.stroke();
        x.beginPath(); x.moveTo(L(1.8), 1.8); x.lineTo(w - L(1.8), 1.8); x.stroke();
        x.beginPath(); x.moveTo(L(.45), .45); x.lineTo(w - L(.45), .45); x.stroke();
        if (sg > 0) {
          x.setLineDash([]); x.fillStyle = '#b5532f'; x.strokeStyle = '#4a2a14'; x.lineWidth = .03;
          x.beginPath(); x.rect(w - 1.15, 1.05, .7, .44); x.fill(); x.stroke();
          x.setLineDash([.05, .04]); x.strokeStyle = 'rgba(255,236,196,.9)'; x.lineWidth = .02;
          x.beginPath(); x.rect(w - 1.1, 1.1, .6, .34); x.stroke();
          x.setLineDash([]); x.fillStyle = '#f8e6bc'; x.font = 'bold .17px sans-serif'; x.textAlign = 'center';
          x.fillText('SIDE', w - .8, 1.33);
        }
      }, 0, -.15, sg * .545, sg < 0));
    });
    return g;
  };

  /* ---------- Media: bolso de cupula con marco dorado ---------- */
  BUILDERS.media = function () {
    var g = new THREE.Group();
    var s = new THREE.Shape();
    s.moveTo(-1.2, -1.1); s.lineTo(1.2, -1.1);
    s.quadraticCurveTo(1.76, -1.1, 1.78, -.55);
    s.bezierCurveTo(1.82, -.05, 1.7, .3, 1.25, .55);
    s.quadraticCurveTo(0, 1.15, -1.25, .55);
    s.bezierCurveTo(-1.7, .3, -1.82, -.05, -1.78, -.55);
    s.quadraticCurveTo(-1.76, -1.1, -1.2, -1.1);
    s.closePath();
    part(g, ext(s, .8, .2, .2, 8), 0xc07a40, 0x3a2010, 1.025, 0, 0, 0);
    var fc = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.5, .58, 0), new THREE.Vector3(0, 1.65, 0), new THREE.Vector3(1.5, .58, 0));
    tube(g, fc, .07, GOLD, GOLD_OL, 1);
    var hc = new THREE.CubicBezierCurve3(new THREE.Vector3(-.7, .95, 0), new THREE.Vector3(-.82, 2.7, 0),
      new THREE.Vector3(.82, 2.7, 0), new THREE.Vector3(.7, .95, 0));
    tube(g, hc, .09, 0xae6a32, 0x3a2010, .85);
    var rg = new THREE.TorusGeometry(.095, .03, 8, 18);
    [-1, 1].forEach(function (sx) {
      [1, -1].forEach(function (sg) {
        part(g, rg, GOLD, GOLD_OL, 1.25, sx * .74, 1.02, sg * .14, 0);
        part(g, rg, GOLD, GOLD_OL, 1.25, sx * .8, .88, sg * .17, Math.PI / 2);
        part(g, rg, GOLD, GOLD_OL, 1.25, sx * .76, .74, sg * .2, 0);
      });
      part(g, new THREE.TorusGeometry(.14, .045, 8, 16), GOLD, GOLD_OL, 1.2, sx * 2.0, -.2, 0, Math.PI / 2);
    });
    var cl = part(g, new THREE.CylinderGeometry(.15, .15, .07, 28), GOLD, GOLD_OL, 1.2, 0, .42, .66, 0);
    cl.rotation.x = Math.PI / 2; g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    part(g, new THREE.SphereGeometry(.05, 12, 10), 0xfff6c9, null, 1, -.05, .46, .71, 0);
    function stitch(x, pf) {
      x.setLineDash([]); x.strokeStyle = 'rgba(90,48,20,.7)'; x.lineWidth = .045; x.beginPath(); pf(); x.stroke();
      x.setLineDash([.07, .06]); x.strokeStyle = 'rgba(248,212,156,.95)'; x.lineWidth = .024;
      x.save(); x.translate(0, .035); x.beginPath(); pf(); x.stroke(); x.restore();
    }
    function P(px, py) { return [px + 1.8, .9 - py]; }
    function seams(x) {
      var a = P(-1.55, .12), b = P(0, .62), c = P(1.55, .12);
      stitch(x, function () { x.moveTo(a[0], a[1]); x.quadraticCurveTo(b[0], b[1], c[0], c[1]); });
      var l0 = P(-1.5, .08), l1 = P(-1.68, -.5), l2 = P(-1.42, -.98);
      stitch(x, function () { x.moveTo(l0[0], l0[1]); x.quadraticCurveTo(l1[0], l1[1], l2[0], l2[1]); });
      var r0 = P(1.5, .08), r1 = P(1.68, -.5), r2 = P(1.42, -.98);
      stitch(x, function () { x.moveTo(r0[0], r0[1]); x.quadraticCurveTo(r1[0], r1[1], r2[0], r2[1]); });
    }
    function pocket(x) {
      var px = .72, py = 1.05, pw = 2.16, ph = .8, r = .14;
      function rp() {
        x.moveTo(px + r, py); x.lineTo(px + pw - r, py); x.quadraticCurveTo(px + pw, py, px + pw, py + r);
        x.lineTo(px + pw, py + ph - r); x.quadraticCurveTo(px + pw, py + ph, px + pw - r, py + ph);
        x.lineTo(px + r, py + ph); x.quadraticCurveTo(px, py + ph, px, py + ph - r);
        x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py);
      }
      x.setLineDash([]); x.fillStyle = 'rgba(70,36,14,.2)'; x.beginPath(); rp(); x.fill();
      stitch(x, rp);
    }
    g.add(decal(3.6, 2.0, function (x, w, h) {
      seams(x); pocket(x);
      x.setLineDash([]); x.strokeStyle = 'rgba(120,70,30,.35)'; x.lineWidth = .02;
      for (var i = 0; i < 70; i++) {
        var px = .3 + Math.random() * (w - .6), py = .3 + Math.random() * (h - .4);
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + .04, py + .015); x.stroke();
      }
    }, 0, -.1, .605, false));
    g.add(decal(3.6, 2.0, function (x) { seams(x); pocket(x); }, 0, -.1, -.605, true));
    return g;
  };

  /* ---------- Premium: bolso con solapa y hebilla dorada ---------- */
  BUILDERS.premium = function () {
    var g = new THREE.Group();
    part(g, ext(rrect(-1.65, -1.0, 1.65, .95, .22), .7, .1, .1, 6), 0x82213a, 0x2a0a12, 1.025, 0, 0, 0);
    var fs = new THREE.Shape();
    fs.moveTo(-1.6, .95); fs.lineTo(1.6, .95); fs.lineTo(1.6, .15);
    fs.quadraticCurveTo(.9, -.12, 0, -.42); fs.quadraticCurveTo(-.9, -.12, -1.6, .15); fs.closePath();
    part(g, ext(fs, .06, .03, .03, 3), 0x9a2943, 0x2a0a12, 1.02, 0, 0, .5);
    part(g, ext(rrect(-.27, -.8, .27, .98, .06), .03, .02, .02, 2), 0x5e1428, 0x2a0a12, 1.04, 0, 0, .6);
    var bs = rrect(-.42, -.78, .42, -.12, .13);
    bs.holes.push(rrect(-.29, -.66, .29, -.24, .08, THREE.Path));
    part(g, ext(bs, .05, .03, .03, 3), GOLD, GOLD_OL, 1.05, 0, 0, .68);
    part(g, new THREE.BoxGeometry(.6, .07, .07), GOLD, GOLD_OL, 1.2, 0, -.45, .7);
    part(g, new THREE.SphereGeometry(.1, 18, 14), RUBY, GOLD_OL, 1.25, 0, .55, .67);
    var hc = new THREE.CubicBezierCurve3(new THREE.Vector3(-1.0, .95, 0), new THREE.Vector3(-1.15, 2.6, 0),
      new THREE.Vector3(1.15, 2.6, 0), new THREE.Vector3(1.0, .95, 0));
    tube(g, hc, .075, 0x9a2943, 0x2a0a12, 1);
    [-1, 1].forEach(function (sx) {
      part(g, new THREE.CylinderGeometry(.1, .1, .24, 16), GOLD, GOLD_OL, 1.15, sx * 1.0, 1.02, 0, 0);
      part(g, new THREE.TorusGeometry(.12, .03, 8, 18), GOLD, GOLD_OL, 1.2, sx * 1.72, .45, 0, Math.PI / 2);
      [1, -1].forEach(function (sg) {
        part(g, new THREE.SphereGeometry(.075, 12, 10), GOLD, GOLD_OL, 1.2, sx * 1.3, -.82, sg * .47, 0);
      });
    });
    g.add(decal(3.3, 1.4, function (x) {
      var P = function (px, py) { return [px + 1.65, .95 - py]; };
      x.setLineDash([.07, .06]); x.strokeStyle = 'rgba(247,214,150,.95)'; x.lineWidth = .024;
      var a = P(-1.5, .82), b = P(1.5, .82), c = P(1.5, .2), d = P(0, -.28), e = P(-1.5, .2), q1 = P(.9, -.02), q2 = P(-.9, -.02);
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]);
      x.quadraticCurveTo(q1[0], q1[1], d[0], d[1]); x.quadraticCurveTo(q2[0], q2[1], e[0], e[1]);
      x.closePath(); x.stroke();
    }, 0, .25, .566, false));
    g.add(decal(3.3, .6, function (x, w) {
      x.setLineDash([.07, .06]); x.strokeStyle = 'rgba(247,214,150,.9)'; x.lineWidth = .024;
      x.beginPath(); x.moveTo(.2, .3); x.lineTo(w - .2, .3); x.stroke();
    }, 0, -.7, .455, false));
    g.add(decal(3.3, 1.9, function (x, w, h) {
      x.setLineDash([.07, .06]); x.strokeStyle = 'rgba(247,214,150,.9)'; x.lineWidth = .024;
      x.beginPath(); x.moveTo(.35, .5); x.lineTo(w - .35, .5); x.lineTo(w - .35, h - .3); x.lineTo(.35, h - .3); x.closePath(); x.stroke();
    }, 0, 0, -.455, true));
    return g;
  };

  /* ---------- texturas de apoyo ---------- */
  function rgb(hex) { var c = new THREE.Color(hex); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; }
  function glowTex(hex) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), k = rgb(hex);
    var r = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(' + k + ',.85)'); r.addColorStop(.5, 'rgba(' + k + ',.35)'); r.addColorStop(1, 'rgba(' + k + ',0)');
    x.fillStyle = r; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  function starTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,230,150,0)');
    x.fillStyle = r; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#fffbe6'; x.beginPath();
    x.moveTo(32, 2); x.quadraticCurveTo(34, 30, 62, 32); x.quadraticCurveTo(34, 34, 32, 62);
    x.quadraticCurveTo(30, 34, 2, 32); x.quadraticCurveTo(30, 30, 32, 2); x.fill();
    return new THREE.CanvasTexture(c);
  }

  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var reduceMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- montaje ---------- */
  function buildBag(key) {
    return BUILDERS[key]();
  }

  function mount(canvas, key, opts) {
    if (!THREE) throw new Error('SideBags: falta Three.js (js/vendor/three.min.js)');
    if (!BUILDERS[key]) throw new Error('SideBags: calidad desconocida "' + key + '"');
    ensureShared();
    opts = opts || {};
    var th = THEMES[key];
    var W = opts.width || 200, H = opts.height || 230;
    var pr = { alta: 2, media: 1.5, baja: 1 }[opts.quality || 'alta'] || 2;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: pr > 1 });
    try {
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, pr));
    renderer.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';

    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(30, W / H, .1, 50);
    cam.position.set(0, 1.4, 9); cam.lookAt(0, -.15, 0);
    scene.add(new THREE.AmbientLight(0xffffff, .68));
    var dl = new THREE.DirectionalLight(0xffffff, .85); dl.position.set(3, 5, 6); scene.add(dl);
    var rim = new THREE.DirectionalLight(th.rim, .7); rim.position.set(-4, 3, -4); scene.add(rim);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(th.glow), transparent: true, depthWrite: false, opacity: .8 }));
    glow.scale.set(5.4, 5.4, 1); glow.position.set(0, -.1, -2); glow.renderOrder = -2; scene.add(glow);

    var bag = buildBag(key);
    var box = new THREE.Box3().setFromObject(bag);
    var size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    var pivot = new THREE.Group();
    bag.position.sub(ctr); pivot.add(bag);
    var k = Math.min(3.3 / size.y, 2.9 / Math.hypot(size.x, size.z));
    pivot.scale.setScalar(k); scene.add(pivot);
    var bottom = -size.y * k / 2;

    if (opts.pedestal !== false) {
      var ped = new THREE.Group();
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, .2, 56), toon(th.ped)); disc.position.y = bottom - .2; ped.add(disc);
      var disco = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, .2, 56), ob(0x0d0d18)); disco.position.y = bottom - .2; disco.scale.setScalar(1.04); ped.add(disco);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, .05, 8, 64), toon(GOLD)); ring.rotation.x = Math.PI / 2; ring.position.y = bottom - .1; ped.add(ring);
      var ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, .025, 8, 64), new THREE.MeshBasicMaterial({ color: th.glow })); ring2.rotation.x = Math.PI / 2; ring2.position.y = bottom - .095; ped.add(ring2);
      var sh = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.scale.set(size.x * k * .52, .6, 1); sh.position.y = bottom - .085; ped.add(sh);
      scene.add(ped);
    }

    var sparks = [];
    if (opts.sparkles !== false) {
      for (var i = 0; i < th.n; i++) {
        var m = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.star, transparent: true, depthWrite: false, opacity: .8 }));
        sparks.push({ m: m, a: Math.random() * 6.28, r: 1.45 + Math.random() * .5, y: -1.1 + Math.random() * 3.1, ph: Math.random() * 6.28, s: .25 + Math.random() * .25 });
        scene.add(m);
      }
    }

    var inst = {
      renderer: renderer, scene: scene, cam: cam, pivot: pivot, glow: glow, sparks: sparks,
      auto: opts.auto !== false, active: true, t0: null, next: null, key: key
    };
    instances.push(inst);
    startLoop();

    return {
      spin: function () { inst.t0 = now(); },
      setAuto: function (v) { inst.auto = !!v; },
      setActive: function (v) { inst.active = !!v; },
      resize: function (w, h) {
        renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        cam.aspect = w / h; cam.updateProjectionMatrix();
      },
      dispose: function () {
        var ix = instances.indexOf(inst); if (ix >= 0) instances.splice(ix, 1);
        scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            var ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach(function (mm) { if (mm.map && mm.map !== shared.star) mm.map.dispose(); mm.dispose(); });
          }
        });
        renderer.forceContextLoss();
        renderer.dispose();
        if (!instances.length) stopLoop();
      }
    };
    } catch (error) {
      renderer.forceContextLoss();
      renderer.dispose();
      throw error;
    }
  }

  function now() { return (global.performance ? performance.now() : Date.now()) / 1000; }

  function frame() {
    rafId = global.requestAnimationFrame(frame);
    if (document.hidden) return;
    var t = now();
    instances.forEach(function (it, i) {
      if (!it.active) return;
      if (it.next === null) it.next = t + i * 1.1;
      if (it.auto && !reduceMotion && t >= it.next) { it.t0 = t; it.next = t + T_LOOP; }
      var a = 0;
      if (it.t0 !== null && !reduceMotion) {
        var p = (t - it.t0) / T_SPIN;
        if (p >= 1) it.t0 = null; else a = ease(p) * Math.PI * 2;
      }
      it.pivot.rotation.y = reduceMotion ? .5 : a;
      it.pivot.rotation.x = .1;
      it.pivot.position.y = reduceMotion ? 0 : Math.sin(t * 2 + i) * .05;
      it.glow.material.opacity = reduceMotion ? .8 : .7 + .15 * Math.sin(t * 1.6 + i);
      it.sparks.forEach(function (s) {
        var ang = s.a + (reduceMotion ? 0 : t * .25);
        s.m.position.set(Math.cos(ang) * s.r, s.y + (reduceMotion ? 0 : Math.sin(t * 1.1 + s.ph) * .18), Math.sin(ang) * s.r * .55);
        var tw = reduceMotion ? .7 : Math.abs(Math.sin(t * 2 + s.ph));
        s.m.material.opacity = .25 + .75 * tw;
        s.m.scale.set(s.s * (.6 + .6 * tw), s.s * (.6 + .6 * tw), 1);
      });
      it.renderer.render(it.scene, it.cam);
    });
  }
  function startLoop() { if (!rafId && global.requestAnimationFrame) rafId = global.requestAnimationFrame(frame); }
  function stopLoop() { if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } }

  function mountAll(root) {
    var out = [];
    (root || document).querySelectorAll('canvas[data-bag]').forEach(function (cv) {
      try { out.push(mount(cv, cv.getAttribute('data-bag'))); } catch (e) { /* sin WebGL: se queda el respaldo */ }
    });
    return out;
  }

  global.SideBags = {
    mount: mount, mountAll: mountAll, supported: supported,
    _builders: BUILDERS /* solo para pruebas */
  };
})(typeof window !== 'undefined' ? window : globalThis);
