/**
 * Scope "Plan Your Project" — an SVG floor-plan editor.
 *
 * Draw WALLS corner to corner; enclosed areas become rooms automatically
 * (planar face-finding). Extra CAD features:
 *   - Ortho/angle snapping so walls are perfectly straight (0/45/90°).
 *   - Move walls and corners by dragging them (Select tool).
 *   - "Remove open walls": delete wall pieces not enclosing a room.
 *   - Copy/paste rooms & fixtures; duplicate a whole floor.
 *   - Doors with a flippable swing direction; windows.
 *   - Fixtures: stairs, lift, gate + furniture (bed, sofa, table, chair, sink,
 *     toilet, car, plant, kitchen counter, wardrobe) — place / move / rotate.
 *   - Live measurements, areas, multiple floors, PDF export + email.
 * Vanilla JS + SVG, no libraries. PDF/email produced by the Node server.
 */
(function () {
  "use strict";

  var PPM = 40, GRID = 20, SNAP = 14, W = 1200, H = 820;

  var ROOM_TYPES = [
    { key: "room", label: "Room", fill: "#eef2f7" },
    { key: "bedroom", label: "Bedroom", fill: "#e3edfb" },
    { key: "bathroom", label: "Bathroom", fill: "#dff3ef" },
    { key: "kitchen", label: "Kitchen", fill: "#fdeede" },
    { key: "living", label: "Living Room", fill: "#efe7fb" },
    { key: "majlis", label: "Majlis", fill: "#fbe6ee" },
    { key: "dining", label: "Dining", fill: "#e6f6ea" },
    { key: "garage", label: "Garage", fill: "#e9ebee" },
    { key: "store", label: "Store", fill: "#f2ece0" }
  ];
  function typeInfo(key) {
    for (var i = 0; i < ROOM_TYPES.length; i++) if (ROOM_TYPES[i].key === key) return ROOM_TYPES[i];
    return ROOM_TYPES[0];
  }
  var WALL_COLOR = "#0b1f33", WALL_W = 5;

  // --- small SVG builders ------------------------------------------------------
  function R(x, y, w, h, fill, stroke, sw, extra) {
    return '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) +
      '" fill="' + (fill || "none") + '" stroke="' + (stroke || "none") + '" stroke-width="' + (sw || 0) +
      '"' + (extra || "") + " />";
  }
  function L(x1, y1, x2, y2, stroke, sw, extra) {
    return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2) +
      '" stroke="' + stroke + '" stroke-width="' + sw + '"' + (extra || "") + " />";
  }
  function C(cx, cy, r, fill, stroke, sw) {
    return '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" fill="' + (fill || "none") +
      '" stroke="' + (stroke || "none") + '" stroke-width="' + (sw || 0) + '" />';
  }
  function f1(n) { return (Math.round(n * 10) / 10); }

  // --- Fixtures catalogue (drawn centred on f.x,f.y) ---------------------------
  var FUR = "#efe9df", FURS = "#9a8f79", ARC = "#0b1f33"; // furniture fill/stroke, architectural stroke
  var FIXTURES = {
    stairs: { label: "Stairs", w: 60, h: 110, cat: "arch", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2, s = "";
      s += R(x, y, f.w, f.h, "#ffffff", ARC, 2);
      for (var i = 1; i < 9; i++) s += L(x, y + f.h * i / 9, x + f.w, y + f.h * i / 9, ARC, 1);
      s += L(f.x, y + 6, f.x, y + f.h - 6, "#8a6d1f", 2);
      s += '<path d="M' + f1(f.x) + ' ' + f1(y + 6) + ' l-4 8 l8 0 z" fill="#8a6d1f"/>';
      return s;
    } },
    lift: { label: "Lift / Elevator", w: 62, h: 62, cat: "arch", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y, f.w, f.h, "#ffffff", ARC, 2) +
        L(x, y, x + f.w, y + f.h, ARC, 1) + L(x + f.w, y, x, y + f.h, ARC, 1) +
        txt(f.x, f.y + 4, "LIFT", 10, ARC, "middle", "bold");
    } },
    gate: { label: "Gate", w: 90, h: 22, cat: "arch", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y;
      return R(x - 3, f.y - f.h / 2, 6, f.h, ARC, ARC, 1) + R(x + f.w - 3, f.y - f.h / 2, 6, f.h, ARC, ARC, 1) +
        L(x, y, x + f.w, y, "#8a6d1f", 2, ' stroke-dasharray="5 4"') +
        '<path d="M' + f1(x) + " " + f1(y) + " A" + f.w + " " + f.w + " 0 0 1 " + f1(x + f.w * 0.5) + " " + f1(y - f.w * 0.5) +
        '" fill="none" stroke="#8a6d1f" stroke-width="1.2"/>';
    } },
    bed: { label: "Bed", w: 84, h: 104, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y, f.w, f.h, FUR, FURS, 1.5, ' rx="4"') +
        R(x + 5, y + 5, f.w - 10, f.h * 0.22, "#ffffff", FURS, 1, ' rx="3"') +
        R(x + 4, y + f.h * 0.3, f.w - 8, f.h * 0.66, "#f6f1e8", FURS, 1, ' rx="3"');
    } },
    sofa: { label: "Sofa", w: 104, h: 46, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y, f.w, f.h * 0.42, FUR, FURS, 1.5, ' rx="4"') +
        R(x, y + f.h * 0.32, 12, f.h * 0.68, FUR, FURS, 1.5, ' rx="4"') +
        R(x + f.w - 12, y + f.h * 0.32, 12, f.h * 0.68, FUR, FURS, 1.5, ' rx="4"') +
        R(x + 10, y + f.h * 0.42, f.w - 20, f.h * 0.55, "#f6f1e8", FURS, 1, ' rx="4"');
    } },
    table: { label: "Table", w: 74, h: 52, cat: "fur", draw: function (f) {
      return R(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, FUR, FURS, 1.5, ' rx="4"');
    } },
    chair: { label: "Chair", w: 30, h: 30, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y + 5, f.w, f.h - 5, FUR, FURS, 1.2, ' rx="3"') + R(x, y, f.w, 5, FURS, FURS, 1);
    } },
    sink: { label: "Sink", w: 42, h: 32, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y, f.w, f.h, "#eef3f6", FURS, 1.2, ' rx="3"') + C(f.x, f.y + 2, 8, "none", FURS, 1.2) + C(f.x, y + 4, 1.6, FURS);
    } },
    toilet: { label: "Toilet", w: 36, h: 50, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x + 4, y, f.w - 8, 12, "#eef3f6", FURS, 1.2, ' rx="2"') +
        '<ellipse cx="' + f1(f.x) + '" cy="' + f1(y + 30) + '" rx="' + f1(f.w / 2) + '" ry="16" fill="#eef3f6" stroke="' + FURS + '" stroke-width="1.2"/>';
    } },
    car: { label: "Car", w: 74, h: 134, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y, f.w, f.h, "#e7ecf1", FURS, 1.5, ' rx="12"') +
        R(x + 7, y + 14, f.w - 14, f.h * 0.32, "#cdd6df", FURS, 1, ' rx="6"') +
        R(x - 3, y + 18, 4, 16, FURS) + R(x + f.w - 1, y + 18, 4, 16, FURS) +
        R(x - 3, y + f.h - 34, 4, 16, FURS) + R(x + f.w - 1, y + f.h - 34, 4, 16, FURS);
    } },
    plant: { label: "Plant", w: 38, h: 38, cat: "fur", draw: function (f) {
      return C(f.x, f.y, f.w / 2, "#dcead9", "#7fa374", 1.5) + R(f.x - 6, f.y + f.h / 2 - 6, 12, 8, "#c9a77b", FURS, 1);
    } },
    counter: { label: "Kitchen counter", w: 130, h: 30, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2;
      return R(x, y, f.w, f.h, "#e7ecf1", FURS, 1.5) + L(x, y + f.h - 5, x + f.w, y + f.h - 5, FURS, 1) + C(x + 26, f.y, 7, "none", FURS, 1.2);
    } },
    wardrobe: { label: "Wardrobe", w: 96, h: 30, cat: "fur", draw: function (f) {
      var x = f.x - f.w / 2, y = f.y - f.h / 2, s = R(x, y, f.w, f.h, FUR, FURS, 1.5);
      s += L(f.x, y, f.x, y + f.h, FURS, 1);
      s += C(f.x - 4, f.y, 1.4, FURS) + C(f.x + 4, f.y, 1.4, FURS);
      return s;
    } }
  };
  var FIX_AR = {
    stairs: "درج", lift: "مصعد", gate: "بوابة", bed: "سرير", sofa: "أريكة",
    table: "طاولة", chair: "كرسي", sink: "مغسلة", toilet: "مرحاض", car: "سيارة",
    plant: "نبتة", counter: "كاونتر مطبخ", wardrobe: "خزانة"
  };
  function fixtureLabel(type) {
    if (curLang() === "ar" && FIX_AR[type]) return FIX_AR[type];
    return (FIXTURES[type] || {}).label || type;
  }

  // --- State -------------------------------------------------------------------
  var uid = 1; function nextId() { return "s" + (uid++); }
  function newFloor(name) { return { id: nextId(), name: name, segments: [], openings: [], fixtures: [], meta: {}, labelOffsets: {} }; }
  function lblPos(f, key, bx, by) { var o = f.labelOffsets[key]; return { x: bx + (o ? o.dx : 0), y: by + (o ? o.dy : 0) }; }

  var state = {
    floors: [newFloor("Ground Floor")], current: 0,
    tool: "wall", fixtureType: "stairs", ortho: true, showMeasure: true, units: "m", showNorth: true,
    draft: null, hover: null,
    selSegment: -1, selRoomKey: null, selOpeningId: null, selFixtureId: null, selPiece: null,
    clipboard: null, history: [], redo: [], scalePts: [],
    drag: null // { kind, ... }
  };
  function floor() { return state.floors[state.current]; }

  var svg, hintEl, totalsEl, msgEl, floorTabsEl, selPropsEl, measureToggle, orthoToggle, fixtureSel;
  function $(id) { return document.getElementById(id); }

  // --- Geometry ----------------------------------------------------------------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function shoelace(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y; } return a / 2; }
  function centroid(p) { var x = 0, y = 0; p.forEach(function (q) { x += q.x; y += q.y; }); return { x: x / p.length, y: y / p.length }; }
  function bbox(p) { var xs = p.map(function (q) { return q.x; }), ys = p.map(function (q) { return q.y; }); return { minX: Math.min.apply(null, xs), minY: Math.min.apply(null, ys), maxX: Math.max.apply(null, xs), maxY: Math.max.apply(null, ys) }; }
  function pip(pt, p) { var inside = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { var xi = p[i].x, yi = p[i].y, xj = p[j].x, yj = p[j].y; if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
  function nearestOnSeg(p, a, b) { var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)); return { x: a.x + t * dx, y: a.y + t * dy, angle: Math.atan2(dy, dx) }; }
  function rot(px, py, cx, cy, deg) { var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), dx = px - cx, dy = py - cy; return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }; }
  var FT = 3.280839895, SQFT = 10.7639104;
  function mLabel(px) { var m = px / PPM; return state.units === "ft" ? (m * FT).toFixed(2) + " ft" : m.toFixed(2) + " m"; }
  function areaLabel(px2) { var a = px2 / (PPM * PPM); return state.units === "ft" ? (a * SQFT).toFixed(1) + " ft²" : a.toFixed(1) + " m²"; }

  // --- Room detection (planar faces) ------------------------------------------
  function segInter(p1, p2, p3, p4) {
    var d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y, den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) return null;
    var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den, u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return { x: p1.x + t * d1x, y: p1.y + t * d1y, t: Math.max(0, Math.min(1, t)) };
  }
  // Split one segment at its intersections with `others`; returns pieces {a,b}.
  function segPieces(seg, others) {
    var pts = [{ t: 0, x: seg.a.x, y: seg.a.y }, { t: 1, x: seg.b.x, y: seg.b.y }];
    others.forEach(function (o) { var r = segInter(seg.a, seg.b, o.a, o.b); if (r) pts.push(r); });
    pts.sort(function (p, q) { return p.t - q.t; });
    var out = [];
    for (var k = 0; k < pts.length - 1; k++) { var a = pts[k], b = pts[k + 1]; if (Math.hypot(a.x - b.x, a.y - b.y) > 0.5) out.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } }); }
    return out;
  }
  function splitSegments(segs) {
    segs = segs.filter(function (s) { return dist(s.a, s.b) > 1e-6; });
    var out = [];
    for (var i = 0; i < segs.length; i++) { var others = []; for (var j = 0; j < segs.length; j++) if (j !== i) others.push(segs[j]); segPieces(segs[i], others).forEach(function (p) { out.push(p); }); }
    return out;
  }
  function pointOnRoomEdge(pt, rooms, tol) {
    for (var i = 0; i < rooms.length; i++) { var p = rooms[i].points; for (var j = 0; j < p.length; j++) if (dist(pt, nearestOnSeg(pt, p[j], p[(j + 1) % p.length])) <= tol) return true; }
    return false;
  }
  // Find the wall PIECE under the cursor. A piece is a wall sub-segment between
  // intersections. `open` = its midpoint doesn't border any enclosed room.
  function wallPieceAt(raw, maxD, rooms) {
    var segs = floor().segments, best = null, bd = maxD;
    for (var idx = 0; idx < segs.length; idx++) {
      var others = []; for (var j = 0; j < segs.length; j++) if (j !== idx) others.push(segs[j]);
      var pieces = segPieces(segs[idx], others);
      for (var p = 0; p < pieces.length; p++) { var pc = pieces[p], d = dist(raw, nearestOnSeg(raw, pc.a, pc.b)); if (d < bd) { bd = d; best = { a: pc.a, b: pc.b, parent: idx }; } }
    }
    if (best) { var mid = { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 }; best.open = !pointOnRoomEdge(mid, rooms || getRooms(), 2.5); }
    return best;
  }

  function computeRooms(segs) {
    var MERGE = 0.5, sub = splitSegments(segs);
    var nodes = [], nk = {};
    function ni(x, y) { var kx = Math.round(x / MERGE) * MERGE, ky = Math.round(y / MERGE) * MERGE, k = kx + "_" + ky; if (k in nk) return nk[k]; var i = nodes.length; nodes.push({ x: kx, y: ky }); nk[k] = i; return i; }
    var es = {}, adj = [];
    function ae(a, b) { if (a === b) return; var k = a < b ? a + "_" + b : b + "_" + a; if (es[k]) return; es[k] = 1; (adj[a] || (adj[a] = [])).push(b); (adj[b] || (adj[b] = [])).push(a); }
    sub.forEach(function (s) { ae(ni(s.a.x, s.a.y), ni(s.b.x, s.b.y)); });
    function ang(fr, to) { return Math.atan2(nodes[to].y - nodes[fr].y, nodes[to].x - nodes[fr].x); }
    function nx(u, v) { var ab = ang(v, u), best = null, bd = Infinity; (adj[v] || []).forEach(function (w) { var d = ab - ang(v, w); while (d <= 1e-9) d += Math.PI * 2; if (d < bd) { bd = d; best = w; } }); return best; }
    var half = {}, rooms = [];
    for (var u = 0; u < nodes.length; u++) (adj[u] || []).forEach(function (v) {
      if (half[u + "_" + v]) return;
      var face = [], cu = u, cv = v, g = 0;
      do { half[cu + "_" + cv] = 1; face.push(cu); var w = nx(cu, cv); if (w == null) break; cu = cv; cv = w; if (g++ > 1e5) break; } while (!(cu === u && cv === v));
      if (face.length < 3) return;
      var poly = face.map(function (n) { return { x: nodes[n].x, y: nodes[n].y }; }), ar = shoelace(poly);
      if (ar > 10) rooms.push({ points: poly, area: ar });
    });
    return rooms;
  }
  function roomKey(pts) { var c = centroid(pts); return Math.round(c.x / 6) + "_" + Math.round(c.y / 6); }
  function getRooms(f) {
    f = f || floor();
    return computeRooms(f.segments).map(function (r) {
      var key = roomKey(r.points), m = f.meta[key] || {};
      return { points: r.points, area: r.area, key: key, name: m.name || "", type: m.type || "room", centroid: centroid(r.points) };
    });
  }

  // --- Snapping (with ortho/angle) --------------------------------------------
  function vertices() { var v = []; floor().segments.forEach(function (s) { v.push(s.a); v.push(s.b); }); return v; }
  function snapVertex(pt) { var best = null, bd = SNAP; vertices().forEach(function (v) { var d = dist(pt, v); if (d < bd) { bd = d; best = { x: v.x, y: v.y }; } }); return best; }
  function snapOntoWall(pt) { var bd = SNAP, bp = null; floor().segments.forEach(function (s) { var np = nearestOnSeg(pt, s.a, s.b), d = dist(pt, np); if (d < bd) { bd = d; bp = { x: np.x, y: np.y }; } }); return bp; }
  function gridSnap(pt) { return { x: Math.round(pt.x / GRID) * GRID, y: Math.round(pt.y / GRID) * GRID }; }

  function angleSnap(prev, pt) {
    var dx = pt.x - prev.x, dy = pt.y - prev.y, a = Math.atan2(dy, dx);
    var sa = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    var d = Math.round(Math.hypot(dx, dy) / GRID) * GRID;
    return { x: prev.x + Math.cos(sa) * d, y: prev.y + Math.sin(sa) * d };
  }

  // The point used while drawing a wall: prefers connecting to existing corners/
  // walls, otherwise snaps to a straight angle (if ortho on) or the grid.
  function drawPoint(raw) {
    var v = snapVertex(raw); if (v) return v;
    var prev = state.draft && state.draft.points.length ? state.draft.points[state.draft.points.length - 1] : null;
    var base = (state.ortho && prev) ? angleSnap(prev, raw) : gridSnap(raw);
    var w = snapOntoWall(base) || snapOntoWall(raw);
    if (w) {
      // keep the straight axis: if the wall snap barely changes the ortho point, take it
      if (!prev || dist(w, base) < GRID * 1.2) return w;
    }
    return base;
  }

  function svgPoint(evt) { var p = svg.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY; var l = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: l.x, y: l.y }; }

  // --- History -----------------------------------------------------------------
  function snap0() { return JSON.stringify({ f: state.floors, c: state.current }); }
  function snapshot() { state.history.push(snap0()); if (state.history.length > 80) state.history.shift(); state.redo = []; }
  function undo() { if (!state.history.length) return; state.redo.push(snap0()); apply(state.history.pop()); }
  function redo() { if (!state.redo.length) return; state.history.push(snap0()); apply(state.redo.pop()); }
  function apply(str) { var s = JSON.parse(str); state.floors = s.f; state.current = Math.min(s.c, state.floors.length - 1); clearSel(); state.draft = null; renderAll(); }
  function clearSel() { state.selSegment = -1; state.selRoomKey = null; state.selOpeningId = null; state.selFixtureId = null; state.selPiece = null; }

  // --- Save / load (localStorage) ---------------------------------------------
  var STORAGE_KEY = "scopePlannerProject_v1";
  var saveTimer = null;
  function setVal(id, v) { var e = $(id); if (e) e.value = v || ""; }
  function valOf(id) { var e = $(id); return e ? e.value : ""; }
  function saveProject() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        floors: state.floors, current: state.current, ppm: PPM, units: state.units, showNorth: state.showNorth,
        project: { projectName: valOf("projectName"), clientName: valOf("clientName"), clientEmail: valOf("clientEmail"), notes: valOf("notes") }
      }));
      var el = $("saveStatus"); if (el) el.textContent = curLang() === "ar" ? "محفوظ ✓" : "Saved ✓";
    } catch (e) {}
  }
  function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveProject, 700); }
  function loadProject() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false;
      var d = JSON.parse(raw);
      if (!d.floors || !d.floors.length) return false;
      state.floors = d.floors; state.current = Math.min(d.current || 0, d.floors.length - 1);
      if (d.ppm) PPM = d.ppm;
      if (d.units) state.units = d.units;
      if (typeof d.showNorth === "boolean") state.showNorth = d.showNorth;
      state.floors.forEach(function (f) { f.segments = f.segments || []; f.openings = f.openings || []; f.fixtures = f.fixtures || []; f.meta = f.meta || {}; f.labelOffsets = f.labelOffsets || {}; });
      if (d.project) { setVal("projectName", d.project.projectName); setVal("clientName", d.project.clientName); setVal("clientEmail", d.project.clientEmail); setVal("notes", d.project.notes); }
      return true;
    } catch (e) { return false; }
  }
  function newPlan() {
    if (!window.confirm(curLang() === "ar" ? "بدء مخطط جديد؟ سيُمسح الحالي." : "Start a new plan? This clears the current one.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    state.floors = [newFloor("Ground Floor")]; state.current = 0; state.history = []; state.redo = []; PPM = 40;
    clearSel(); state.draft = null;
    setVal("projectName", ""); setVal("clientName", ""); setVal("clientEmail", ""); setVal("notes", "");
    renderAll();
  }

  // --- Set scale ---------------------------------------------------------------
  function startScale() { state.scalePts = []; setTool("scale"); }
  function finishScale() {
    var p = state.scalePts; if (p.length < 2) return;
    var px = dist(p[0], p[1]);
    var ans = window.prompt(curLang() === "ar" ? "المسافة الحقيقية بين النقطتين بالأمتار:" : "Real distance between the two points, in metres:", "");
    var meters = parseFloat((ans || "").replace(",", "."));
    if (meters && meters > 0 && px > 1) { PPM = px / meters; flash(msgFor("scaleSet")); saveProject(); }
    state.scalePts = []; setTool("select");
  }

  // Snap a fixture against a nearby wall (only when close; otherwise leave it).
  function snapFixtureToWall(fx) {
    var c = { x: fx.x, y: fx.y }, best = null, bd = 36;
    floor().segments.forEach(function (s) { var np = nearestOnSeg(c, s.a, s.b); var d = dist(c, np); if (d < bd) { bd = d; best = { np: np, s: s }; } });
    if (!best) return;
    var s = best.s, np = best.np, ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
    var nx = c.x - np.x, ny = c.y - np.y, nl = Math.hypot(nx, ny);
    if (nl < 1) { nx = -Math.sin(ang); ny = Math.cos(ang); } else { nx /= nl; ny /= nl; }
    fx.rot = Math.round(ang * 180 / Math.PI);
    var off = fx.h / 2 + WALL_W / 2;
    fx.x = np.x + nx * off; fx.y = np.y + ny * off;
  }

  // --- Markup ------------------------------------------------------------------
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ptsAttr(p) { return p.map(function (q) { return f1(q.x) + "," + f1(q.y); }).join(" "); }
  function txt(x, y, str, size, color, anchor, weight) { return '<text x="' + f1(x) + '" y="' + f1(y) + '" font-family="Helvetica, Arial, sans-serif" font-size="' + (size || 12) + '" fill="' + (color || "#153b5c") + '" text-anchor="' + (anchor || "middle") + '"' + (weight ? ' font-weight="' + weight + '"' : "") + ">" + esc(str) + "</text>"; }

  function openingMarkup(op, selected) {
    var size = 16, ca = Math.cos(op.a), sa = Math.sin(op.a);
    var x1 = op.x - ca * size, y1 = op.y - sa * size, x2 = op.x + ca * size, y2 = op.y + sa * size;
    var s = L(x1, y1, x2, y2, "#ffffff", WALL_W + 2);
    if (op.type === "door") {
      var fl = op.flip || 1;
      var swx = x2 - sa * size * fl, swy = y2 + ca * size * fl;
      s += '<path d="M' + f1(x2) + " " + f1(y2) + " A" + size + " " + size + " 0 0 " + (fl > 0 ? 1 : 0) + " " + f1(swx) + " " + f1(swy) + '" fill="none" stroke="#8a6d1f" stroke-width="1.5"/>';
      s += L(x2, y2, swx, swy, "#8a6d1f", 1.5);
    } else {
      s += L(x1, y1, x2, y2, "#2563a8", 2.5);
    }
    if (selected) s += C(op.x, op.y, size + 5, "none", "#f4b942", 2);
    return s;
  }

  function fixtureMarkup(fx, selected) {
    var def = FIXTURES[fx.type]; if (!def) return "";
    var g = '<g transform="rotate(' + (fx.rot || 0) + " " + f1(fx.x) + " " + f1(fx.y) + ')">' + def.draw(fx) + "</g>";
    if (selected) {
      var hw = fx.w / 2 + 4, hh = fx.h / 2 + 4;
      g += '<g transform="rotate(' + (fx.rot || 0) + " " + f1(fx.x) + " " + f1(fx.y) + ')">' +
        R(fx.x - hw, fx.y - hh, hw * 2, hh * 2, "none", "#f4b942", 2, ' stroke-dasharray="4 3"') + "</g>";
    }
    return g;
  }

  function roomsFill(rooms) { return rooms.map(function (r) { return '<polygon points="' + ptsAttr(r.points) + '" fill="' + typeInfo(r.type).fill + '" stroke="none"' + (r.key === state.selRoomKey ? ' opacity="0.75"' : "") + " />"; }).join(""); }
  function wallsMarkup() {
    return floor().segments.map(function (seg, i) {
      var sel = i === state.selSegment;
      return L(seg.a.x, seg.a.y, seg.b.x, seg.b.y, sel ? "#f4b942" : WALL_COLOR, WALL_W + (sel ? 2 : 0), ' stroke-linecap="round"');
    }).join("");
  }

  // All measurement/name labels are drawn here (on top, and DRAGGABLE). Each is
  // recorded in lastLabels so the Select tool can grab and move it (its offset is
  // stored per floor in labelOffsets, keyed by geometry).
  var lastLabels = [];
  function lbl(f, key, bx, by, str, size, color, weight) {
    var p = lblPos(f, key, bx, by), w = str.length * size * 0.55, h = size;
    lastLabels.push({ key: key, bx: bx, by: by, x: p.x, y: p.y, w: w, h: h });
    return txt(p.x, p.y, str, size, color, "middle", weight);
  }
  function measuresMarkup(f, rooms, measure) {
    lastLabels = [];
    var s = "";
    if (measure) f.segments.forEach(function (seg) {
      var Ln = dist(seg.a, seg.b); if (Ln <= 26) return;
      var mx = (seg.a.x + seg.b.x) / 2, my = (seg.a.y + seg.b.y) / 2, nx = -(seg.b.y - seg.a.y) / Ln, ny = (seg.b.x - seg.a.x) / Ln;
      s += lbl(f, "wl:" + Math.round(mx) + "_" + Math.round(my), mx + nx * 11, my + ny * 11 + 4, mLabel(Ln), 10.5, "#334155");
    });
    rooms.forEach(function (r) {
      s += lbl(f, "rn:" + r.key, r.centroid.x, r.centroid.y - 2, r.name || typeInfo(r.type).label, 13, "#0b1f33", "bold");
      if (measure) s += lbl(f, "ra:" + r.key, r.centroid.x, r.centroid.y + 15, areaLabel(r.area), 11, "#475569");
    });
    return s;
  }
  function labelAt(raw) {
    for (var i = lastLabels.length - 1; i >= 0; i--) {
      var Lb = lastLabels[i];
      if (raw.x >= Lb.x - Lb.w / 2 - 3 && raw.x <= Lb.x + Lb.w / 2 + 3 && raw.y >= Lb.y - Lb.h && raw.y <= Lb.y + Lb.h * 0.4) return Lb;
    }
    return null;
  }
  function draftMarkup() {
    if (!state.draft) return "";
    var pts = state.draft.points.slice(), s = "";
    if (state.hover) pts.push(state.hover);
    if (pts.length >= 2) s += '<polyline points="' + ptsAttr(pts) + '" fill="none" stroke="#f4b942" stroke-width="2" stroke-dasharray="4 4"/>';
    state.draft.points.forEach(function (p) { s += C(p.x, p.y, 4, "#f4b942", "#0b1f33", 1); });
    return s;
  }
  function canvasBg() {
    return '<defs><pattern id="pgrid" width="' + GRID + '" height="' + GRID + '" patternUnits="userSpaceOnUse"><path d="M ' + GRID + ' 0 L 0 0 0 ' + GRID + '" fill="none" stroke="#e6ebf1" stroke-width="1"/></pattern></defs>' +
      R(0, 0, W, H, "#ffffff") + R(0, 0, W, H, "url(#pgrid)");
  }

  var lastRooms = [];
  function renderAll() {
    var f = floor(); lastRooms = getRooms(f); var m = state.showMeasure;
    var body = canvasBg() + roomsFill(lastRooms);
    f.fixtures.forEach(function (fx) { body += fixtureMarkup(fx, fx.id === state.selFixtureId); });
    body += wallsMarkup();
    if (state.selPiece) body += L(state.selPiece.a.x, state.selPiece.a.y, state.selPiece.b.x, state.selPiece.b.y, "#f4b942", WALL_W + 3, ' stroke-linecap="round"');
    f.openings.forEach(function (op) { body += openingMarkup(op, op.id === state.selOpeningId); });
    body += measuresMarkup(f, lastRooms, m) + draftMarkup();
    if (state.tool === "scale") {
      state.scalePts.forEach(function (p) { body += C(p.x, p.y, 5, "#f4b942", "#0b1f33", 1.5); });
      if (state.scalePts.length === 1 && state.hover) body += L(state.scalePts[0].x, state.scalePts[0].y, state.hover.x, state.hover.y, "#f4b942", 2, ' stroke-dasharray="4 4"');
    }
    if (state.hover && state.tool !== "select") body += C(state.hover.x, state.hover.y, 4, "none", "#153b5c", 1.5);
    if (state.showNorth) body += northMarkup(W - 60, 64, 22);
    svg.innerHTML = body;
    renderFloors(); renderTotals(); renderSchedule(); renderSelection(); renderHint();
    scheduleSave();
  }

  function renderSchedule() {
    var el = $("roomSchedule"); if (!el) return;
    var rooms = lastRooms.slice().sort(function (a, b) { return b.area - a.area; });
    if (!rooms.length) { el.innerHTML = '<p style="font-size:12.5px;color:var(--muted);margin:0;" data-en="Draw walls to see rooms here." data-ar="ارسم جدراناً لعرض الغرف هنا.">Draw walls to see rooms here.</p>'; applyLangTo(el); return; }
    var total = 0, rows = "";
    rooms.forEach(function (r) {
      total += r.area;
      rows += '<div class="planner-total-row"><span>' + esc(r.name || typeInfo(r.type).label) + "</span><strong>" + areaLabel(r.area) + "</strong></div>";
    });
    rows += '<div class="planner-total-row grand"><span data-en="Floor total" data-ar="إجمالي الطابق">Floor total</span><strong>' + areaLabel(total) + "</strong></div>";
    el.innerHTML = rows; applyLangTo(el);
  }

  function renderFloors() {
    floorTabsEl.innerHTML = "";
    state.floors.forEach(function (f, i) {
      var tab = document.createElement("button");
      tab.className = "planner-floor-tab" + (i === state.current ? " active" : "");
      tab.textContent = f.name;
      tab.addEventListener("click", function () { state.current = i; state.draft = null; clearSel(); renderAll(); });
      tab.addEventListener("dblclick", function () { var nm = prompt("Floor name:", f.name); if (nm) { f.name = nm.trim() || f.name; renderAll(); } });
      floorTabsEl.appendChild(tab);
    });
    floorTabsEl.appendChild(floorBtn("+", "Add floor", function () { snapshot(); state.floors.push(newFloor("Floor " + (state.floors.length + 1))); state.current = state.floors.length - 1; state.draft = null; clearSel(); renderAll(); }));
    floorTabsEl.appendChild(floorBtn("⧉", "Duplicate floor", function () { snapshot(); var copy = JSON.parse(JSON.stringify(floor())); copy.id = nextId(); copy.name = floor().name + " (copy)"; state.floors.splice(state.current + 1, 0, copy); state.current += 1; clearSel(); renderAll(); }));
    if (state.floors.length > 1) floorTabsEl.appendChild(floorBtn("🗑", "Delete floor", function () { snapshot(); state.floors.splice(state.current, 1); state.current = Math.max(0, state.current - 1); clearSel(); renderAll(); }, true));
  }
  function floorBtn(label, title, fn, danger) { var b = document.createElement("button"); b.className = "planner-floor-add" + (danger ? " danger" : ""); b.textContent = label; b.title = title; b.addEventListener("click", fn); return b; }

  function floorArea(f) { var a = 0; computeRooms(f.segments).forEach(function (r) { a += r.area; }); return a; }
  function floorDims(f) { var p = []; f.segments.forEach(function (s) { p.push(s.a); p.push(s.b); }); if (!p.length) return null; var b = bbox(p); return { w: (b.maxX - b.minX) / PPM, h: (b.maxY - b.minY) / PPM }; }
  function renderTotals() {
    var html = "", grand = 0;
    state.floors.forEach(function (f) { var rooms = computeRooms(f.segments), area = 0; rooms.forEach(function (r) { area += r.area; }); grand += area; var d = floorDims(f); html += '<div class="planner-total-row"><span>' + esc(f.name) + "</span><strong>" + areaLabel(area) + "</strong></div>"; if (d) html += '<div class="planner-total-sub">' + d.w.toFixed(2) + " × " + d.h.toFixed(2) + " m · " + rooms.length + " rooms · " + f.fixtures.length + " items</div>"; });
    html += '<div class="planner-total-row grand"><span data-en="Total area" data-ar="المساحة الكلية">Total area</span><strong>' + areaLabel(grand) + "</strong></div>";
    totalsEl.innerHTML = html; applyLangTo(totalsEl);
  }

  function selectedRoom() { for (var i = 0; i < lastRooms.length; i++) if (lastRooms[i].key === state.selRoomKey) return lastRooms[i]; return null; }
  function selectedFixture() { var a = floor().fixtures.filter(function (x) { return x.id === state.selFixtureId; }); return a[0] || null; }
  function selectedOpening() { var a = floor().openings.filter(function (x) { return x.id === state.selOpeningId; }); return a[0] || null; }

  function renderSelection() {
    var r = selectedRoom(), fx = selectedFixture(), op = selectedOpening();
    if (r) {
      selPropsEl.style.display = "";
      selPropsEl.innerHTML =
        '<h3 data-en="Selected room" data-ar="الغرفة المحددة">Selected room</h3>' +
        '<label class="planner-field"><span data-en="Label" data-ar="التسمية">Label</span><input type="text" id="selName"></label>' +
        '<label class="planner-field"><span data-en="Type" data-ar="النوع">Type</span><select id="selType"></select></label>' +
        '<p class="planner-selarea">' + areaLabel(r.area) + "</p>";
      applyLangTo(selPropsEl);
      var st = $("selType"); st.innerHTML = ROOM_TYPES.map(function (t) { return '<option value="' + t.key + '">' + t.label + "</option>"; }).join(""); st.value = r.type;
      $("selName").value = r.name;
      $("selName").addEventListener("input", function () { floor().meta[r.key] = { name: this.value, type: r.type }; state.selRoomKey = r.key; renderAllKeepFocus("selName"); });
      st.addEventListener("change", function () { snapshot(); floor().meta[r.key] = { name: r.name, type: this.value }; renderAll(); });
    } else if (fx) {
      selPropsEl.style.display = "";
      selPropsEl.innerHTML = '<h3 data-en="Selected item" data-ar="العنصر المحدد">Selected item</h3><p class="planner-selarea">' + esc(fixtureLabel(fx.type)) + '</p><div class="planner-selbtns"><button class="btn-tiny" id="rotBtn" data-en="Rotate" data-ar="تدوير">Rotate</button><button class="btn-tiny danger" id="delBtn" data-en="Delete" data-ar="حذف">Delete</button></div>';
      applyLangTo(selPropsEl);
      $("rotBtn").addEventListener("click", function () { snapshot(); fx.rot = ((fx.rot || 0) + 45) % 360; renderAll(); });
      $("delBtn").addEventListener("click", deleteSelected);
    } else if (op) {
      selPropsEl.style.display = "";
      var flipBtn = op.type === "door" ? '<button class="btn-tiny" id="flipBtn" data-en="Flip swing" data-ar="عكس الفتح">Flip swing</button>' : "";
      selPropsEl.innerHTML = '<h3 data-en="Selected item" data-ar="العنصر المحدد">Selected item</h3><p class="planner-selarea">' + (op.type === "door" ? "Door" : "Window") + '</p><div class="planner-selbtns">' + flipBtn + '<button class="btn-tiny danger" id="delBtn" data-en="Delete" data-ar="حذف">Delete</button></div>';
      applyLangTo(selPropsEl);
      if (op.type === "door") $("flipBtn").addEventListener("click", function () { snapshot(); op.flip = (op.flip || 1) * -1; renderAll(); });
      $("delBtn").addEventListener("click", deleteSelected);
    } else {
      selPropsEl.style.display = "none";
    }
  }
  function renderAllKeepFocus(id) { renderAll(); var el = $(id); if (el) { el.focus(); var v = el.value; el.value = ""; el.value = v; } }

  var HINTS = {
    wall: { en: "Click each corner to draw walls. Enclosed walls become a room; a wall inside a room splits it. Straight-line snapping keeps angles perfect. Double-click or Esc to stop.", ar: "انقر كل زاوية لرسم الجدران. الجدران المغلقة تصبح غرفة، والجدار داخل الغرفة يقسمها. التوجيه المستقيم يحافظ على الزوايا. انقر مزدوجاً أو Esc للإيقاف." },
    select: { en: "Click a room to name it; drag a wall or corner to move it. Click an open (leftover) wall piece to select just that piece, then press Delete. Click a door/window/item to edit it.", ar: "انقر غرفة لتسميتها، اسحب جداراً أو زاوية لتحريكه. انقر على جزء جدار مفتوح (زائد) لتحديده وحده ثم اضغط Delete. انقر باباً/نافذة/عنصراً لتعديله." },
    door: { en: "Click on a wall to place a door. Click an existing door to flip its swing.", ar: "انقر على جدار لوضع باب. انقر على باب موجود لعكس فتحه." },
    window: { en: "Click on a wall to place a window.", ar: "انقر على جدار لوضع نافذة." },
    fixture: { en: "Click to place the chosen item; it snaps to a nearby wall. Switch to Select to move, rotate, copy or delete it.", ar: "انقر لوضع العنصر المختار؛ يلتصق بالجدار القريب. انتقل إلى تحديد لتحريكه أو تدويره أو نسخه أو حذفه." },
    scale: { en: "Set the real scale: click two points a known distance apart, then type that distance in metres.", ar: "ضبط المقياس الحقيقي: انقر نقطتين تعرف المسافة بينهما ثم اكتب المسافة بالأمتار." }
  };
  function renderHint() { hintEl.textContent = (HINTS[state.tool] || {})[curLang()] || ""; }

  // --- Placement ---------------------------------------------------------------
  function addWallPoint(pt) { if (!state.draft) { state.draft = { points: [pt] }; return; } var prev = state.draft.points[state.draft.points.length - 1]; if (dist(pt, prev) < 2) return; snapshot(); floor().segments.push({ a: { x: prev.x, y: prev.y }, b: { x: pt.x, y: pt.y } }); state.draft.points.push(pt); }
  function endWall() { state.draft = null; }

  function nearestSegIdx(pt, maxD) { var bi = -1, bd = maxD; floor().segments.forEach(function (s, i) { var d = dist(pt, nearestOnSeg(pt, s.a, s.b)); if (d < bd) { bd = d; bi = i; } }); return bi; }
  function placeOpening(raw, type) { var idx = nearestSegIdx(raw, 22); if (idx < 0) return false; var s = floor().segments[idx], np = nearestOnSeg(raw, s.a, s.b); snapshot(); floor().openings.push({ id: nextId(), type: type, x: np.x, y: np.y, a: np.angle, flip: 1 }); return true; }
  function placeFixture(pt) { var def = FIXTURES[state.fixtureType]; snapshot(); var fx = { id: nextId(), type: state.fixtureType, x: pt.x, y: pt.y, rot: 0, w: def.w, h: def.h }; snapFixtureToWall(fx); floor().fixtures.push(fx); state.selFixtureId = fx.id; }

  // --- Hit testing -------------------------------------------------------------
  function fixtureHit(raw) { var arr = floor().fixtures; for (var i = arr.length - 1; i >= 0; i--) { var fx = arr[i], p = rot(raw.x, raw.y, fx.x, fx.y, -(fx.rot || 0)); if (Math.abs(p.x - fx.x) <= fx.w / 2 + 3 && Math.abs(p.y - fx.y) <= fx.h / 2 + 3) return fx; } return null; }
  function openingHit(raw) { var arr = floor().openings; for (var i = arr.length - 1; i >= 0; i--) if (dist(raw, arr[i]) < 16) return arr[i]; return null; }
  function vertexHit(raw) { var best = null, bd = SNAP; vertices().forEach(function (v) { var d = dist(raw, v); if (d < bd) { bd = d; best = v; } }); return best; }

  // --- Pointer interaction -----------------------------------------------------
  function onDown(evt) {
    var raw = svgPoint(evt);
    if (state.tool !== "select") return;
    clearSel();
    var lab = labelAt(raw);
    if (lab) { state.drag = { kind: "label", key: lab.key, bx: lab.bx, by: lab.by, taken: false }; return; }
    var fx = fixtureHit(raw);
    if (fx) { state.selFixtureId = fx.id; state.drag = { kind: "fixture", id: fx.id, taken: false }; renderAll(); return; }
    var op = openingHit(raw);
    if (op) { state.selOpeningId = op.id; state.drag = { kind: "opening", id: op.id, taken: false }; renderAll(); return; }
    var v = vertexHit(raw);
    if (v) { state.drag = { kind: "vertex", from: { x: v.x, y: v.y }, taken: false }; renderAll(); return; }
    var piece = wallPieceAt(raw, 9, lastRooms);
    if (piece) {
      if (piece.open) {
        // An open (non-enclosing) wall piece: select just this piece so it can
        // be deleted with Delete, without touching the rest of the wall.
        state.selPiece = piece; renderAll(); return;
      }
      // A wall that borders a room: select the whole wall and allow moving it.
      state.selSegment = piece.parent; state.drag = { kind: "segment", idx: piece.parent, last: gridSnap(raw), taken: false }; renderAll(); return;
    }
    for (var i = lastRooms.length - 1; i >= 0; i--) if (pip(raw, lastRooms[i].points)) { state.selRoomKey = lastRooms[i].key; break; }
    renderAll();
  }

  function onMove(evt) {
    if (state.tool !== "select") { state.hover = drawPoint(svgPoint(evt)); renderAll(); return; }
    if (!state.drag) return;
    var raw = svgPoint(evt), d = state.drag;
    if (!d.taken) { snapshot(); d.taken = true; }
    if (d.kind === "label") { floor().labelOffsets[d.key] = { dx: raw.x - d.bx, dy: raw.y - d.by }; }
    else if (d.kind === "fixture") { var fx = selectedFixture(); if (fx) { var g = gridSnap(raw); fx.x = g.x; fx.y = g.y; snapFixtureToWall(fx); } }
    else if (d.kind === "opening") { var op = selectedOpening(); var idx = nearestSegIdx(raw, 40); if (op && idx >= 0) { var s = floor().segments[idx], np = nearestOnSeg(raw, s.a, s.b); op.x = np.x; op.y = np.y; op.a = np.angle; } }
    else if (d.kind === "vertex") { var to = snapVertex(raw) || gridSnap(raw); moveVertex(d.from, to); d.from = { x: to.x, y: to.y }; }
    else if (d.kind === "segment") { var g2 = gridSnap(raw), dx = g2.x - d.last.x, dy = g2.y - d.last.y, seg = floor().segments[d.idx]; if (seg) { seg.a.x += dx; seg.a.y += dy; seg.b.x += dx; seg.b.y += dy; } d.last = g2; }
    renderAll();
  }
  function onUp() { state.drag = null; }

  function moveVertex(from, to) { floor().segments.forEach(function (s) { if (Math.abs(s.a.x - from.x) < 0.5 && Math.abs(s.a.y - from.y) < 0.5) { s.a.x = to.x; s.a.y = to.y; } if (Math.abs(s.b.x - from.x) < 0.5 && Math.abs(s.b.y - from.y) < 0.5) { s.b.x = to.x; s.b.y = to.y; } }); }

  function onClick(evt) {
    var raw = svgPoint(evt), pt = drawPoint(raw);
    if (state.tool === "wall") { addWallPoint(pt); renderAll(); }
    else if (state.tool === "door" || state.tool === "window") {
      var existing = state.tool === "door" ? openingHit(raw) : null;
      if (existing && existing.type === "door") { snapshot(); existing.flip = (existing.flip || 1) * -1; }
      else if (!placeOpening(raw, state.tool)) flash(msgFor("noWall"), true);
      renderAll();
    } else if (state.tool === "fixture") { placeFixture(gridSnap(raw)); renderAll(); }
    else if (state.tool === "scale") { state.scalePts.push(pt); renderAll(); if (state.scalePts.length >= 2) finishScale(); }
  }
  function onDbl() { if (state.tool === "wall") { endWall(); renderAll(); } }

  function deleteSelected() {
    var f = floor();
    if (state.selPiece) {
      // Remove only the selected open piece: split its parent wall and keep the rest.
      snapshot();
      var idx = state.selPiece.parent, seg = f.segments[idx];
      if (seg) {
        var others = []; for (var j = 0; j < f.segments.length; j++) if (j !== idx) others.push(f.segments[j]);
        var pieces = segPieces(seg, others);
        var selMid = { x: (state.selPiece.a.x + state.selPiece.b.x) / 2, y: (state.selPiece.a.y + state.selPiece.b.y) / 2 };
        var keep = pieces.filter(function (p) { return dist({ x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 }, selMid) > 1; });
        f.segments.splice(idx, 1);
        keep.forEach(function (p) { f.segments.push({ a: { x: p.a.x, y: p.a.y }, b: { x: p.b.x, y: p.b.y } }); });
      }
      state.selPiece = null;
    }
    else if (state.selFixtureId) { snapshot(); f.fixtures = f.fixtures.filter(function (x) { return x.id !== state.selFixtureId; }); state.selFixtureId = null; }
    else if (state.selOpeningId) { snapshot(); f.openings = f.openings.filter(function (x) { return x.id !== state.selOpeningId; }); state.selOpeningId = null; }
    else if (state.selSegment >= 0) { snapshot(); f.segments.splice(state.selSegment, 1); state.selSegment = -1; }
    else if (state.draft) { state.draft = null; }
    renderAll();
  }

  // --- Copy / paste ------------------------------------------------------------
  function copySelection() {
    var r = selectedRoom(), fx = selectedFixture();
    if (r) {
      var segs = []; for (var i = 0; i < r.points.length; i++) segs.push({ a: { x: r.points[i].x, y: r.points[i].y }, b: { x: r.points[(i + 1) % r.points.length].x, y: r.points[(i + 1) % r.points.length].y } });
      var b = bbox(r.points);
      var ops = floor().openings.filter(function (o) { return o.x >= b.minX && o.x <= b.maxX && o.y >= b.minY && o.y <= b.maxY; }).map(function (o) { return JSON.parse(JSON.stringify(o)); });
      var fxs = floor().fixtures.filter(function (x) { return pip({ x: x.x, y: x.y }, r.points); }).map(function (x) { return JSON.parse(JSON.stringify(x)); });
      state.clipboard = { type: "room", segs: segs, openings: ops, fixtures: fxs };
      flash(msgFor("copied"));
    } else if (fx) { state.clipboard = { type: "fixture", fixture: JSON.parse(JSON.stringify(fx)) }; flash(msgFor("copied")); }
    else flash(msgFor("nothingSel"), true);
  }
  function paste() {
    if (!state.clipboard) return;
    var off = GRID * 2, cb = state.clipboard;
    snapshot();
    if (cb.type === "fixture") { var nf = JSON.parse(JSON.stringify(cb.fixture)); nf.id = nextId(); nf.x += off; nf.y += off; floor().fixtures.push(nf); state.selFixtureId = nf.id; }
    else if (cb.type === "room") {
      cb.segs.forEach(function (s) { floor().segments.push({ a: { x: s.a.x + off, y: s.a.y + off }, b: { x: s.b.x + off, y: s.b.y + off } }); });
      cb.openings.forEach(function (o) { var n = JSON.parse(JSON.stringify(o)); n.id = nextId(); n.x += off; n.y += off; floor().openings.push(n); });
      cb.fixtures.forEach(function (x) { var n = JSON.parse(JSON.stringify(x)); n.id = nextId(); n.x += off; n.y += off; floor().fixtures.push(n); });
    }
    renderAll(); flash(msgFor("pasted"));
  }

  // --- Export ------------------------------------------------------------------
  function exportSVG(f) {
    var rooms = computeRooms(f.segments).map(function (r) { var key = roomKey(r.points), m = f.meta[key] || {}; return { points: r.points, area: r.area, name: m.name || "", type: m.type || "room", centroid: centroid(r.points) }; });
    var pts = []; f.segments.forEach(function (s) { pts.push(s.a); pts.push(s.b); }); f.openings.forEach(function (o) { pts.push({ x: o.x, y: o.y }); }); f.fixtures.forEach(function (x) { pts.push({ x: x.x - x.w / 2, y: x.y - x.h / 2 }); pts.push({ x: x.x + x.w / 2, y: x.y + x.h / 2 }); });
    if (!pts.length) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">' + txt(200, 100, "(empty floor)", 14, "#94a3b8") + "</svg>";
    var b = bbox(pts), pad = 46, vx = b.minX - pad, vy = b.minY - pad, vw = (b.maxX - b.minX) + pad * 2, vh = (b.maxY - b.minY) + pad * 2, m = state.showMeasure;
    var body = rooms.map(function (r) { return '<polygon points="' + ptsAttr(r.points) + '" fill="' + typeInfo(r.type).fill + '" stroke="none"/>'; }).join("");
    f.fixtures.forEach(function (fx) { body += fixtureMarkup(fx, false); });
    f.segments.forEach(function (s) { body += L(s.a.x, s.a.y, s.b.x, s.b.y, WALL_COLOR, WALL_W, ' stroke-linecap="round"'); });
    f.openings.forEach(function (op) { body += openingMarkup(op, false); });
    // Labels honour the same drag offsets the user set on screen.
    rooms.forEach(function (r) {
      var np = lblPos(f, "rn:" + r.key, r.centroid.x, r.centroid.y - 2);
      body += txt(np.x, np.y, r.name || typeInfo(r.type).label, 13, "#0b1f33", "middle", "bold");
      if (m) { var ap = lblPos(f, "ra:" + r.key, r.centroid.x, r.centroid.y + 15); body += txt(ap.x, ap.y, areaLabel(r.area), 11, "#475569"); }
    });
    if (m) f.segments.forEach(function (s) { var Ln = dist(s.a, s.b); if (Ln <= 26) return; var mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2, nx = -(s.b.y - s.a.y) / Ln, ny = (s.b.x - s.a.x) / Ln; var lp = lblPos(f, "wl:" + Math.round(mx) + "_" + Math.round(my), mx + nx * 11, my + ny * 11 + 4); body += txt(lp.x, lp.y, mLabel(Ln), 10.5, "#334155"); });
    var barY = b.maxY + pad * 0.6;
    body += L(b.minX, barY, b.minX + PPM, barY, "#0b1f33", 2) + txt(b.minX + PPM / 2, barY + 14, state.units === "ft" ? FT.toFixed(2) + " ft" : "1 m", 10, "#475569");
    if (state.showNorth) body += northMarkup(b.maxX + pad * 0.5, b.minY - pad * 0.4, 18);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f1(vx) + " " + f1(vy) + " " + f1(vw) + " " + f1(vh) + '"><rect x="' + f1(vx) + '" y="' + f1(vy) + '" width="' + f1(vw) + '" height="' + f1(vh) + '" fill="#ffffff"/>' + body + "</svg>";
  }
  function payload() {
    return {
      project: { projectName: $("projectName").value.trim(), clientName: $("clientName").value.trim(), clientEmail: $("clientEmail").value.trim(), notes: $("notes").value.trim() },
      floors: state.floors.map(function (f) {
        var rooms = getRooms(f).sort(function (a, b) { return b.area - a.area; }).map(function (r) { return { name: r.name || typeInfo(r.type).label, area: areaLabel(r.area) }; });
        return { name: f.name, areaLabel: areaLabel(floorArea(f)), rooms: rooms, svg: exportSVG(f) };
      })
    };
  }
  function hasAnything() { return state.floors.some(function (f) { return f.segments.length || f.fixtures.length; }); }
  function exportPdf() { if (!hasAnything()) { flash(msgFor("empty"), true); return; } flash(msgFor("preparing")); fetch("/api/plan/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) }).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (blob) { var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "scope-project-plan.pdf"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); flash(msgFor("downloaded")); }).catch(function () { flash(msgFor("failed"), true); }); }
  function exportPng() {
    if (!hasAnything()) { flash(msgFor("empty"), true); return; }
    var svgStr = exportSVG(floor());
    var m = svgStr.match(/viewBox="([^"]+)"/); if (!m) { flash(msgFor("failed"), true); return; }
    var vb = m[1].split(" "), vw = parseFloat(vb[2]), vh = parseFloat(vb[3]), sc = 2;
    var sized = svgStr.replace("<svg ", '<svg width="' + vw + '" height="' + vh + '" ');
    var url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml;charset=utf-8" }));
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement("canvas"); cv.width = vw * sc; cv.height = vh * sc;
      var ctx = cv.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      cv.toBlob(function (blob) { var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "scope-plan.png"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); flash(msgFor("pngDone")); });
    };
    img.onerror = function () { URL.revokeObjectURL(url); flash(msgFor("failed"), true); };
    img.src = url;
  }
  function emailPlan() { if (!hasAnything()) { flash(msgFor("empty"), true); return; } flash(msgFor("sending")); fetch("/api/plan/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (res) { flash(res.ok && res.d.success ? msgFor("sent") : (res.d.error || msgFor("failed")), !(res.ok && res.d.success)); }).catch(function () { flash(msgFor("failed"), true); }); }

  // --- i18n --------------------------------------------------------------------
  function curLang() { try { return localStorage.getItem("scopeLanguage") === "ar" ? "ar" : "en"; } catch (e) { return "en"; } }
  var MSG = {
    empty: { en: "Draw some walls first.", ar: "ارسم بعض الجدران أولاً." },
    preparing: { en: "Preparing your PDF…", ar: "جارٍ تجهيز ملف PDF…" }, downloaded: { en: "PDF downloaded.", ar: "تم تحميل ملف PDF." },
    sending: { en: "Sending to Scope…", ar: "جارٍ الإرسال…" }, sent: { en: "Sent! Our team will get your plan.", ar: "تم الإرسال!" },
    failed: { en: "Something went wrong. Please try again.", ar: "حدث خطأ ما." }, noWall: { en: "Click closer to a wall.", ar: "انقر أقرب إلى الجدار." },
    copied: { en: "Copied. Press Paste (or Ctrl+V).", ar: "تم النسخ. اضغط لصق." }, pasted: { en: "Pasted.", ar: "تم اللصق." },
    nothingSel: { en: "Select a room or an item first.", ar: "اختر غرفة أو عنصراً أولاً." },
    scaleSet: { en: "Scale set — measurements updated.", ar: "تم ضبط المقياس — تم تحديث القياسات." },
    pngDone: { en: "PNG image downloaded.", ar: "تم تحميل صورة PNG." }
  };
  function msgFor(k) { return (MSG[k] || {})[curLang()] || MSG[k].en; }
  function flash(t, e) { msgEl.textContent = t; msgEl.className = "planner-msg" + (e ? " error" : " ok"); }
  function applyLangTo(root) { var lang = curLang(); root.querySelectorAll("[data-en][data-ar]").forEach(function (el) { el.textContent = lang === "ar" ? el.dataset.ar : el.dataset.en; }); }

  // --- North arrow -------------------------------------------------------------
  function northMarkup(cx, cy, r) {
    return "<g>" + C(cx, cy, r, "#ffffff", "#0b1f33", 1.5) +
      '<path d="M' + f1(cx) + " " + f1(cy - r + 3) + " L" + f1(cx - r * 0.42) + " " + f1(cy + r * 0.5) + " L" + f1(cx) + " " + f1(cy + r * 0.12) + " L" + f1(cx + r * 0.42) + " " + f1(cy + r * 0.5) + ' Z" fill="#0b1f33"/>' +
      txt(cx, cy + r - 3, "N", 9, "#0b1f33", "middle", "bold") + "</g>";
  }

  // --- Templates ---------------------------------------------------------------
  function seg(x1, y1, x2, y2) { return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 } }; }
  function rectWalls(x, y, w, h) { return [seg(x, y, x + w, y), seg(x + w, y, x + w, y + h), seg(x + w, y + h, x, y + h), seg(x, y + h, x, y)]; }
  var TEMPLATES = {
    studio: function () { return rectWalls(440, 260, 320, 300); },
    apt1: function () { var s = rectWalls(360, 220, 480, 380); s.push(seg(600, 220, 600, 600)); s.push(seg(600, 420, 840, 420)); return s; },
    villa: function () { var s = rectWalls(300, 180, 600, 460); s.push(seg(600, 180, 600, 640)); s.push(seg(300, 420, 600, 420)); s.push(seg(600, 340, 900, 340)); return s; },
    office: function () { var s = rectWalls(340, 220, 520, 380); s.push(seg(500, 220, 500, 600)); s.push(seg(680, 220, 680, 600)); return s; }
  };
  function loadTemplate(key) {
    if (!key || key === "blank") return;
    var fn = TEMPLATES[key]; if (!fn) return;
    if (floor().segments.length && !window.confirm(curLang() === "ar" ? "استبدال الطابق الحالي بالقالب؟" : "Replace the current floor with this template?")) return;
    snapshot();
    var f = floor(); f.segments = fn(); f.meta = {}; f.labelOffsets = {}; f.openings = []; f.fixtures = [];
    clearSel(); state.draft = null; renderAll();
  }

  // --- Simple isometric 3D preview --------------------------------------------
  function build3D(f) {
    var rooms = getRooms(f), H3 = 2.7 * PPM, proj = [];
    function iso(x, y, z) { var a = 0.5236; return { x: (x - y) * Math.cos(a), y: (x + y) * Math.sin(a) - z }; }
    function P(x, y, z) { var p = iso(x, y, z); proj.push(p); return p; }
    var floorPolys = rooms.map(function (r) { return r.points.map(function (p) { return P(p.x, p.y, 0); }); });
    var wallQuads = [];
    f.segments.forEach(function (s) {
      var a0 = P(s.a.x, s.a.y, 0), b0 = P(s.b.x, s.b.y, 0), b1 = P(s.b.x, s.b.y, H3), a1 = P(s.a.x, s.a.y, H3);
      wallQuads.push({ pts: [a0, b0, b1, a1], depth: (s.a.x + s.a.y + s.b.x + s.b.y) / 2 });
    });
    if (!proj.length) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">' + txt(200, 100, "Draw walls first", 14, "#94a3b8") + "</svg>";
    var b = bbox(proj), pad = 40, vw = (b.maxX - b.minX) + pad * 2, vh = (b.maxY - b.minY) + pad * 2, ox = pad - b.minX, oy = pad - b.minY;
    function tp(p) { return f1(p.x + ox) + "," + f1(p.y + oy); }
    var body = "";
    floorPolys.forEach(function (poly) { body += '<polygon points="' + poly.map(tp).join(" ") + '" fill="#e8eef5" stroke="#cbd5e1" stroke-width="1"/>'; });
    wallQuads.sort(function (a, b2) { return a.depth - b2.depth; });
    wallQuads.forEach(function (q) { body += '<polygon points="' + q.pts.map(tp).join(" ") + '" fill="#c9d3df" stroke="#0b1f33" stroke-width="1" stroke-linejoin="round"/>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f1(vw) + " " + f1(vh) + '"><rect width="' + f1(vw) + '" height="' + f1(vh) + '" fill="#ffffff"/>' + body + "</svg>";
  }
  function open3D() { var modal = $("plan3dModal"), cont = $("plan3d"); if (!modal || !cont) return; cont.innerHTML = build3D(floor()); modal.style.display = "flex"; }
  function close3D() { var modal = $("plan3dModal"); if (modal) modal.style.display = "none"; }

  // --- Setup -------------------------------------------------------------------
  function fillFixtureSelect() {
    var ar = curLang() === "ar", arch = "", fur = "";
    Object.keys(FIXTURES).forEach(function (k) { var o = '<option value="' + k + '">' + esc(fixtureLabel(k)) + "</option>"; if (FIXTURES[k].cat === "arch") arch += o; else fur += o; });
    fixtureSel.innerHTML = '<optgroup label="' + (ar ? "المبنى" : "Building") + '">' + arch + '</optgroup><optgroup label="' + (ar ? "الأثاث" : "Furniture") + '">' + fur + "</optgroup>";
    fixtureSel.value = state.fixtureType;
  }
  function setTool(tool) {
    state.tool = tool; if (tool !== "wall") state.draft = null;
    document.querySelectorAll(".planner-tool").forEach(function (b) { b.classList.toggle("active", b.dataset.tool === tool); });
    if (fixtureSel) fixtureSel.style.display = tool === "fixture" ? "" : "none";
    svg.style.cursor = tool === "select" ? "default" : "crosshair";
    renderAll();
  }

  function init() {
    svg = $("planCanvas"); hintEl = $("planHint"); totalsEl = $("planTotals"); msgEl = $("planMsg");
    floorTabsEl = $("floorTabs"); selPropsEl = $("selProps"); measureToggle = $("measureToggle"); orthoToggle = $("orthoToggle"); fixtureSel = $("fixtureType");

    fillFixtureSelect();
    document.querySelectorAll(".planner-tool").forEach(function (b) { b.addEventListener("click", function () { setTool(b.dataset.tool); }); });
    fixtureSel.addEventListener("change", function () { state.fixtureType = fixtureSel.value; setTool("fixture"); });
    measureToggle.addEventListener("change", function () { state.showMeasure = measureToggle.checked; renderAll(); });
    orthoToggle.addEventListener("change", function () { state.ortho = orthoToggle.checked; });
    $("undoBtn").addEventListener("click", undo);
    var rb = $("redoBtn"); if (rb) rb.addEventListener("click", redo);
    var ssb = $("setScaleBtn"); if (ssb) ssb.addEventListener("click", startScale);
    $("deleteBtn").addEventListener("click", deleteSelected);
    $("copyBtn").addEventListener("click", copySelection);
    $("pasteBtn").addEventListener("click", paste);
    $("clearBtn").addEventListener("click", function () { snapshot(); state.floors[state.current] = newFloor(floor().name); state.draft = null; clearSel(); renderAll(); });
    $("exportPdfBtn").addEventListener("click", exportPdf);
    var epng = $("exportPngBtn"); if (epng) epng.addEventListener("click", exportPng);
    $("emailPlanBtn").addEventListener("click", emailPlan);
    var np = $("newPlanBtn"); if (np) np.addEventListener("click", newPlan);
    var tmpl = $("templateSelect"); if (tmpl) tmpl.addEventListener("change", function () { loadTemplate(tmpl.value); tmpl.value = "blank"; });
    var un = $("unitsToggle"); if (un) un.addEventListener("change", function () { state.units = un.checked ? "ft" : "m"; renderAll(); saveProject(); });
    var nb = $("northToggle"); if (nb) nb.addEventListener("change", function () { state.showNorth = nb.checked; renderAll(); saveProject(); });
    var v3 = $("view3dBtn"); if (v3) v3.addEventListener("click", open3D);
    var c3 = $("close3dBtn"); if (c3) c3.addEventListener("click", close3D);
    var modal3 = $("plan3dModal"); if (modal3) modal3.addEventListener("click", function (e) { if (e.target === modal3) close3D(); });
    // Autosave when the project details change.
    ["projectName", "clientName", "clientEmail", "notes"].forEach(function (id) { var e = $(id); if (e) e.addEventListener("input", scheduleSave); });

    svg.addEventListener("mousedown", onDown);
    svg.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    svg.addEventListener("click", function (e) { if (!(state.drag && state.drag.taken)) onClick(e); });
    svg.addEventListener("dblclick", onDbl);
    svg.addEventListener("mouseleave", function () { state.hover = null; renderAll(); });

    // Touch support (mobile / tablet drawing).
    function touchPos(e) { var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]); return t ? { clientX: t.clientX, clientY: t.clientY } : null; }
    var touchMoved = false, touchStart = null, lastTap = 0;
    svg.addEventListener("touchstart", function (e) { var p = touchPos(e); if (!p) return; e.preventDefault(); touchMoved = false; touchStart = p; onDown(p); }, { passive: false });
    svg.addEventListener("touchmove", function (e) { var p = touchPos(e); if (!p) return; e.preventDefault(); if (touchStart && Math.abs(p.clientX - touchStart.clientX) + Math.abs(p.clientY - touchStart.clientY) > 6) touchMoved = true; onMove(p); }, { passive: false });
    svg.addEventListener("touchend", function (e) {
      e.preventDefault(); onUp();
      if (!(state.drag && state.drag.taken) && !touchMoved && touchStart) {
        var now = Date.now();
        if (now - lastTap < 300) onDbl({ clientX: touchStart.clientX, clientY: touchStart.clientY });
        else onClick(touchStart);
        lastTap = now;
      }
      touchStart = null;
    }, { passive: false });

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === "c" || e.key === "C")) { e.preventDefault(); copySelection(); }
      else if (ctrl && (e.key === "v" || e.key === "V")) { e.preventDefault(); paste(); }
      else if (ctrl && (e.key === "z" || e.key === "Z") && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (ctrl && ((e.key === "y" || e.key === "Y") || (e.shiftKey && (e.key === "z" || e.key === "Z")))) { e.preventDefault(); redo(); }
      else if (e.key === "Escape") { state.draft = null; state.scalePts = []; if (state.tool === "scale") setTool("select"); clearSel(); renderAll(); }
      else if (e.key === "Delete" || e.key === "Backspace") { deleteSelected(); }
      else if ((e.key === "r" || e.key === "R") && state.selFixtureId) { var fx = selectedFixture(); if (fx) { snapshot(); fx.rot = ((fx.rot || 0) + 45) % 360; renderAll(); } }
      else if (e.key === "Enter" && state.draft) { endWall(); renderAll(); }
    });

    var languageBtn = document.getElementById("languageBtn");
    if (languageBtn) languageBtn.addEventListener("click", function () { setTimeout(function () { fillFixtureSelect(); renderHint(); renderTotals(); renderSelection(); }, 0); });

    loadProject();
    // sync toggle controls to loaded state
    if (un) un.checked = state.units === "ft";
    if (nb) nb.checked = state.showNorth;
    setTool("wall"); renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
