/*!
 * Living Layer 1.2.0
 * A companion character that follows the reader down the page, gold dust with
 * real depth, and small 3D touches: tilt, depth, 3D reveal and magnetic buttons.
 *
 * One file, no dependencies. Works in plain HTML, React, Next.js, Vue, Svelte.
 * Honours prefers-reduced-motion and adds its own pause button, so moving
 * content can always be stopped (WCAG 2.2.2). MIT licence.
 *
 * Quick start (any site):
 *   <script src="/living-layer.js" defer
 *           data-living-layer='{"character":"bee"}'></script>
 *
 * Then mark things in your HTML:
 *   data-perch          the companion may land here (headings, buttons, cards)
 *   data-perch="corner" land on the element's top-right corner instead of
 *                       beside the end of its first line of text
 *   data-tilt           3D tilt toward the pointer; data-tilt="glare" adds a sheen
 *   data-depth="0.2"    parallax depth on scroll and pointer (hero layers)
 *   data-reveal-3d      rises into place in 3D when scrolled into view
 *   data-magnetic       leans toward the pointer (primary buttons)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LivingLayer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.2.0';
  var TAU = Math.PI * 2;

  /* ======================================================================
   * 1. Maths helpers
   * ==================================================================== */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { var x = ax - bx, y = ay - by; return Math.sqrt(x * x + y * y); }
  function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function turnToward(a, b, t) { return a + wrapAngle(b - a) * t; }
  // Smoothing that feels the same at 30, 60 or 120 frames a second.
  function ease(rate, dt) { return 1 - Math.exp(-rate * dt); }
  function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function norm3(x, y, z) { var l = Math.sqrt(x * x + y * y + z * z); return [x / l, y / l, z / l]; }

  /* ======================================================================
   * 2. Colours. Any CSS colour works: the browser parses it for us.
   * ==================================================================== */
  var parser = null;
  function rgb(c) {
    if (Array.isArray(c)) return c;
    if (!parser) parser = document.createElement('canvas').getContext('2d');
    parser.fillStyle = '#000';
    parser.fillStyle = String(c);
    var s = parser.fillStyle;
    if (s.charAt(0) === '#') {
      return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16), 1];
    }
    var m = s.match(/[\d.]+/g) || [0, 0, 0, 1];
    return [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1];
  }
  function css(c, a) {
    var alpha = clamp((a == null ? 1 : a) * c[3], 0, 1);
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + alpha.toFixed(3) + ')';
  }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
  // Relative luminance, 0 (black) to 1 (white), as used for WCAG contrast.
  function luminance(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  var WHITE = [255, 255, 255, 1], DEEP_GOLD = [104, 64, 0, 1];

  /* ======================================================================
   * 3. The cast. Each species is a body model plus a way of moving.
   *    span:   wingspan in drawing units (shapes below use these units)
   *    size:   default on-screen wingspan in CSS px
   *    omega:  how hard it steers toward its target (higher = snappier)
   *    zeta:   damping (lower = more overshoot and bounce)
   *    rest:   'land' sits on perches, 'hover' hangs in the air beside them
   *    soar:   birds circle instead of hovering (real birds can't hover)
   * ==================================================================== */
  var SPECIES = {
    butterfly: { model: 'butterfly', span: 50, size: 54, omega: 4.2, zeta: 0.5, maxSpeed: 950, flapHz: 5.5, wander: 1, rest: 'land',
      colors: { primary: '#F5B301', secondary: '#9A4A00', dark: '#1A1206', light: '#FFF4D6' } },
    bee: { model: 'bee', span: 36, size: 40, omega: 6, zeta: 0.55, maxSpeed: 1100, flapHz: 30, wander: 0.8, rest: 'hover',
      colors: { primary: '#F2B705', dark: '#1B1408', light: '#FFF7DA', wing: '#FFFFFF' } },
    swallow: { model: 'bird', shape: 'swallow', span: 51, size: 62, omega: 3.4, zeta: 0.75, maxSpeed: 1500, flapHz: 6, wander: 1, rest: 'land', soar: true,
      colors: { primary: '#1E2A44', secondary: '#4A6FA5', accent: '#C8572B', dark: '#0E1424', light: '#F5EBDD' } },
    falcon: { model: 'bird', shape: 'falcon', span: 60, size: 68, omega: 3, zeta: 0.8, maxSpeed: 1600, flapHz: 4.2, wander: 1, rest: 'land', soar: true,
      colors: { primary: '#8A5530', secondary: '#9AA6B2', accent: '#F2C14E', dark: '#24170C', light: '#EFE3CF' } },
    sunbird: { model: 'bird', shape: 'sunbird', span: 39, size: 48, omega: 5.5, zeta: 0.6, maxSpeed: 1200, flapHz: 15, wander: 0.9, rest: 'land', hover: true,
      colors: { primary: '#0E8A4A', secondary: '#45E08F', accent: '#E8442E', dark: '#0B1F14', light: '#E9FFF1' } },
    firefly: { model: 'light', shape: 'firefly', span: 22, size: 34, omega: 2.8, zeta: 0.6, maxSpeed: 800, flapHz: 24, wander: 1.3, rest: 'hover', trail: 'dust',
      colors: { primary: '#2B2418', glow: '#FFD76A', light: '#FFF6D8', accent: '#C2412D' } },
    spark: { model: 'light', shape: 'spark', span: 16, size: 28, omega: 3.6, zeta: 0.7, maxSpeed: 1300, flapHz: 0, wander: 1.1, rest: 'hover', trail: 'line',
      colors: { primary: '#FFC83D', glow: '#FFD76A', light: '#FFF8E1', dark: '#3A2A00' } }
  };

  /* Shapes, seen from above with the head pointing up (negative y).
   * Wings are drawn for the right side and mirrored for the left.
   * Path format: 'M' x y, 'L' x y, 'Q' cx cy x y, 'C' c1x c1y c2x c2y x y, 'Z'. */
  var SHAPES = {
    butterfly: {
      hinge: 1.2, tip: [22, -17],
      fore: ['M', 1.2, -5, 'C', 6, -14, 16, -20, 22, -17.5, 'C', 25.5, -15.5, 23.5, -7.5, 19, -3.5, 'C', 14, 0, 6, 0.2, 1.4, -1, 'Z'],
      hind: ['M', 1.4, -0.6, 'C', 8, 0, 17, 2, 17.2, 9, 'C', 17.4, 15, 11.5, 19.5, 7.2, 17.4, 'C', 4, 15.6, 2, 10, 1.3, 3, 'Z'],
      veins: [[1.6, -3, 18, -14.5], [1.6, -2, 20.5, -7], [1.6, 1, 14.5, 12.5], [1.6, 2, 9, 16]],
      spots: [[19.6, -13.2, 1.25], [21.7, -9.7, 1], [16.6, -15.6, 0.9], [13.8, 14.4, 1.05], [15.8, 10.4, 0.85]]
    },
    swallow: {
      hinge: 3, tip: [25.5, 4.5],
      wing: ['M', 3, -5.5, 'C', 10, -8.5, 19, -5.5, 25.5, 4.5, 'C', 19, 1.2, 11, 1.4, 3.4, 2.4, 'Z'],
      body: ['M', 0, -13.5, 'C', 3, -13.5, 4.6, -9, 4.4, -4, 'C', 4.2, 1, 2.6, 6, 1.6, 8.5, 'L', -1.6, 8.5, 'C', -2.6, 6, -4.2, 1, -4.4, -4, 'C', -4.6, -9, -3, -13.5, 0, -13.5, 'Z'],
      tail: ['M', 1.4, 7.5, 'L', 5, 22.5, 'L', 3.4, 23, 'L', 0, 13.5, 'L', -3.4, 23, 'L', -5, 22.5, 'L', -1.4, 7.5, 'Z'],
      beak: ['M', -1, -13, 'L', 0, -15.8, 'L', 1, -13, 'Z'],
      patch: [0, -11.2, 2.3, 1.7], eyes: [1.7, -11.6]
    },
    falcon: {
      hinge: 3.2, tip: [30, 3.5],
      wing: ['M', 3.2, -6.4, 'C', 11, -9.8, 21, -7.2, 30, 3.5, 'C', 24, 3.6, 16, 4.6, 10.5, 4.9, 'C', 7, 5.1, 4.6, 4.2, 3.6, 2.8, 'Z'],
      body: ['M', 0, -12.4, 'C', 3, -12.4, 4.6, -8.4, 4.5, -3.2, 'C', 4.4, 1.8, 3.2, 5.8, 2.3, 8, 'L', -2.3, 8, 'C', -3.2, 5.8, -4.4, 1.8, -4.5, -3.2, 'C', -4.6, -8.4, -3, -12.4, 0, -12.4, 'Z'],
      tail: ['M', 2.1, 7.2, 'L', 3.3, 20.6, 'Q', 0, 21.9, -3.3, 20.6, 'L', -2.1, 7.2, 'Z'],
      band: null, tailBand: 18.4,
      beak: ['M', -1, -12, 'Q', 0, -14.8, 1, -12, 'Z'],
      cap: [0, -9.6, 3.2, 2.4], eyes: [2.6, -10.2]
    },
    sunbird: {
      hinge: 2.4, tip: [19.5, -3.6],
      wing: ['M', 2.4, -4.4, 'C', 9, -7.4, 16, -7, 19.5, -3.6, 'C', 15, -1.2, 8, 1, 2.6, 1.6, 'Z'],
      body: ['M', 0, -9.2, 'C', 2.6, -9.2, 3.6, -5.6, 3.4, -1.6, 'C', 3.2, 3, 2, 6, 1.2, 7.6, 'L', -1.2, 7.6, 'C', -2, 6, -3.2, 3, -3.4, -1.6, 'C', -3.6, -5.6, -2.6, -9.2, 0, -9.2, 'Z'],
      tail: ['M', 1, 7, 'L', 3.2, 14.6, 'Q', 0, 16.2, -3.2, 14.6, 'L', -1, 7, 'Z'],
      beak: ['M', 0.5, -11.6, 'Q', 0.9, -15.6, 0.35, -19, 'L', -0.35, -19, 'Q', 0.1, -15.6, -0.5, -11.6, 'Z'],
      head: [0, -9.5, 2.9], band: [0, -5.4, 3.3, 1.5], eyes: [2.1, -10]
    }
  };

  var FINISH = { matte: 0, satin: 0.35, foil: 0.9 };
  // Light comes from the top left, slightly toward the viewer.
  var LIGHT = norm3(-0.45, -0.55, 0.7);
  var HALF = norm3(-0.45, -0.55, 1.7);

  /* ======================================================================
   * 4. A tiny 3D projector.
   *    We look straight down at the page. Each creature has a heading
   *    (rot, 0 = facing up the screen), a bank (roll around its own spine)
   *    and wings that lift toward us when they flap. Points are rotated in
   *    3D and then drawn with perspective: anything closer looks bigger.
   * ==================================================================== */
  function projector(cx, cy, k, rot, bank) {
    var cr = Math.cos(rot), sr = Math.sin(rot), cb = Math.cos(bank), sb = Math.sin(bank), F = 110;
    return function (x, y, z) {
      var x1 = x * cb - z * sb, z1 = x * sb + z * cb;   // roll around the spine
      var X = x1 * cr - y * sr, Y = x1 * sr + y * cr;   // turn to the heading
      var p = F / (F - z1);                              // perspective
      return [cx + X * p * k, cy + Y * p * k];
    };
  }
  function bodyMap(P) { return function (x, y) { return P(x, y, 0); }; }
  // A wing hinges on the body line. lift = flap angle toward the viewer;
  // fold tucks it back along the body (a bird at rest); spread < 1 tucks it in a dive.
  function wingMap(P, side, hinge, lift, fold, spread) {
    var cl = Math.cos(lift), sl = Math.sin(lift);
    return function (x, y) {
      var d = (x - hinge) * spread * (1 - 0.74 * fold);
      return P(side * (hinge + d * cl), y + (x - hinge) * 0.5 * fold, d * sl);
    };
  }
  // How brightly a wing catches the light at this moment of the flap.
  function wingShade(side, lift, bank, rot) {
    var nx = -side * Math.sin(lift), nz = Math.cos(lift);
    var cb = Math.cos(bank), sb = Math.sin(bank);
    var nx1 = nx * cb - nz * sb, nz1 = nx * sb + nz * cb;
    var face = nz1 >= 0 ? 1 : -1;
    var X = nx1 * Math.cos(rot) * face, Y = nx1 * Math.sin(rot) * face, Z = nz1 * face;
    return {
      light: Math.max(0, X * LIGHT[0] + Y * LIGHT[1] + Z * LIGHT[2]),
      spec: Math.pow(Math.max(0, X * HALF[0] + Y * HALF[1] + Z * HALF[2]), 18),
      under: face < 0
    };
  }

  /* ======================================================================
   * 5. Drawing helpers
   * ==================================================================== */
  function trace(ctx, cmds, map) {
    ctx.beginPath();
    var i = 0, a, b, c;
    while (i < cmds.length) {
      var op = cmds[i++];
      if (op === 'M') { a = map(cmds[i], cmds[i + 1]); ctx.moveTo(a[0], a[1]); i += 2; }
      else if (op === 'L') { a = map(cmds[i], cmds[i + 1]); ctx.lineTo(a[0], a[1]); i += 2; }
      else if (op === 'Q') { a = map(cmds[i], cmds[i + 1]); b = map(cmds[i + 2], cmds[i + 3]); ctx.quadraticCurveTo(a[0], a[1], b[0], b[1]); i += 4; }
      else if (op === 'C') { a = map(cmds[i], cmds[i + 1]); b = map(cmds[i + 2], cmds[i + 3]); c = map(cmds[i + 4], cmds[i + 5]); ctx.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]); i += 6; }
      else if (op === 'Z') ctx.closePath();
    }
  }
  function ellipse(ctx, map, cx, cy, rx, ry, turn) {
    var cr = Math.cos(turn || 0), sr = Math.sin(turn || 0);
    ctx.beginPath();
    for (var i = 0; i <= 18; i++) {
      var a = i / 18 * TAU, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      var p = map(cx + ex * cr - ey * sr, cy + ex * sr + ey * cr);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
  }
  function poly(ctx, map, pts) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = map(pts[i][0], pts[i][1]);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
  }
  function line(ctx, map, x0, y0, x1, y1) {
    var a = map(x0, y0), b = map(x1, y1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  function dot(ctx, p, r) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.3, r), 0, TAU); }

  // Paints one wing: colour, then shading for the angle of the flap, then a glint.
  function paintWing(ctx, cmds, map, o) {
    trace(ctx, cmds, map);
    // A soft halo (set by drawCharacter on dark ground) only on the base fill,
    // so shading layers don't stack it up.
    var halo = ctx.shadowBlur;
    if (o.look === 'flat') {
      ctx.fillStyle = css(o.shade.under ? o.b : o.a, o.alpha);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      var p0 = map(o.from[0], o.from[1]), p1 = map(o.to[0], o.to[1]);
      var g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
      g.addColorStop(0, css(o.a, o.alpha));
      g.addColorStop(1, css(o.b, o.alpha));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      var dark = (1 - (0.45 + 0.55 * o.shade.light)) * 0.62 + (o.shade.under ? 0.16 : 0);
      if (dark > 0.02) { ctx.fillStyle = 'rgba(0,0,0,' + (dark * o.alpha).toFixed(3) + ')'; ctx.fill(); }
      var glint = o.shade.spec * o.finish;
      if (glint > 0.02) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, glint * o.alpha).toFixed(3) + ')'; ctx.fill(); }
    }
    if (o.strokeW > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeW;
      ctx.strokeStyle = css(o.stroke, o.edge);
      ctx.stroke();
    }
    ctx.shadowBlur = halo;
  }

  /* ======================================================================
   * 6. The painters: one per body model
   * ==================================================================== */
  function paintButterfly(ctx, s, P, k, C, look, finish, alpha, edge) {
    var sh = SHAPES.butterfly, body = bodyMap(P);
    var order = s.bank > 0 ? [-1, 1] : [1, -1];   // the lower wing first
    for (var i = 0; i < 2; i++) {
      var side = order[i], map = wingMap(P, side, sh.hinge, s.lift, 0, 1);
      var o = { look: look, finish: finish, alpha: alpha, edge: edge, shade: wingShade(side, s.lift, s.bank, s.rot),
        from: [sh.hinge, -2], to: sh.tip, a: C.primary, b: C.secondary, stroke: C.dark,
        strokeW: (look === 'flat' ? 1.3 : 1.9) * k };
      paintWing(ctx, sh.hind, map, o);
      paintWing(ctx, sh.fore, map, o);
      if (look !== 'flat') {
        ctx.lineWidth = 0.55 * k;
        ctx.strokeStyle = css(C.dark, 0.38 * alpha);
        for (var v = 0; v < sh.veins.length; v++) { var vn = sh.veins[v]; line(ctx, map, vn[0], vn[1], vn[2], vn[3]); ctx.stroke(); }
      }
      ctx.fillStyle = css(C.light, 0.95 * alpha);
      var narrow = Math.max(0.4, Math.cos(s.lift));
      for (var j = 0; j < sh.spots.length; j++) { var sp = sh.spots[j]; dot(ctx, map(sp[0], sp[1]), sp[2] * k * narrow); ctx.fill(); }
    }
    var bodyCol = css(C.dark, Math.max(alpha, edge));
    ellipse(ctx, body, 0, 4.5, 1.7, 7.4); ctx.fillStyle = bodyCol; ctx.fill();
    ellipse(ctx, body, 0, -3.4, 2.1, 3); ctx.fill();
    dot(ctx, body(0, -7.3), 1.85 * k); ctx.fill();
    ctx.lineWidth = 0.6 * k; ctx.strokeStyle = bodyCol; ctx.lineCap = 'round';
    for (var a = -1; a <= 1; a += 2) {
      var p0 = body(0.6 * a, -8.6), pc = body(1.3 * a, -14.4), p1 = body(4.4 * a, -16.6);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(pc[0], pc[1], p1[0], p1[1]); ctx.stroke();
      dot(ctx, p1, 0.85 * k); ctx.fill();
    }
  }

  function paintBee(ctx, s, P, k, C, look, finish, alpha, t) {
    var body = bodyMap(P);
    ellipse(ctx, body, 0, 5.4, 6, 8.4);
    if (look === 'flat') ctx.fillStyle = css(C.primary, alpha);
    else {
      var g0 = body(-3, 0), g1 = body(4, 12), g = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
      g.addColorStop(0, css(mix(C.primary, C.light, 0.38), alpha));
      g.addColorStop(1, css(mix(C.primary, C.dark, 0.22), alpha));
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = css(C.dark, alpha);
    var bands = [2.3, 6.3, 10.3];
    for (var i = 0; i < bands.length; i++) { poly(ctx, body, [[-8, bands[i]], [8, bands[i]], [8, bands[i] + 2.3], [-8, bands[i] + 2.3]]); ctx.fill(); }
    ctx.restore();
    poly(ctx, body, [[-0.9, 13.3], [0.9, 13.3], [0, 15.6]]); ctx.fillStyle = css(C.dark, alpha); ctx.fill();
    ellipse(ctx, body, 0, -3.9, 4.5, 4.2);
    ctx.fillStyle = css(mix(C.dark, C.primary, 0.34), alpha); ctx.fill();
    if (look !== 'flat') { ctx.lineWidth = 1.1 * k; ctx.strokeStyle = css(C.primary, 0.55 * alpha); ctx.stroke(); }
    ellipse(ctx, body, 0, -9.2, 3.1, 2.7); ctx.fillStyle = css(C.dark, alpha); ctx.fill();
    ctx.fillStyle = css(mix(C.dark, C.light, 0.3), alpha);
    ellipse(ctx, body, -1.9, -9.8, 1, 1.35, 0.3); ctx.fill();
    ellipse(ctx, body, 1.9, -9.8, 1, 1.35, -0.3); ctx.fill();
    ctx.lineWidth = 0.55 * k; ctx.strokeStyle = css(C.dark, alpha); ctx.lineCap = 'round';
    for (var a = -1; a <= 1; a += 2) {
      var q0 = body(0.9 * a, -11.4), q1 = body(2.6 * a, -15), q2 = body(4.6 * a, -15.2);
      ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
    }
    // Real bee wings beat ~200 times a second, so we only ever see a blur:
    // draw each wing at three angles, faintly, and let them shimmer.
    var wingFill = css(C.wing || C.light, 0.26 * alpha), wingEdge = css(C.dark, 0.22 * alpha);
    var jitter = Math.sin(t * 61) * 0.18;
    var lifts = [0.15 + jitter, 0.75 - jitter, 1.25 + jitter];
    for (var side = -1; side <= 1; side += 2) {
      for (var j = 0; j < lifts.length; j++) {
        var map = wingMap(P, side, 2.4, lifts[j], 0, 1);
        ellipse(ctx, map, 9.8, -7.2, 8.6, 3.4, -0.32);
        ctx.fillStyle = wingFill; ctx.fill();
        if (j === 0) { ctx.lineWidth = 0.6 * k; ctx.strokeStyle = wingEdge; ctx.stroke(); }
        ellipse(ctx, map, 7.6, -2.6, 5.6, 2.5, 0.12);
        ctx.fillStyle = wingFill; ctx.fill();
      }
    }
  }

  function paintBird(ctx, s, P, k, C, look, finish, alpha, edge, shape, hover) {
    var sh = SHAPES[shape], body = bodyMap(P);
    var dark = css(C.dark, Math.max(alpha, edge));
    trace(ctx, sh.tail, body);
    var tailCol = shape === 'falcon' ? C.secondary : shape === 'sunbird' ? C.primary : C.dark;
    ctx.fillStyle = css(tailCol, Math.max(alpha, edge)); ctx.fill();
    if (sh.tailBand) {   // a falcon's dark terminal tail band
      ctx.save(); ctx.clip();
      poly(ctx, body, [[-5, sh.tailBand], [5, sh.tailBand], [5, sh.tailBand + 1.6], [-5, sh.tailBand + 1.6]]);
      ctx.fillStyle = css(C.dark, Math.max(alpha, edge)); ctx.fill();
      ctx.restore();
    }
    var folded = s.fold > 0.5;
    var drawWings = function () {
      var order = s.bank > 0 ? [-1, 1] : [1, -1];
      var lifts = hover && s.mode !== 'perched' ? [s.lift, s.lift + 0.9] : [s.lift];
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < lifts.length; j++) {
          var side = order[i], map = wingMap(P, side, sh.hinge, lifts[j], s.fold, s.spread);
          paintWing(ctx, sh.wing, map, { look: look, finish: finish, alpha: alpha * (lifts.length > 1 ? 0.62 : 1),
            edge: edge * (lifts.length > 1 ? 0.62 : 1), shade: wingShade(side, lifts[j], s.bank, s.rot),
            from: [sh.hinge, -2], to: sh.tip, a: C.primary, b: shape === 'sunbird' ? C.secondary : C.dark,
            stroke: C.dark, strokeW: (look === 'flat' ? 1.1 : 0.55) * k });
        }
      }
    };
    if (!folded) drawWings();
    trace(ctx, sh.body, body);
    if (look === 'flat') ctx.fillStyle = css(C.primary, Math.max(alpha, edge));
    else {
      var h = body(0, -12), tl = body(0, 8), g = ctx.createLinearGradient(h[0], h[1], tl[0], tl[1]);
      g.addColorStop(0, css(shape === 'sunbird' ? C.secondary : mix(C.primary, C.secondary, 0.45), alpha));
      g.addColorStop(1, css(shape === 'swallow' ? C.dark : C.primary, alpha));
      ctx.fillStyle = g;
    }
    ctx.fill();
    if (look === 'flat') { ctx.lineWidth = 1.1 * k; ctx.strokeStyle = dark; ctx.stroke(); }
    if (sh.patch) { ellipse(ctx, body, sh.patch[0], sh.patch[1], sh.patch[2], sh.patch[3]); ctx.fillStyle = css(C.accent, alpha); ctx.fill(); }
    if (sh.cap) { ellipse(ctx, body, sh.cap[0], sh.cap[1], sh.cap[2], sh.cap[3]); ctx.fillStyle = css(C.dark, 0.85 * alpha); ctx.fill(); }
    if (sh.band) { ellipse(ctx, body, sh.band[0], sh.band[1], sh.band[2], sh.band[3]); ctx.fillStyle = css(C.accent, alpha); ctx.fill(); }
    if (sh.head) { dot(ctx, body(sh.head[0], sh.head[1]), sh.head[2] * k); ctx.fillStyle = css(look === 'flat' ? C.primary : C.secondary, alpha); ctx.fill(); }
    trace(ctx, sh.beak, body);
    ctx.fillStyle = shape === 'falcon' ? css(C.accent, Math.max(alpha, edge)) : dark; ctx.fill();
    ctx.fillStyle = css(C.light, 0.9 * Math.max(alpha, edge));
    dot(ctx, body(sh.eyes[0], sh.eyes[1]), 0.46 * k); ctx.fill();
    dot(ctx, body(-sh.eyes[0], sh.eyes[1]), 0.46 * k); ctx.fill();
    if (folded) drawWings();
  }

  function paintLight(ctx, s, P, k, C, look, alpha, t, shape, onLight) {
    var body = bodyMap(P), resting = s.mode === 'perched' || s.mode === 'toPerch' || s.mode === 'visit';
    var pulse = 0.7 + 0.3 * Math.sin(t * (resting ? 3.4 : 2.2) + s.seed);
    var core = shape === 'spark' ? body(0, 0) : body(0, 6.2);
    var R = (shape === 'spark' ? 13 : 11) * k * (0.85 + 0.35 * pulse);
    if (look === 'flat') {
      ctx.fillStyle = css(C.glow, 0.22 * alpha); dot(ctx, core, R * 0.62); ctx.fill();
      ctx.fillStyle = css(C.glow, alpha); dot(ctx, core, R * 0.3); ctx.fill();
    } else if (onLight) {
      // Adding light to a pale page just makes white, so on light ground the
      // glow is painted as a warm halo instead.
      var gl = ctx.createRadialGradient(core[0], core[1], 0, core[0], core[1], R);
      gl.addColorStop(0, css(C.glow, 0.62 * alpha * pulse));
      gl.addColorStop(0.4, css(C.glow, 0.26 * alpha * pulse));
      gl.addColorStop(1, css(C.glow, 0));
      ctx.fillStyle = gl; dot(ctx, core, R); ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(core[0], core[1], 0, core[0], core[1], R);
      g.addColorStop(0, css(C.light, 0.95 * alpha * pulse));
      g.addColorStop(0.22, css(C.glow, 0.72 * alpha * pulse));
      g.addColorStop(0.55, css(C.glow, 0.16 * alpha * pulse));
      g.addColorStop(1, css(C.glow, 0));
      ctx.fillStyle = g; dot(ctx, core, R); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (shape === 'spark') {
      // A turning four-point star.
      var turn = t * 1.3, pts = [];
      for (var i = 0; i < 8; i++) { var a = turn + i * Math.PI / 4, r = i % 2 ? 1.3 : 5.4; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      poly(ctx, body, pts);
      ctx.fillStyle = css(look === 'flat' || onLight ? C.primary : C.light, alpha); ctx.fill();
      if ((look === 'flat' || onLight) && C.dark) { ctx.lineWidth = 0.7 * k; ctx.strokeStyle = css(mix(C.primary, C.dark, 0.55), alpha); ctx.stroke(); }
      return;
    }
    // Firefly: blurred wings under two hard wing-covers, a shield over the head, a lantern tail.
    var wf = css(C.light, 0.2 * alpha);
    for (var side = -1; side <= 1; side += 2) {
      for (var j = 0; j < 2; j++) {
        var map = wingMap(P, side, 1, (resting ? 0.2 : 0.3 + j * 0.8) + Math.sin(t * 50 + j) * 0.15, 0, 1);
        ellipse(ctx, map, 6.5, 1, 6, 2.6, 0.5); ctx.fillStyle = wf; ctx.fill();
      }
    }
    var open = resting ? 0.08 : 0.38;
    for (var e = -1; e <= 1; e += 2) {
      ellipse(ctx, body, e * (1.5 + open * 2.4), 1.6, 1.6, 5.4, e * open);
      ctx.fillStyle = css(C.primary, alpha); ctx.fill();
    }
    ellipse(ctx, body, 0, -4.2, 3, 2.3);
    ctx.fillStyle = css(C.accent || C.primary, alpha); ctx.fill();
    dot(ctx, body(0, -6.4), 1.3 * k); ctx.fillStyle = css(C.primary, alpha); ctx.fill();
    ellipse(ctx, body, 0, 6.6, 2, 1.8);
    ctx.fillStyle = css(onLight ? mix(C.glow, C.dark, 0.12) : mix(C.light, C.glow, 0.3), alpha * (0.75 + 0.25 * pulse)); ctx.fill();
  }

  function paintShadow(ctx, s, cx, cy, k, span) {
    var a = 0.2 * (1 - s.alt * 0.5);
    var ox = (3 + s.alt * 12) * k, oy = (5 + s.alt * 20) * k;
    var w = Math.max(3 * k, span * 0.5 * k * Math.max(0.32, Math.cos(s.lift)) * s.spread * (1 - s.fold * 0.6));
    var h = Math.max(3 * k, span * 0.15 * k);
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.rotate(s.rot);
    ctx.scale(1, h / w);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    g.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ======================================================================
   * 7. Styles the layer needs (injected once)
   * ==================================================================== */
  var STYLE = [
    '.ll-canvas{position:fixed;left:0;top:0;pointer-events:none;}',
    '.ll-char{will-change:transform;}',
    '.ll-toggle{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:40px;height:40px;border-radius:999px;',
    'display:grid;place-items:center;padding:0;cursor:pointer;border:1px solid var(--ll-tline,rgba(255,255,255,.3));',
    'background:var(--ll-tbg,rgba(14,11,7,.78));color:var(--ll-tfg,#FFD76A);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
    'box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .2s ease,opacity .2s ease;}',
    '.ll-toggle.ll-bottom-left{left:calc(16px + env(safe-area-inset-left,0px));}',
    '.ll-toggle.ll-bottom-right{right:calc(16px + env(safe-area-inset-right,0px));}',
    '.ll-toggle:hover{transform:scale(1.07);}',
    '.ll-toggle:focus-visible{outline:2px solid var(--ll-tfg,#FFD76A);outline-offset:3px;}',
    '.ll-toggle[aria-pressed="true"] .ll-slash{display:none;}',
    '.ll-toggle[aria-pressed="false"]{opacity:.82;}',
    '.ll-r{opacity:0;transform:perspective(1100px) rotateX(14deg) translateY(34px) scale(.985);transform-origin:50% 0;}',
    '.ll-r.ll-in{opacity:1;transform:none;transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform 1.05s cubic-bezier(.16,1,.3,1);}',
    '.ll-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .35s ease;',
    'background:radial-gradient(circle at var(--ll-gx,50%) var(--ll-gy,50%),rgba(255,255,255,.28),rgba(255,255,255,0) 58%);mix-blend-mode:soft-light;}',
    '.ll-tilting>.ll-glare{opacity:1;}',
    '@media print{.ll-canvas,.ll-toggle{display:none!important;}}'
  ].join('');

  var ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path d="M12 2.6l1.9 6.2 6.2 1.9-6.2 1.9L12 18.8l-1.9-6.2-6.2-1.9 6.2-1.9z" fill="currentColor"/>' +
    '<path d="M18.6 16.2l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z" fill="currentColor" opacity=".7"/>' +
    '<path class="ll-slash" d="M4 21L21 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  var DEFAULTS = {
    character: 'butterfly',   // a SPECIES name, or 'none' for dust and 3D only
    colors: null,             // { primary, secondary, accent, dark, light, glow, wing }
    colorsOnDark: null,       // optional second palette used over dark sections
    look: 'rich',             // 'rich': gradients, glints, glow. 'flat': solid colours, no glow or shadow
    finish: 'satin',          // 'matte' | 'satin' | 'foil': how strongly wings catch the light
    size: null,               // on-screen wingspan in px (default per species)
    side: 'right',            // which side of the page it cruises on
    lane: null,               // { x: 0..1, y: 0..1 } to place its cruising spot; null = automatic
    perch: '[data-perch]',
    dust: true,               // true | false | { colors: [...], amount: 0..1, ambient: true, trail: true }
    ghost: false,             // starts see-through and fills with colour as the reader scrolls
    calm: false,              // gentle mode: slower, rests sooner and stays, no dust, never startles
    intro: true,              // flies in from the edge
    introDelay: 1200,
    zIndex: 60,
    safeTop: 'auto',          // px to keep clear at the top, or 'auto' to measure a fixed header
    scroller: null,           // selector of the scrolling element when the page itself doesn't scroll
    toggle: true,             // pause button: true | false | { position, label, titleOn, titleOff, bg, fg, line }
    tilt: '[data-tilt]',
    depth: '[data-depth]',
    reveal: '[data-reveal-3d]',
    magnetic: '[data-magnetic]',
    storageKey: 'living-layer',
    mobileScale: 0.8
  };
  var DUST = { colors: ['#FFE08A', '#F5B301', '#FFF3C4'], amount: 0.6, ambient: true, trail: true };

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) for (var key in src) if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) target[key] = src[key];
    }
    return target;
  }
  function store(key, value) {
    try { if (value === undefined) return window.localStorage.getItem(key); window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    return null;
  }
  function media(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; }
  function listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts || false);
    return function () { target.removeEventListener(type, fn, opts || false); };
  }

  /* ======================================================================
   * 8. init: builds one living layer for the page and returns its controls
   * ==================================================================== */
  var current = null;

  function init(userOptions) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;   // server render
    if (current) current.destroy();

    var o = assign({}, DEFAULTS, userOptions);
    var name = String(o.character || 'none').toLowerCase();
    var spec = SPECIES[name] || null;
    // Calm mode (for products that need calm): slower, smaller movements.
    if (spec && o.calm) spec = assign({}, spec, { omega: spec.omega * 0.6, maxSpeed: spec.maxSpeed * 0.5, flapHz: spec.flapHz * 0.7, wander: spec.wander * 0.4 });
    function palette(base) {
      var P = {};
      for (var ck in base) P[ck] = rgb(base[ck]);
      if (!P.secondary) P.secondary = P.primary;
      if (!P.accent) P.accent = P.secondary;
      if (!P.glow) P.glow = P.primary;
      if (!P.light) P.light = rgb('#ffffff');
      if (!P.dark) P.dark = rgb('#111111');
      return P;
    }
    // colorsOnDark: a second palette used while it flies over dark sections,
    // for brands whose fields invert (ink on gold, gold on ink).
    var C = spec ? palette(assign({}, spec.colors, o.colors)) : {};
    var Cdark = spec && o.colorsOnDark ? palette(assign({}, spec.colors, o.colors, o.colorsOnDark)) : null;
    var dustCfg = o.dust === false || (o.calm && o.dust === true) ? null : assign({}, DUST, o.dust === true ? null : o.dust);
    var dustCols = dustCfg ? dustCfg.colors.map(rgb) : [];
    var finish = FINISH[o.finish] != null ? FINISH[o.finish] : FINISH.satin;
    var flat = o.look === 'flat';

    var reduce = media('(prefers-reduced-motion: reduce)');
    var finePointer = media('(hover: hover) and (pointer: fine)');
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var saved = store(o.storageKey);
    var userChose = saved === 'on' || saved === 'off';
    var enabled = userChose ? saved === 'on' : !reduce.matches;

    var scrollerEl = o.scroller ? document.querySelector(o.scroller) : null;
    function scrollTop() { return scrollerEl ? scrollerEl.scrollTop : (window.scrollY || window.pageYOffset || 0); }
    function scrollMax() {
      if (scrollerEl) return scrollerEl.scrollHeight - scrollerEl.clientHeight;
      return Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) - window.innerHeight;
    }

    // ---- DOM: style, two canvases (character + dust), the pause button
    if (!document.getElementById('living-layer-style')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'living-layer-style';
      styleEl.textContent = STYLE;
      document.head.appendChild(styleEl);
    }
    var charCanvas = document.createElement('canvas');
    var dustCanvas = document.createElement('canvas');
    charCanvas.className = 'll-canvas ll-char';
    dustCanvas.className = 'll-canvas ll-dust';
    [dustCanvas, charCanvas].forEach(function (c, i) {
      c.setAttribute('aria-hidden', 'true');
      c.style.zIndex = String(o.zIndex - 1 + i);
      c.style.display = 'none';
      document.body.appendChild(c);
    });
    var cctx = charCanvas.getContext('2d');
    var dctx = dustCanvas.getContext('2d');

    var toggleBtn = null;
    if (o.toggle) {
      var tc = typeof o.toggle === 'object' ? o.toggle : {};
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'll-toggle ll-' + (tc.position === 'bottom-right' ? 'bottom-right' : 'bottom-left');
      toggleBtn.style.zIndex = String(o.zIndex + 1);
      toggleBtn.innerHTML = ICON;
      toggleBtn.setAttribute('aria-label', tc.label || 'Moving effects');
      if (tc.bg) toggleBtn.style.setProperty('--ll-tbg', tc.bg);
      if (tc.fg) toggleBtn.style.setProperty('--ll-tfg', tc.fg);
      if (tc.line) toggleBtn.style.setProperty('--ll-tline', tc.line);
      toggleBtn.addEventListener('click', function () { setEnabled(!enabled, true); });
      document.body.appendChild(toggleBtn);
    }

    // ---- measurements
    var vw = 0, vh = 0, mobile = false, sizePx = 0, K = 1, charS = 0, cDpr = 1, dDpr = 1, safeTop = 0, maxScroll = 1;

    function measureSafeTop() {
      if (typeof o.safeTop === 'number') return o.safeTop;
      var best = 0, cands = document.querySelectorAll('header, [role="banner"], body > nav, .site-header, .header');
      for (var i = 0; i < cands.length; i++) {
        var cs = window.getComputedStyle(cands[i]);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        var r = cands[i].getBoundingClientRect();
        if (r.top <= 4 && r.bottom > 0 && r.height < vh * 0.4) best = Math.max(best, r.bottom);
      }
      return best;
    }

    function resize() {
      vw = window.innerWidth; vh = window.innerHeight;
      mobile = vw < 720 || !finePointer.matches;
      var dpr = window.devicePixelRatio || 1;
      if (spec) {
        sizePx = (o.size || spec.size) * (vw < 720 ? o.mobileScale : 1);
        K = sizePx / spec.span;
        charS = Math.ceil(sizePx * 2.6 + 24);
        cDpr = Math.min(2, dpr);
        charCanvas.width = Math.round(charS * cDpr); charCanvas.height = Math.round(charS * cDpr);
        charCanvas.style.width = charS + 'px'; charCanvas.style.height = charS + 'px';
      }
      dDpr = vw * vh > 1.6e6 ? 1 : Math.min(1.5, dpr);
      dustCanvas.width = Math.round(vw * dDpr); dustCanvas.height = Math.round(vh * dDpr);
      dustCanvas.style.width = vw + 'px'; dustCanvas.style.height = vh + 'px';
      safeTop = measureSafeTop();
      maxScroll = Math.max(1, scrollMax());
      groundGrid = []; groundAt = -1e9;
      seedAmbient();
      scan();
    }

    function laneX() {
      if (o.lane && o.lane.x != null) return vw * o.lane.x;
      var g = mobile && vw < 720 ? Math.max(18, sizePx * 0.62) : clamp(vw * 0.075, 46, 130);
      return o.side === 'left' ? g : vw - g;
    }
    function laneY() {
      if (o.lane && o.lane.y != null) return vh * o.lane.y;
      return lerp(safeTop + 24, vh * 0.84, vw < 720 ? 0.6 : 0.36);
    }

    /* ---- perches: where the companion may land.
     * By default it lands just past the end of the element's first line of
     * text, so it sits beside a heading instead of on top of the words. */
    var perches = [], lastPerch = null;
    function anchorOf(el) {
      if (!el.isConnected) return null;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      var sy = scrollTop(), mode = el.getAttribute('data-perch');
      if (mode !== 'corner' && el.textContent && el.textContent.trim()) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var rects = range.getClientRects();
        if (rects.length) {
          var top = rects[0].top, right = rects[0].right, h = rects[0].height;
          for (var i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - top) < 3) right = Math.max(right, rects[i].right);
          var x = right + sizePx * 0.5;
          if (x > vw - sizePx * 0.5) x = right - sizePx * 0.15;    // no room: sit on the last letters
          return { x: Math.min(x, vw - sizePx * 0.4), y: top + h * 0.32 + sy };
        }
      }
      return { x: Math.min(r.right - Math.min(14, r.width * 0.1), vw - sizePx * 0.4), y: r.top + 4 + sy };
    }
    function scanPerches() {
      perches = [];
      if (!o.perch || !spec) return;
      var els = document.querySelectorAll(o.perch);
      for (var i = 0; i < els.length && i < 60; i++) {
        var a = anchorOf(els[i]);
        if (a) perches.push({ el: els[i], x: a.x, y: a.y });
      }
    }
    // Is the page under this spot free of words and controls? We probe the
    // body and both wingtips, so it never settles on a line of text or a button.
    function ownText(el) {
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
      return false;
    }
    function clearGround(x, y) {
      var r = sizePx * 0.45, pts = [[x, y], [x - r, y], [x + r, y], [x, y - r * 0.6]];
      for (var j = 0; j < pts.length; j++) {
        var el = document.elementFromPoint(clamp(pts[j][0], 1, vw - 2), clamp(pts[j][1], 1, vh - 2));
        for (var i = 0; el && i < 3 && el !== document.body; i++, el = el.parentElement) {
          if (/^(A|BUTTON|LABEL|INPUT|TEXTAREA|SELECT|SUMMARY)$/.test(el.tagName) || ownText(el)) return false;
        }
      }
      return true;
    }
    function pickPerch() {
      var sy = scrollTop(), best = null, bestD = Infinity;
      for (var i = 0; i < perches.length; i++) {
        var p = perches[i], y = p.y - sy;
        if (y < safeTop + 40 || y > vh * 0.78 || p.x < 16 || p.x > vw - 16) continue;
        if (p === lastPerch && perches.length > 1) continue;
        var d = dist(p.x, y, st.x, st.y);
        if (d < bestD) { best = p; bestD = d; }
      }
      return best;
    }

    /* ---- 3D helpers: tilt, depth, reveal, magnetic */
    var tilts = [], depths = [], magnets = [], revealIO = null;
    var tiltBound = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

    function scanTilt() {
      if (!o.tilt || !tiltBound) return;
      var els = document.querySelectorAll(o.tilt);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (tiltBound.has(el)) continue;
        tiltBound.add(el);
        var it = { el: el, rx: 0, ry: 0, tx: 0, ty: 0, s: 1, ts: 1, max: parseFloat(el.getAttribute('data-tilt-max')) || 7, glare: null, live: false };
        if (el.getAttribute('data-tilt') === 'glare') {
          if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
          it.glare = document.createElement('span');
          it.glare.className = 'll-glare';
          it.glare.setAttribute('aria-hidden', 'true');
          el.appendChild(it.glare);
        }
        var parent = el.parentElement;
        if (parent && window.getComputedStyle(parent).perspective === 'none') parent.style.perspective = '1100px';
        (function (it) {
          it.el.addEventListener('pointermove', function (e) {
            if (!fx() || e.pointerType !== 'mouse') return;
            var r = it.el.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
            it.tx = -py * it.max * 2; it.ty = px * it.max * 2; it.ts = 1.015; it.live = true;
            it.el.classList.add('ll-tilting');
            it.el.style.setProperty('--ll-gx', ((px + 0.5) * 100).toFixed(1) + '%');
            it.el.style.setProperty('--ll-gy', ((py + 0.5) * 100).toFixed(1) + '%');
            wake();
          });
          it.el.addEventListener('pointerleave', function () {
            it.tx = 0; it.ty = 0; it.ts = 1;
            it.el.classList.remove('ll-tilting');
            wake();
          });
        })(it);
        tilts.push(it);
      }
    }
    function updateTilts(dt) {
      for (var i = 0; i < tilts.length; i++) {
        var it = tilts[i];
        if (!it.live) continue;
        var f = ease(10, dt);
        it.rx = lerp(it.rx, it.tx, f); it.ry = lerp(it.ry, it.ty, f); it.s = lerp(it.s, it.ts, f);
        var ang = Math.sqrt(it.rx * it.rx + it.ry * it.ry);
        if (ang < 0.03 && Math.abs(it.s - 1) < 0.0005 && it.tx === 0 && it.ty === 0) {
          it.el.style.rotate = ''; it.el.style.scale = ''; it.live = false; continue;
        }
        // One rotation around a tilted axis = rotateX + rotateY, without
        // touching the element's own transform (hover lifts keep working).
        it.el.style.rotate = (it.rx / ang).toFixed(3) + ' ' + (it.ry / ang).toFixed(3) + ' 0 ' + ang.toFixed(2) + 'deg';
        it.el.style.scale = it.s.toFixed(4);
      }
    }
    function resetTilts() {
      for (var i = 0; i < tilts.length; i++) {
        var it = tilts[i];
        it.rx = it.ry = it.tx = it.ty = 0; it.s = it.ts = 1; it.live = false;
        it.el.style.rotate = ''; it.el.style.scale = '';
        it.el.classList.remove('ll-tilting');
      }
    }

    function scanDepth() {
      depths.forEach(function (d) { d.el.style.translate = ''; });
      depths = [];
      if (!o.depth) return;
      var els = document.querySelectorAll(o.depth), sy = scrollTop();
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        depths.push({ el: els[i], d: clamp(parseFloat(els[i].getAttribute('data-depth')) || 0.2, -1, 1), mid: r.top + r.height / 2 + sy, x: 0, y: 0 });
      }
    }
    function updateDepth(sy, dt) {
      if (!depths.length) return;
      var f = ease(6, dt);
      pointer.nx = lerp(pointer.nx, pointer.tnx, f); pointer.ny = lerp(pointer.ny, pointer.tny, f);
      for (var i = 0; i < depths.length; i++) {
        var it = depths[i], c = it.mid - sy - vh / 2;
        if (Math.abs(c) > vh * 1.4) continue;
        var x = finePointer.matches ? pointer.nx * it.d * 40 : 0;
        var y = -c * it.d * 0.32 + (finePointer.matches ? pointer.ny * it.d * 26 : 0);
        if (Math.abs(x - it.x) < 0.05 && Math.abs(y - it.y) < 0.05) continue;
        it.x = x; it.y = y;
        it.el.style.translate = x.toFixed(2) + 'px ' + y.toFixed(2) + 'px';
      }
    }

    function scanMagnets() {
      magnets.forEach(function (m) { m.el.style.translate = ''; });
      magnets = [];
      if (!o.magnetic) return;
      var els = document.querySelectorAll(o.magnetic);
      for (var i = 0; i < els.length; i++) magnets.push({ el: els[i], x: 0, y: 0, tx: 0, ty: 0 });
    }
    function aimMagnets(cx, cy) {
      for (var i = 0; i < magnets.length; i++) {
        var m = magnets[i], r = m.el.getBoundingClientRect();
        var mx = r.left + r.width / 2 - m.x, my = r.top + r.height / 2 - m.y;
        var dx = cx - mx, dy = cy - my;
        var near = Math.abs(dx) < r.width / 2 + 36 && Math.abs(dy) < r.height / 2 + 28;
        m.tx = near ? clamp(dx * 0.22, -9, 9) : 0;
        m.ty = near ? clamp(dy * 0.28, -7, 7) : 0;
      }
    }
    function updateMagnets(dt) {
      var f = ease(12, dt);
      for (var i = 0; i < magnets.length; i++) {
        var m = magnets[i];
        if (Math.abs(m.tx - m.x) < 0.02 && Math.abs(m.ty - m.y) < 0.02) continue;
        m.x = lerp(m.x, m.tx, f); m.y = lerp(m.y, m.ty, f);
        m.el.style.translate = m.x.toFixed(2) + 'px ' + m.y.toFixed(2) + 'px';
      }
    }

    function scanReveal() {
      if (!o.reveal || !('IntersectionObserver' in window)) return;
      if (!revealIO) {
        revealIO = new IntersectionObserver(function (entries) {
          var n = 0;
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            var el = e.target;
            revealIO.unobserve(el);
            el.style.transitionDelay = Math.min(n++ * 70, 280) + 'ms';
            el.classList.add('ll-in');
            var done = function () {
              el.classList.remove('ll-r', 'll-in');
              el.style.transitionDelay = '';
              el.removeEventListener('transitionend', onEnd);
            };
            var onEnd = function (ev) { if (ev.target === el && ev.propertyName === 'transform') done(); };
            el.addEventListener('transitionend', onEnd);
            setTimeout(done, 1700);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      }
      if (!fx()) return;
      var els = document.querySelectorAll(o.reveal);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.__llSeen) continue;
        el.__llSeen = true;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) continue;   // already on screen: never hide it
        el.classList.add('ll-r');
        revealIO.observe(el);
      }
    }
    function showAllReveals() {
      var hidden = document.querySelectorAll('.ll-r');
      for (var i = 0; i < hidden.length; i++) { hidden[i].classList.remove('ll-r', 'll-in'); hidden[i].style.transitionDelay = ''; if (revealIO) revealIO.unobserve(hidden[i]); }
    }

    function scan() {
      scanPerches(); scanTilt(); scanDepth(); scanMagnets(); scanReveal();
    }

    /* ---- the companion's state */
    var st = {
      x: 0, y: 0, vx: 0, vy: 0, rot: 0, bank: 0, lift: 0.3, fold: 0, spread: 1, alt: 0.45,
      phase: 0, glide: 0, orbit: 0, mode: 'intro', modeT: 0, perch: null, restAt: -1e9,
      loop: 0, seed: Math.random() * 10, dartX: 0, dartY: 0
    };
    var tx = 0, ty = 0, t = 0, now = 0, idle = 0, sv = 0, lastSy = 0, progress = 0;
    var pointer = { x: -1e4, y: -1e4, at: -1e9, nx: 0, ny: 0, tnx: 0, tny: 0, speed: 0 };
    var LOOP_T = 0.9;

    function setMode(m) { st.mode = m; st.modeT = 0; }
    function leave() {
      if (st.perch) lastPerch = st.perch;
      st.perch = null; st.restAt = now;
      setMode('cruise');
      if (spec && spec.model !== 'light') { st.vy -= 160; }
    }
    function dart() {
      var dx = st.x - pointer.x, dy = st.y - pointer.y, l = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      st.dartX = clamp(st.x + dx / l * 160, 20, vw - 20);
      st.dartY = clamp(st.y + dy / l * 120 - 40, safeTop + 20, vh - 20);
      if (st.perch) lastPerch = st.perch;
      st.perch = null; st.restAt = now;
      setMode('dart');
    }

    function think(dt) {
      st.modeT += dt;
      var lx = laneX(), ly = laneY();
      // When the reader scrolls down, the companion trails behind (higher on
      // screen), then catches up when they stop: that reads as following.
      var lag = clamp(-sv * (o.calm ? 0.05 : 0.11), -vh * 0.24, vh * 0.2);
      var narrow = vw < 720;
      if (st.mode === 'intro') {
        tx = lx; ty = ly;
        if (st.modeT > 0.5 && dist(st.x, st.y, tx, ty) < 40) setMode('cruise');
      } else if (st.mode === 'cruise') {
        if (spec.soar) {
          st.orbit += dt * (0.85 + Math.min(1.4, Math.abs(sv) / 900));
          var R = narrow ? 14 : 44, inward = o.side === 'left' ? 1 : -1;
          tx = lx + inward * R * 0.55 + Math.cos(st.orbit) * R;
          ty = ly + lag + Math.sin(st.orbit) * R * 0.7;
        } else {
          var w = spec.wander * (narrow ? 0.32 : 1);
          tx = lx + (Math.sin(t * 0.53 + st.seed) * 26 + Math.sin(t * 1.31) * 9) * w;
          ty = ly + lag + (Math.sin(t * 0.71 + 1.3) * 22 + Math.sin(t * 1.9) * 5) * w;
        }
        tx += Math.sin(t * 2.3) * Math.min(1, Math.abs(sv) / 700) * (narrow ? 5 : 18);
        // Curious about a still mouse nearby (desktop only).
        if (!o.calm && finePointer.matches && now - pointer.at < 2400 && idle > 0.5) {
          var dp = dist(pointer.x, pointer.y, st.x, st.y);
          if (dp < 240 && dp > 24) { tx = pointer.x + (pointer.x < st.x ? 56 : -56); ty = pointer.y - 28; }
        }
        // Time to rest: a perch if one is in view, otherwise right here.
        if (idle > (o.calm ? 0.5 : 1.1) && st.modeT > (o.calm ? 1.2 : 2.4) && now - st.restAt > (o.calm ? 1500 : 4200)) {
          var p = pickPerch();
          if (p) { st.perch = p; setMode('toPerch'); }
          else if (idle > 6 && spec.rest === 'land' && clearGround(st.x, st.y)) {
            st.perch = { el: null, x: st.x, y: st.y + scrollTop(), here: true };
            setMode('toPerch');
          }
        }
      } else if (st.mode === 'toPerch' || st.mode === 'perched' || st.mode === 'visit') {
        var pr = st.perch, sy = scrollTop();
        if (pr && pr.el && (st.modeT < 0.05 || ((st.modeT * 4) | 0) !== (((st.modeT - dt) * 4) | 0))) {
          var a = anchorOf(pr.el); if (a) { pr.x = a.x; pr.y = a.y; } else pr = null;
        }
        if (!pr) { leave(); }
        else {
          var ay = pr.y - sy;
          if (ay < safeTop + 8 || ay > vh - 24 || pr.x < 8 || pr.x > vw - 8) leave();
          else if (st.mode !== 'visit' && Math.abs(sv) > (o.calm ? 900 : 650) && st.modeT > 0.25) leave();     // the reader moved on
          else {
            tx = pr.x; ty = ay;
            if (spec.rest === 'hover') { tx += Math.sin(t * 1.7 + st.seed) * 7; ty += -10 + Math.sin(t * 2.3) * 5; }
            var speed = Math.sqrt(st.vx * st.vx + st.vy * st.vy);
            if (st.mode !== 'perched' && dist(st.x, st.y, tx, ty) < (spec.rest === 'hover' ? 12 : 3.5) && speed < 140) {
              setMode('perched');
              if (spec.rest === 'land') burst(st.x, st.y, 7, 0.6);
            } else if (!o.calm && st.mode === 'perched' && st.modeT > 28 + st.seed * 2) leave();   // stretch its wings now and then
          }
        }
      } else if (st.mode === 'dart') {
        tx = st.dartX; ty = st.dartY;
        if (st.modeT > 0.8) setMode('cruise');
      }
      tx = clamp(tx, 12, vw - 12);
      ty = clamp(ty, safeTop + 12, vh - 12);
    }

    function move(dt) {
      var landed = st.mode === 'perched' && spec.rest === 'land';
      if (landed) {
        st.x = tx; st.y = ty; st.vx = 0; st.vy = 0;           // ride along with the page
      } else {
        // A damped spring pulls it toward the target: overshoot, settle, alive.
        var w = spec.omega * (st.mode === 'toPerch' || st.mode === 'visit' ? 1.2 : 1) * (st.mode === 'dart' ? 1.6 : 1);
        var ax = w * w * (tx - st.x) - 2 * spec.zeta * w * st.vx;
        var ay = w * w * (ty - st.y) - 2 * spec.zeta * w * st.vy;
        if (spec.model === 'butterfly') { ay -= Math.max(0, Math.sin(st.phase)) * 130; ax += Math.sin(t * 7.3 + st.seed) * 70; }
        if (spec.model === 'bee') { ax += Math.sin(t * 23) * 95; ay += Math.cos(t * 19) * 95; }
        if (spec.model === 'light') { ax += Math.sin(t * 1.7 + st.seed) * 40; ay += Math.cos(t * 1.3) * 40; }
        st.vx += ax * dt; st.vy += ay * dt;
        var sp = Math.sqrt(st.vx * st.vx + st.vy * st.vy);
        if (sp > spec.maxSpeed) { st.vx *= spec.maxSpeed / sp; st.vy *= spec.maxSpeed / sp; }
        st.x += st.vx * dt; st.y += st.vy * dt;
      }
      var speed = Math.sqrt(st.vx * st.vx + st.vy * st.vy);
      // Heading: birds always face where they fly; insects can drift sideways.
      var want = null;
      if (landed) want = spec.model === 'bird' ? (o.side === 'left' ? 0.9 : -0.9) : st.seed % 0.6 - 0.3;
      else if (speed > (spec.model === 'bird' ? 25 : 70)) want = Math.atan2(st.vy, st.vx) + Math.PI / 2;
      var before = st.rot;
      if (want != null) st.rot = wrapAngle(turnToward(st.rot, want, ease(spec.model === 'bird' ? 6 : 3.6, dt)));
      var turnRate = wrapAngle(st.rot - before) / Math.max(dt, 1e-3);
      st.bank = lerp(st.bank, clamp(turnRate * 0.24, -0.85, 0.85), ease(6, dt));
      if (st.loop > 0) { st.loop = Math.max(0, st.loop - dt); st.bank = (1 - st.loop / LOOP_T) * TAU; }
      st.alt = lerp(st.alt, landed ? 0 : clamp(0.32 + speed / 1800, 0.32, 0.9), ease(3, dt));
      wings(dt, speed, landed);
      emit(dt, speed);
    }

    function wings(dt, speed, landed) {
      var effort = clamp(speed / 500, 0, 1);
      if (spec.model === 'butterfly') {
        if (landed) {
          var b = Math.max(0, Math.sin(t * 0.9 + st.seed));       // basking: open, with a slow close now and then
          st.lift = lerp(st.lift, 0.12 + 1.15 * b * b * b, ease(8, dt));
        } else {
          st.phase += dt * TAU * spec.flapHz * (0.8 + effort * 0.6);
          st.lift = 0.1 + 1.15 * (0.5 + 0.5 * Math.sin(st.phase));
        }
      } else if (spec.model === 'bird') {
        if (landed) {
          st.fold = lerp(st.fold, 1, ease(7, dt));
          st.lift = lerp(st.lift, 0, ease(7, dt));
          st.spread = lerp(st.spread, 1, ease(5, dt));
          return;
        }
        st.fold = lerp(st.fold, 0, ease(9, dt));
        if (spec.hover) {
          st.phase += dt * TAU * spec.flapHz;
          st.lift = 0.6 * Math.sin(st.phase);
        } else {
          // Flap when working, glide when cruising: flap, flap, flap, glide.
          var working = effort > 0.3 || st.mode !== 'cruise' || dist(st.x, st.y, tx, ty) > 90;
          st.glide = working ? 0 : st.glide + dt;
          if (!working && (st.glide % 3.4) > 1.3) st.lift = lerp(st.lift, 0.1, ease(5, dt));
          else { st.phase += dt * TAU * spec.flapHz * (0.75 + effort * 0.5); st.lift = 0.06 + 0.62 * Math.sin(st.phase); }
        }
        st.spread = lerp(st.spread, 1 - clamp((speed - 700) / 1400, 0, 0.45), ease(5, dt));   // tuck in a dive
      } else {
        st.phase += dt * TAU * (spec.flapHz || 1);
      }
    }

    /* ---- dust: ambient motes in the air, and a trail left on the page */
    var ambient = [], trail = [], lineTrail = [], sprites = [], spritesLight = [], emitAcc = 0, dustScale = 1, dustOn = !!dustCfg && !saveData;
    // Two looks per dust colour: glowing motes for dark ground, and deeper
    // gold specks for light ground (a glow would vanish on a pale page).
    function makeSprite(col, onLight) {
      var c = document.createElement('canvas'); c.width = c.height = 32;
      var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      if (onLight) {
        // On a pale page, dust is drawn as a four-point glint with a faint
        // halo, so it twinkles like a sparkle instead of looking like a speck.
        gr.addColorStop(0, css(col, 0.34));
        gr.addColorStop(0.5, css(col, 0.1));
        gr.addColorStop(1, css(col, 0));
        g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
        g.fillStyle = css(mix(col, DEEP_GOLD, 0.38), 1);
        g.beginPath();
        g.moveTo(16, 2); g.quadraticCurveTo(17.3, 14.7, 30, 16); g.quadraticCurveTo(17.3, 17.3, 16, 30);
        g.quadraticCurveTo(14.7, 17.3, 2, 16); g.quadraticCurveTo(14.7, 14.7, 16, 2);
        g.closePath(); g.fill();
        return c;
      } else {
        gr.addColorStop(0, css(mix(col, WHITE, 0.55), 1));
        gr.addColorStop(0.18, css(col, 1));
        gr.addColorStop(0.45, css(col, 0.28));
        gr.addColorStop(1, css(col, 0));
      }
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      return c;
    }
    if (dustCfg) {
      sprites = dustCols.map(function (c) { return makeSprite(c, false); });
      spritesLight = dustCols.map(function (c) { return makeSprite(c, true); });
    }

    /* ---- reading the ground: is the page dark or light under this point?
     * We sample a coarse grid a few times a second (cheap), walking up from
     * the element under each point until one has a solid background. */
    var GCOLS = 3, GROWS = 6, groundGrid = [], groundChar = 1, groundAt = -1e9, groundSy = -1e9, onDarkNow = false;
    function groundLum(x, y) {
      var el = document.elementFromPoint(clamp(x, 1, vw - 2), clamp(y, 1, vh - 2)), hops = 0;
      while (el && hops++ < 14) {
        if (el === toggleBtn) { el = el.parentElement; continue; }
        if (typeof SVGElement !== 'undefined' && el instanceof SVGElement) { el = (el.ownerSVGElement || el).parentElement; continue; }
        var tag = el.tagName;
        if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'IFRAME' || tag === 'PICTURE') return 0.25;   // photos: treat as dark
        var cs = window.getComputedStyle(el), bg = rgb(cs.backgroundColor);
        if (bg[3] > 0.6) return luminance(bg);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return 1 - luminance(rgb(cs.color));   // a gradient or picture: its text colour tells us
        el = el.parentElement;
      }
      var b = rgb(window.getComputedStyle(document.body).backgroundColor);
      if (b[3] > 0.6) return luminance(b);
      var h = rgb(window.getComputedStyle(document.documentElement).backgroundColor);
      return h[3] > 0.6 ? luminance(h) : 1;
    }
    function sampleGround(sy) {
      groundAt = now; groundSy = sy;
      if (spec) groundChar = groundLum(st.x, st.y);
      if (!dustOn) return;
      for (var r = 0; r < GROWS; r++) for (var c = 0; c < GCOLS; c++) groundGrid[r * GCOLS + c] = groundLum(vw * (c + 0.5) / GCOLS, vh * (r + 0.5) / GROWS);
    }
    function darkAt(x, y) {
      if (!groundGrid.length) return true;
      var c = clamp((x / vw * GCOLS) | 0, 0, GCOLS - 1), r = clamp((y / vh * GROWS) | 0, 0, GROWS - 1);
      return groundGrid[r * GCOLS + c] < 0.3;
    }
    function seedAmbient() {
      ambient = [];
      if (!dustOn || !dustCfg.ambient) return;
      var n = Math.round((vw < 720 ? 16 : 34) * dustCfg.amount * dustScale);
      for (var i = 0; i < n; i++) {
        // depth > 1: motes float between the reader and the page, so they
        // slide past faster than the page does when it scrolls.
        var d = rand(1.12, 2.05);
        ambient.push({ x: rand(0, vw), y: rand(0, vh), d: d, s: (0.55 + (d - 1.1) * 1.15) * rand(0.8, 1.2),
          a: rand(0.35, 0.8), tw: rand(0.6, 1.9), ph: rand(0, TAU), vx: rand(-6, 6), vy: rand(-9, -2),
          c: (Math.random() * sprites.length) | 0, spin: rand(0, TAU), flip: rand(1.2, 3.4) });
      }
    }
    function burst(x, y, n, power) {
      if (!dustOn) return;
      var sy = scrollTop();
      for (var i = 0; i < n; i++) {
        var a = rand(0, TAU), v = rand(40, 170) * (power || 1);
        trail.push({ x: x, y: y + sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0, max: rand(0.8, 1.6),
          s: rand(0.8, 2.1), c: (Math.random() * sprites.length) | 0, spin: rand(0, TAU), flip: rand(2, 5) });
      }
      if (trail.length > 160) trail.splice(0, trail.length - 160);
    }
    function emit(dt, speed) {
      if (!dustOn || !dustCfg.trail || !spec) return;
      var sy = scrollTop();
      var fx_ = Math.sin(st.rot), fy_ = -Math.cos(st.rot);         // facing direction
      var tailX = st.x - fx_ * 9 * K, tailY = st.y - fy_ * 9 * K;
      if (spec.trail === 'line') {
        var last = lineTrail[lineTrail.length - 1];
        if (!last || dist(last.x, last.y - sy, st.x, st.y) > 5) lineTrail.push({ x: st.x, y: st.y + sy, at: now });
        if (lineTrail.length > 90) lineTrail.shift();
        return;
      }
      var lightish = spec.model === 'light';
      var rate = st.mode === 'perched' ? (lightish ? 3 : 0.4) : (lightish ? 8 : 2.5) + speed * (lightish ? 0.028 : 0.016);
      emitAcc += rate * dt * dustCfg.amount * 1.6 * dustScale;
      while (emitAcc >= 1) {
        emitAcc -= 1;
        trail.push({ x: tailX + rand(-4, 4) * K, y: tailY + rand(-4, 4) * K + sy, vx: -fx_ * 24 + rand(-14, 14), vy: -fy_ * 24 + rand(-14, 10),
          life: 0, max: rand(0.9, 1.9), s: rand(0.6, 1.7), c: (Math.random() * sprites.length) | 0, spin: rand(0, TAU), flip: rand(2, 5) });
      }
      if (trail.length > 160) trail.splice(0, trail.length - 160);
    }
    function updateDust(dt, dy) {
      for (var i = 0; i < ambient.length; i++) {
        var p = ambient[i];
        p.y -= dy * p.d;
        p.x += (p.vx + Math.sin(t * 0.3 + p.ph) * 5) * dt;
        p.y += p.vy * dt;
        if (p.y < -20) { p.y = vh + 20; p.x = rand(0, vw); } else if (p.y > vh + 20) { p.y = -20; p.x = rand(0, vw); }
        if (p.x < -20) p.x = vw + 20; else if (p.x > vw + 20) p.x = -20;
      }
      for (var j = trail.length - 1; j >= 0; j--) {
        var q = trail[j];
        q.life += dt;
        if (q.life > q.max) { trail.splice(j, 1); continue; }
        q.vy += 22 * dt;                                     // gold dust settles slowly
        q.vx *= 1 - 1.3 * dt; q.vy *= 1 - 0.9 * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
      }
      while (lineTrail.length && now - lineTrail[0].at > 1700) lineTrail.shift();
    }
    var dustDirty = false;
    function drawDust(sy) {
      var busy = ambient.length || trail.length || lineTrail.length > 1;
      if (!busy && !dustDirty) return;
      dctx.setTransform(dDpr, 0, 0, dDpr, 0, 0);
      dctx.clearRect(0, 0, vw, vh);
      dustDirty = !!busy;
      if (!busy) return;
      var i, p, a;
      var y;
      if (flat) {
        // Flat brands get gold-leaf flakes that tumble and catch the light.
        for (i = 0; i < ambient.length; i++) {
          p = ambient[i]; a = p.a * (0.45 + 0.55 * Math.abs(Math.sin(t * p.tw + p.ph)));
          flake(p.x, p.y, p.s * 1.5, p.spin + t * 0.6, Math.cos(t * p.flip + p.ph), dustCols[p.c], a, darkAt(p.x, p.y));
        }
        for (i = 0; i < trail.length; i++) {
          p = trail[i]; a = (1 - p.life / p.max); y = p.y - sy;
          flake(p.x, y, p.s * 1.6, p.spin + p.life * 3, Math.cos(p.life * p.flip * 2), dustCols[p.c], a, darkAt(p.x, y));
        }
        dctx.setTransform(dDpr, 0, 0, dDpr, 0, 0);
      } else {
        for (i = 0; i < ambient.length; i++) {
          p = ambient[i]; a = p.a * (0.45 + 0.55 * Math.sin(t * p.tw + p.ph));
          if (a <= 0.02) continue;
          var r = p.s * 3.4;
          dctx.globalAlpha = a;
          dctx.drawImage((darkAt(p.x, p.y) ? sprites : spritesLight)[p.c], p.x - r, p.y - r, r * 2, r * 2);
        }
        for (i = 0; i < trail.length; i++) {
          p = trail[i]; a = 1 - p.life / p.max; y = p.y - sy;
          var r2 = p.s * 3.6 * (0.6 + 0.4 * a);
          dctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(p.life * 14 + p.spin));
          dctx.drawImage((darkAt(p.x, y) ? sprites : spritesLight)[p.c], p.x - r2, y - r2, r2 * 2, r2 * 2);
        }
        dctx.globalAlpha = 1;
      }
      if (lineTrail.length > 1) {
        var col = spec ? C.glow : dustCols[0], deep = mix(col, DEEP_GOLD, 0.42);
        dctx.lineCap = 'round';
        for (var pass = 0; pass < (flat ? 1 : 2); pass++) {
          for (i = 1; i < lineTrail.length; i++) {
            var p0 = lineTrail[i - 1], p1 = lineTrail[i], age = 1 - (now - p1.at) / 1700;
            if (age <= 0) continue;
            var dk = darkAt(p1.x, p1.y - sy), glowPass = pass === 0 && !flat;
            if (glowPass && !dk) continue;                        // no glow on pale ground
            dctx.beginPath(); dctx.moveTo(p0.x, p0.y - sy); dctx.lineTo(p1.x, p1.y - sy);
            dctx.lineWidth = (glowPass ? 6 : 1.8) * (0.3 + 0.7 * age) * K;
            dctx.strokeStyle = css(glowPass ? col : (dk ? (flat ? col : C.light || col) : deep), (glowPass ? 0.16 : 0.9) * age);
            dctx.stroke();
          }
        }
      }
    }
    function flake(x, y, s, rotA, sx, col, a, onDark) {
      if (a <= 0.02) return;
      var c = Math.cos(rotA), sn = Math.sin(rotA), w = Math.max(0.15, Math.abs(sx));
      if (!onDark) col = mix(col, DEEP_GOLD, 0.3);
      dctx.setTransform(dDpr * c * w, dDpr * sn * w, -dDpr * sn, dDpr * c, dDpr * x, dDpr * y);
      dctx.fillStyle = css(sx < 0 ? mix(col, [0, 0, 0, 1], 0.25) : col, a);   // the back of the flake is darker
      dctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
    }

    function drawCharacter() {
      var S = charS, cx = S / 2, cy = S / 2;
      cctx.setTransform(cDpr, 0, 0, cDpr, 0, 0);
      cctx.clearRect(0, 0, S, S);
      var k = K * (1 + st.alt * 0.16);
      var P = projector(cx, cy, k, st.rot, st.bank);
      var alpha = o.ghost ? lerp(0.16, 1, smooth01(progress * 1.1)) : 1;
      var edge = o.ghost ? Math.max(alpha, 0.85) : alpha;
      // Hysteresis: switch at 0.25 / 0.35 so it doesn't flicker on a boundary.
      if (groundChar < 0.25) onDarkNow = true; else if (groundChar > 0.35) onDarkNow = false;
      var onDark = onDarkNow, PAL = onDark && Cdark ? Cdark : C;
      var darkBody = luminance(PAL.primary) < 0.1;
      // Its shadow falls on the page below it: the higher it flies, the
      // further and softer the shadow. (Invisible on dark ground, so skipped.)
      if (!flat && spec.model !== 'light' && !onDark) paintShadow(cctx, st, cx, cy, K, spec.span);
      // A dark creature over a dark section gets a soft moonlit halo.
      if (onDark && darkBody && !flat) { cctx.shadowColor = css(mix(PAL.light, WHITE, 0.4), 0.55); cctx.shadowBlur = 7 * k * cDpr; }
      if (spec.model === 'butterfly') paintButterfly(cctx, st, P, k, PAL, o.look, finish, alpha, edge);
      else if (spec.model === 'bee') paintBee(cctx, st, P, k, PAL, o.look, finish, alpha, t);
      else if (spec.model === 'bird') paintBird(cctx, st, P, k, PAL, o.look, finish, alpha, edge, spec.shape, !!spec.hover);
      else paintLight(cctx, st, P, k, PAL, o.look, alpha, t, spec.shape, !onDark);
      cctx.shadowBlur = 0; cctx.shadowColor = 'rgba(0,0,0,0)';
      charCanvas.style.transform = 'translate3d(' + (st.x - cx).toFixed(1) + 'px,' + (st.y - cy).toFixed(1) + 'px,0)';
    }

    /* ---- the frame loop */
    var raf = 0, last = 0, running = false, frozen = false, frameNo = 0, perfT = 0, perfN = 0, hidden = false, started = false;
    function fx() { return enabled && !destroyed; }
    function wake() { if (!raf && running) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    function frame(ts) {
      raf = 0;
      if (!running) return;
      var dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000));
      last = ts; now = ts; frameNo++;
      var sy = scrollTop(), dy = sy - lastSy;
      lastSy = sy;
      if (now - groundAt > 400 || Math.abs(sy - groundSy) > vh * 0.25) sampleGround(sy);
      if (!frozen) {
        t += dt;
        sv = lerp(sv, dy / dt, ease(8, dt));
        if (Math.abs(dy) > 0.5) idle = 0; else idle += dt;
        progress = clamp(sy / maxScroll, 0, 1);
        if (spec && started) { think(dt); move(dt); }
        if (dustOn) updateDust(dt, dy);
      }
      if (spec && started) drawCharacter();
      if (dustOn || dustDirty) drawDust(sy);
      updateDepth(sy, dt);
      updateTilts(dt);
      updateMagnets(dt);
      // Slow devices: thin the dust, then drop it, so scrolling stays smooth.
      perfT += dt; perfN++;
      if (perfN >= 90) {
        var avg = perfT / perfN; perfT = 0; perfN = 0;
        if (t > 4 && avg > 0.03 && dustOn) {
          if (dustScale > 0.3) { dustScale *= 0.5; seedAmbient(); }
          else { dustOn = false; dustDirty = true; drawDust(sy); }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !fx() || hidden) return;
      running = true;
      lastSy = scrollTop();
      if (spec) charCanvas.style.display = '';
      dustCanvas.style.display = dustOn ? '' : 'none';
      scanReveal();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function setEnabled(on, byUser) {
      on = !!on;
      if (byUser) store(o.storageKey, on ? 'on' : 'off');
      if (on === enabled) { syncToggle(); return; }
      enabled = on;
      syncToggle();
      if (on) { resize(); start(); }
      else {
        stop();
        charCanvas.style.display = 'none'; dustCanvas.style.display = 'none';
        trail = []; lineTrail = [];
        resetTilts(); showAllReveals();
        depths.forEach(function (d) { d.el.style.translate = ''; d.x = d.y = 0; });
        magnets.forEach(function (m) { m.el.style.translate = ''; m.x = m.y = m.tx = m.ty = 0; });
      }
    }
    function syncToggle() {
      if (!toggleBtn) return;
      toggleBtn.setAttribute('aria-pressed', String(enabled));
      var tcfg = typeof o.toggle === 'object' ? o.toggle : {};
      toggleBtn.title = enabled ? (tcfg.titleOn || 'Moving effects are on. Click to pause them.') : (tcfg.titleOff || 'Moving effects are paused. Click to play them.');
    }

    /* ---- events */
    var offs = [], destroyed = false, resizeTimer = 0, mutTimer = 0, mo = null;
    offs.push(listen(window, 'resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (fx()) resize(); }, 150);
    }));
    offs.push(listen(document, 'visibilitychange', function () {
      hidden = document.hidden;
      if (hidden) stop(); else start();
    }));
    offs.push(listen(window, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var ms = performance.now(), dtp = Math.max(8, ms - pointer.at);
      pointer.speed = dist(e.clientX, e.clientY, pointer.x, pointer.y) / dtp * 1000;
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = ms;
      pointer.tnx = e.clientX / Math.max(1, vw) - 0.5; pointer.tny = e.clientY / Math.max(1, vh) - 0.5;
      if (!fx()) return;
      if (magnets.length) aimMagnets(e.clientX, e.clientY);
      // A fast swipe right at it startles it.
      if (!o.calm && spec && started && st.mode !== 'dart' && pointer.speed > 1300 && dist(e.clientX, e.clientY, st.x, st.y) < 70) dart();
    }, { passive: true }));
    // Clicking or tapping right on the companion makes it loop and sparkle.
    // The canvas ignores the pointer, so the click still reaches the page.
    offs.push(listen(document, 'pointerdown', function (e) {
      if (!fx() || !spec || !started) return;
      if (dist(e.clientX, e.clientY, st.x, st.y) < Math.max(26, sizePx * 0.6)) celebrate();
    }, { passive: true }));
    var onReduce = function () { if (!userChose) setEnabled(!reduce.matches, false); };
    if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
    if ('MutationObserver' in window) {
      mo = new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var tg = list[i].target;
          if (tg === document.body && Array.prototype.every.call(list[i].addedNodes, function (n) { return n === charCanvas || n === dustCanvas || n === toggleBtn; })) continue;
          clearTimeout(mutTimer);
          mutTimer = setTimeout(function () { if (fx()) { maxScroll = Math.max(1, scrollMax()); scan(); } }, 400);
          return;
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    var refreshTimer = setInterval(function () {
      if (!fx() || hidden) return;
      maxScroll = Math.max(1, scrollMax());
      scanPerches();
      depths.forEach(function (d) {
        var r = d.el.getBoundingClientRect();
        d.mid = r.top + r.height / 2 - d.y + scrollTop();
      });
    }, 1500);

    /* ---- public controls */
    function celebrate() {
      if (!spec || !started) return;
      st.loop = LOOP_T;
      burst(st.x, st.y, 26, 1.2);
      if (st.mode === 'perched' || st.mode === 'toPerch') leave();
    }
    function visit(el) {
      if (!spec || !el) return;
      var a = anchorOf(el);
      if (!a) return;
      st.perch = { el: el, x: a.x, y: a.y };
      setMode('visit');
      wake();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      clearInterval(refreshTimer); clearTimeout(resizeTimer); clearTimeout(mutTimer);
      offs.forEach(function (off) { off(); });
      if (reduce.removeEventListener) reduce.removeEventListener('change', onReduce);
      if (mo) mo.disconnect();
      if (revealIO) revealIO.disconnect();
      resetTilts(); showAllReveals();
      tilts.forEach(function (it) { if (it.glare && it.glare.parentNode) it.glare.parentNode.removeChild(it.glare); });
      depths.forEach(function (d) { d.el.style.translate = ''; });
      magnets.forEach(function (m) { m.el.style.translate = ''; });
      [charCanvas, dustCanvas, toggleBtn].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
      if (current === api) current = null;
      if (window.__livingLayer === api) delete window.__livingLayer;
    }

    var api = {
      version: VERSION,
      destroy: destroy,
      setEnabled: function (on) { setEnabled(on, true); },
      isEnabled: function () { return enabled; },
      refresh: function () { if (fx()) resize(); },
      celebrate: celebrate,
      burst: function (x, y, n) { burst(x, y, n || 24, 1); },
      visit: visit,
      state: function () {
        return { x: st.x, y: st.y, mode: st.mode, enabled: enabled, running: running, character: spec ? name : 'none',
          perch: st.perch && st.perch.el ? st.perch.el : null, size: sizePx, safeTop: safeTop, dust: dustOn };
      },
      // For screenshots and tests: hold still, or put the companion in a pose.
      debug: {
        freeze: function (on) { frozen = on !== false; },
        pose: function (p) { assign(st, p); }
      }
    };
    current = api;
    window.__livingLayer = api;

    resize();
    syncToggle();
    if (spec) {
      var lx0 = laneX(), ly0 = laneY();
      if (o.intro) {
        st.x = o.side === 'left' ? -40 : vw + 40;
        st.y = safeTop + 30; st.vx = o.side === 'left' ? 260 : -260; st.vy = 90;
        st.rot = o.side === 'left' ? 2.2 : -2.2;
      } else { st.x = lx0; st.y = ly0; setMode('cruise'); }
      setTimeout(function () { started = true; }, o.intro ? Math.max(0, o.introDelay) : 0);
    }
    hidden = document.hidden;
    start();
    return api;
  }

  /* ======================================================================
   * 9. Auto-start from the script tag:
   *    <script src="living-layer.js" data-living-layer='{"character":"bee"}'>
   * ==================================================================== */
  function autoStart() {
    if (typeof document === 'undefined') return;
    var me = document.currentScript;
    if (!me || !me.hasAttribute('data-living-layer')) me = document.querySelector('script[data-living-layer]');
    if (!me) return;
    var raw = me.getAttribute('data-living-layer'), cfg = {};
    if (raw && raw.trim().charAt(0) === '{') { try { cfg = JSON.parse(raw); } catch (e) { console.warn('living-layer: data-living-layer is not valid JSON', e); } }
    var go = function () { init(cfg); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }

  var LivingLayer = { init: init, version: VERSION, species: Object.keys(SPECIES) };
  autoStart();
  return LivingLayer;
});
