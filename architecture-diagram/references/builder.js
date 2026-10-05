// architecture-diagram builder. Paste this file into a use_figma call AFTER a
// `const SPEC = {...}` and end the script with `return await buildDiagram(SPEC);`.
// It removes any top-level node on the page that already has SPEC.name, so a
// rebuild is the way to change the diagram. See ../SKILL.md for the SPEC format.
async function buildDiagram(SPEC) {
  const page = (SPEC.page && figma.root.children.find(p => p.name === SPEC.page)) || figma.root.children[0];
  await figma.setCurrentPageAsync(page);

  // ---- fonts: the file's mono face when it has one, Inter otherwise
  const avail = await figma.listAvailableFontsAsync();
  const hasFont = (fam, style) => avail.some(f => f.fontName.family === fam && f.fontName.style === style);
  const FAMILY = SPEC.font || (hasFont('Geist Mono', 'Regular') ? 'Geist Mono' : 'Inter');
  const STYLE = {Regular: 'Regular', Medium: 'Medium', SemiBold: hasFont(FAMILY, 'SemiBold') ? 'SemiBold' : 'Semi Bold'};
  for (const k in STYLE) await figma.loadFontAsync({family: FAMILY, style: STYLE[k]});

  // ---- colours: the file's variables by name when they exist, these values otherwise
  const PALETTE = {
    bg: ['bg/background', [10, 10, 10]], card: ['bg/card', [26, 26, 26]], lid: ['bg/muted', [38, 38, 38]],
    zone: ['bg/sidebar', [23, 23, 23]], fg: ['text/foreground', [250, 250, 250]], muted: ['text/muted', [161, 161, 161]],
    subtle: ['text/subtle', [115, 115, 115]], border: ['border/default', [56, 56, 56]], dashed: ['border/input', [82, 82, 82]],
    warn: ['status/warn', [245, 177, 76]], warnText: ['status/warn-strong', [247, 191, 109]],
  };
  const colorVars = await figma.variables.getLocalVariablesAsync('COLOR');
  const C = {};
  for (const k in PALETTE) {
    const def = (SPEC.palette && SPEC.palette[k]) || PALETTE[k];
    const v = colorVars.find(x => x.name === def[0]);
    C[k] = v
      ? figma.variables.setBoundVariableForPaint({type: 'SOLID', color: {r: 0.5, g: 0.5, b: 0.5}}, 'color', v)
      : {type: 'SOLID', color: {r: def[1][0] / 255, g: def[1][1] / 255, b: def[1][2] / 255}};
  }

  // ---- the grid
  const G = Object.assign({NW: 236, NH: 76, ZW: 280, ZGAP: 96, MARGIN: 120, PITCH: 112, ZHEAD: 64, TOP: 330}, SPEC.grid || {});
  const NW = G.NW, NH = G.NH, ZW = G.ZW, ZGAP = G.ZGAP;
  const N = {};
  SPEC.nodes.forEach(n => { if (N[n.id]) throw new Error('two nodes share the id ' + n.id); N[n.id] = n; });
  const zoneCols = (z) => z.cols || [z.col, z.col];
  const maxCol = Math.max.apply(null, SPEC.nodes.map(n => n.col).concat((SPEC.zones || []).map(z => zoneCols(z)[1])));
  const maxRow = Math.max.apply(null, SPEC.nodes.map(n => n.row).concat((SPEC.zones || []).map(z => z.rows[1])));
  const BW = G.MARGIN * 2 + maxCol * ZW + (maxCol - 1) * ZGAP;
  const zoneX = (c) => G.MARGIN + (c - 1) * (ZW + ZGAP);
  const nodeX = (c) => zoneX(c) + (ZW - NW) / 2;
  const rowY = (r) => G.TOP + G.ZHEAD + (r - 1) * G.PITCH;
  const gapMid = (c) => zoneX(c) + ZW + ZGAP / 2;
  const R = (n, dy) => [nodeX(n.col) + NW, rowY(n.row) + (dy === undefined ? NH / 2 : dy)];
  const L = (n, dy) => [nodeX(n.col), rowY(n.row) + (dy === undefined ? NH / 2 : dy)];
  const Tp = (n, dx) => [nodeX(n.col) + (dx === undefined ? NW / 2 : dx), rowY(n.row)];
  const B = (n, dx) => [nodeX(n.col) + (dx === undefined ? NW / 2 : dx), rowY(n.row) + NH];
  const ZONE_BOTTOM = rowY(maxRow) + NH + 22;
  const BUS_TOP = G.TOP - 24, BUS_BOTTOM = ZONE_BOTTOM + 34, LOOP_L = G.MARGIN - 40, LOOP_R = BW - G.MARGIN + 40;
  const busY = (v) => v === undefined || v === 'top' ? BUS_TOP : v === 'bottom' ? BUS_BOTTOM
    : typeof v === 'number' ? v : v.aboveRow ? rowY(v.aboveRow) - G.ZHEAD - 24 : rowY(v.belowRow) + NH + 22 + 26;

  // ---- the board
  page.children.filter(n => n.name === SPEC.name).forEach(n => n.remove());
  const board = figma.createFrame();
  board.name = SPEC.name;
  board.fills = [C.bg]; board.clipsContent = true;
  if (SPEC.position) { board.x = SPEC.position.x; board.y = SPEC.position.y; }
  else {
    const others = page.children.filter(n => n.id !== board.id);
    board.x = 0; board.y = others.length ? Math.max.apply(null, others.map(n => n.y + n.height)) + 240 : 0;
  }
  board.resize(BW, 1000);
  const warnings = [];

  function T(chars, o) {
    o = o || {};
    const t = figma.createText();
    t.fontName = {family: FAMILY, style: STYLE[o.style || 'Regular']};
    t.fontSize = o.size || 12;
    t.characters = chars;
    t.fills = [C[o.color || 'muted']];
    if (o.lh) t.lineHeight = {unit: 'PIXELS', value: o.lh};
    if (o.ls) t.letterSpacing = {unit: 'PERCENT', value: o.ls};
    if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); }
    t.name = chars.slice(0, 40);
    return t;
  }
  function AL(name, dir, o) {
    o = o || {};
    const f = figma.createFrame();
    f.name = name; f.layoutMode = dir;
    f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO';
    f.itemSpacing = o.gap || 0;
    const p = o.pad || [0, 0, 0, 0];
    f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3];
    f.fills = o.fill ? [C[o.fill]] : [];
    if (o.counter) f.counterAxisAlignItems = o.counter;
    return f;
  }
  // A cylinder for stored data: a closed outline (vectorPaths takes M, L, C and Z) and an ellipse for the lid.
  const r2 = (n) => Math.round(n * 100) / 100;
  function cylinderParts(w, h, ry) {
    const k = 0.5523, rx = w / 2;
    const body = figma.createVector();
    body.vectorPaths = [{windingRule: 'NONZERO', data:
      'M 0 ' + ry + ' C 0 ' + r2(ry - ry * k) + ' ' + r2(rx - rx * k) + ' 0 ' + rx + ' 0' +
      ' C ' + r2(rx + rx * k) + ' 0 ' + w + ' ' + r2(ry - ry * k) + ' ' + w + ' ' + ry +
      ' L ' + w + ' ' + (h - ry) +
      ' C ' + w + ' ' + r2(h - ry + ry * k) + ' ' + r2(rx + rx * k) + ' ' + h + ' ' + rx + ' ' + h +
      ' C ' + r2(rx - rx * k) + ' ' + h + ' 0 ' + r2(h - ry + ry * k) + ' 0 ' + (h - ry) + ' Z'}];
    body.fills = [C.card]; body.strokes = [C.border]; body.strokeWeight = 1; body.name = 'cylinder';
    const lid = figma.createEllipse();
    lid.resize(w, ry * 2); lid.fills = [C.lid]; lid.strokes = [C.border]; lid.strokeWeight = 1; lid.name = 'lid';
    return [body, lid];
  }

  // ---- zones (drawn first, behind everything)
  (SPEC.zones || []).forEach(z => {
    const cols = zoneCols(z), top = rowY(z.rows[0]) - G.ZHEAD;
    const f = figma.createFrame();
    f.name = 'Zone/' + z.label;
    f.resize((cols[1] - cols[0] + 1) * ZW + (cols[1] - cols[0]) * ZGAP, rowY(z.rows[1]) + NH + 22 - top);
    f.x = zoneX(cols[0]); f.y = top;
    f.fills = [C.zone]; f.strokes = [C.border]; f.strokeWeight = 1; f.cornerRadius = 12;
    board.appendChild(f);
    const a = T(z.label, {style: 'Medium', size: 11, ls: 8, color: 'fg'}); board.appendChild(a); a.x = f.x + 22; a.y = top + 16;
    if (z.sub) { const b = T(z.sub, {size: 10, color: 'subtle'}); board.appendChild(b); b.x = f.x + 22; b.y = top + 34; }
  });

  // ---- edges: plain vectors with an arrow cap on the last vertex (design files have no connectors)
  async function drawEdge(name, pts, o) {
    const minX = Math.min.apply(null, pts.map(p => p[0])), minY = Math.min.apply(null, pts.map(p => p[1]));
    const v = figma.createVector();
    board.appendChild(v);
    const n = pts.length;
    const vertices = pts.map((p, i) => ({
      x: p[0] - minX, y: p[1] - minY,
      strokeCap: i === n - 1 ? 'ARROW_EQUILATERAL' : (i === 0 && o.both ? 'ARROW_EQUILATERAL' : 'NONE'),
      cornerRadius: (i > 0 && i < n - 1) ? 8 : 0,
    }));
    await v.setVectorNetworkAsync({vertices: vertices, segments: pts.slice(1).map((_, i) => ({start: i, end: i + 1})), regions: []});
    v.x = minX; v.y = minY;   // the vertices are relative to the node, so place it after the network is set
    v.fills = []; v.strokes = [C[o.color === 'warn' ? 'warn' : 'subtle']]; v.strokeWeight = 1.5;
    if (o.dashed) v.dashPattern = [6, 5];
    v.name = 'Edge/' + name;
  }
  function route(e) {
    const a = N[e.from], b = N[e.to];
    if (!a || !b) throw new Error('edge ' + e.from + ' -> ' + e.to + ': unknown node id');
    const fo = e.fromOffset, to = e.toOffset, kind = e.route || 'auto';
    if (kind === 'loop') {
      const s = R(a, fo), t = L(b, to);
      return {pts: [s, [LOOP_R, s[1]], [LOOP_R, BUS_BOTTOM], [LOOP_L, BUS_BOTTOM], [LOOP_L, t[1]], t], at: [BW / 2, BUS_BOTTOM], kind: 'bus'};
    }
    if (kind === 'bus') {
      const s = e.fromSide === 'B' ? B(a, fo) : Tp(a, fo), t = e.toSide === 'B' ? B(b, to) : Tp(b, to), yb = busY(e.busY);
      return {pts: [s, [s[0], yb], [t[0], yb], t], at: [(s[0] + t[0]) / 2, yb], kind: 'bus'};
    }
    if (kind === 'side') {
      const left = e.side === 'L', s = left ? L(a, fo) : R(a, fo), t = left ? L(b, to) : R(b, to);
      const xs = e.sideX !== undefined ? e.sideX : (left ? Math.min(s[0], t[0]) - 42 : Math.max(s[0], t[0]) + 42);
      return {pts: [s, [xs, s[1]], [xs, t[1]], t], at: [xs, (s[1] + t[1]) / 2], kind: 'side'};
    }
    if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
      const down = b.row > a.row, dx = to === undefined ? fo : to;
      const s = down ? B(a, fo) : Tp(a, fo), t = down ? Tp(b, dx) : B(b, dx);
      return {pts: [s, t], at: [s[0], (s[1] + t[1]) / 2], kind: 'vertical'};
    }
    if (Math.abs(a.col - b.col) === 1) {
      const right = b.col > a.col, s = right ? R(a, fo) : L(a, fo), t = right ? L(b, to) : R(b, to);
      const mid = gapMid(Math.min(a.col, b.col)), gx = mid + (e.channel || 0);
      if (s[1] === t[1]) return {pts: [s, t], at: [mid, s[1] + 12], kind: 'straight'};
      return {pts: [s, [gx, s[1]], [gx, t[1]], t], at: [gx, (s[1] + t[1]) / 2], kind: 'elbow'};
    }
    throw new Error('edge ' + e.from + ' -> ' + e.to + ': the nodes are not neighbours; give it route "bus", "side" or "loop"');
  }
  const pending = [];
  for (const e of SPEC.edges) {
    const r = route(e);
    await drawEdge(e.from + ' to ' + e.to, r.pts, e);
    if (e.route === 'loop') {
      for (const id of e.also || []) await drawEdge(e.from + ' to ' + id, [[LOOP_L, L(N[id])[1]], L(N[id])], e);
    }
    if (e.label) pending.push([e, r]);
  }

  // ---- nodes
  SPEC.nodes.forEach(n => {
    const kind = n.kind || 'step';
    const f = figma.createFrame();
    f.name = 'Node/' + n.title;
    f.layoutMode = 'VERTICAL'; f.primaryAxisAlignItems = 'CENTER'; f.counterAxisAlignItems = 'MIN';
    f.itemSpacing = 3; f.paddingLeft = 14; f.paddingRight = 14;
    f.paddingTop = kind === 'store' ? 20 : 8; f.paddingBottom = 8;
    f.resize(NW, NH);
    f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED';
    f.clipsContent = false;
    board.appendChild(f); f.x = nodeX(n.col); f.y = rowY(n.row);
    if (kind === 'store') {
      f.fills = [];
      cylinderParts(NW, NH, 8).forEach(part => { f.appendChild(part); part.layoutPositioning = 'ABSOLUTE'; part.x = 0; part.y = 0; });
    } else if (kind === 'outside') {
      f.fills = [C.zone]; f.strokes = [C.dashed]; f.strokeWeight = 1; f.dashPattern = [5, 4]; f.cornerRadius = 8;
    } else {
      f.fills = [C.card]; f.strokes = [kind === 'person' ? C.warn : C.border]; f.strokeWeight = kind === 'person' ? 1.5 : 1; f.cornerRadius = 8;
    }
    let title;
    if (kind === 'person') {
      const row = AL('title', 'HORIZONTAL', {gap: 7, counter: 'CENTER'});
      const dot = figma.createEllipse(); dot.resize(6, 6); dot.fills = [C.warn]; dot.name = 'dot';
      row.appendChild(dot);
      title = T(n.title, {style: 'Medium', size: 13, lh: 18, color: 'fg'});
      row.appendChild(title); f.appendChild(row);
      if (title.width > NW - 28 - 13) warnings.push('node ' + n.id + ': the title is wider than the node');
    } else {
      title = T(n.title, {style: 'Medium', size: 13, lh: 18, color: 'fg', w: NW - 28});
      f.appendChild(title);
      if (title.height > 18) warnings.push('node ' + n.id + ': the title wraps');
    }
    if (n.sub) {
      const sub = T(n.sub, {size: 11, lh: 15, color: 'muted', w: NW - 28});
      f.appendChild(sub);
      if (sub.height > 15) warnings.push('node ' + n.id + ': the subtitle wraps ("' + n.sub + '")');
    }
    if (n.tag) {
      const t = T(n.tag, {style: 'Medium', size: 9, ls: 6, color: 'subtle'});
      f.appendChild(t); t.layoutPositioning = 'ABSOLUTE';
      t.x = NW - t.width - 10; t.y = kind === 'store' ? 21 : 7;
    }
  });

  // ---- edge labels (on top of the edges)
  pending.forEach(pair => {
    const e = pair[0], r = pair[1], lab = typeof e.label === 'string' ? {text: e.label} : e.label;
    const f = AL('Label/' + lab.text, 'HORIZONTAL', {pad: [1, 5, 1, 5], fill: lab.bg || (r.kind === 'vertical' ? 'zone' : 'bg')});
    f.cornerRadius = 3;
    f.appendChild(T(lab.text, {size: 10, lh: 14, color: lab.color || (e.color === 'warn' ? 'warnText' : 'muted')}));
    board.appendChild(f);
    // beside the line for a vertical edge (or when the label asks for a side), centred on it otherwise
    if (lab.side === 'left') f.x = Math.round(r.at[0] - 9 - f.width);
    else if (lab.side === 'right' || r.kind === 'vertical') f.x = Math.round(r.at[0] + 9);
    else f.x = Math.round(r.at[0] - f.width / 2);
    f.y = Math.round(r.at[1] + (lab.dy || 0) - f.height / 2);
    if ((r.kind === 'elbow' || r.kind === 'straight') && f.width > ZGAP - 4) warnings.push('label "' + lab.text + '" is wider than the gap between zones (' + Math.round(f.width) + ' > ' + (ZGAP - 4) + ')');
  });

  // ---- header and legend
  const header = AL('Header', 'VERTICAL', {gap: 14});
  if (SPEC.eyebrow) header.appendChild(T(SPEC.eyebrow, {style: 'Medium', size: 13, ls: 8, color: 'subtle'}));
  header.appendChild(T(SPEC.title, {style: 'SemiBold', size: 44, color: 'fg'}));
  if (SPEC.subtitle) header.appendChild(T(SPEC.subtitle, {size: 16, lh: 23, color: 'muted', w: Math.min(1500, BW - 2 * G.MARGIN)}));
  board.appendChild(header); header.x = G.MARGIN; header.y = 64;
  if (header.y + header.height > G.TOP - 90) warnings.push('the header runs into the legend; shorten the subtitle or raise grid.TOP');

  const legendText = Object.assign({step: 'a step the system runs', store: 'stored data', person: 'a person decides', outside: 'outside the system',
    solid: 'the main flow', dashed: 'a side flow', tag: 'built, still switched off'}, SPEC.legend || {});
  const legend = AL('Legend', 'HORIZONTAL', {gap: 30, counter: 'CENTER'});
  const item = (sampleNode, text) => {
    const it = AL('item', 'HORIZONTAL', {gap: 8, counter: 'CENTER'});
    it.appendChild(sampleNode); it.appendChild(T(text, {size: 11, color: 'muted'}));
    legend.appendChild(it);
  };
  ['step', 'store', 'person', 'outside'].forEach(kind => {
    if (!SPEC.nodes.some(n => (n.kind || 'step') === kind)) return;
    const s = figma.createFrame(); s.resize(26, 14); s.fills = []; s.clipsContent = false; s.name = 'sample';
    if (kind === 'store') cylinderParts(26, 14, 3).forEach(part => { s.appendChild(part); part.x = 0; part.y = 0; });
    else {
      const q = figma.createRectangle(); q.resize(26, 14); q.cornerRadius = 3;
      q.fills = [kind === 'outside' ? C.zone : C.card];
      q.strokes = [kind === 'person' ? C.warn : (kind === 'outside' ? C.dashed : C.border)];
      q.strokeWeight = kind === 'person' ? 1.5 : 1;
      if (kind === 'outside') q.dashPattern = [4, 3];
      s.appendChild(q);
    }
    item(s, legendText[kind]);
  });
  for (const dashed of [false, true]) {
    if (dashed && !SPEC.edges.some(e => e.dashed)) continue;
    const s = figma.createFrame(); s.resize(30, 14); s.fills = []; s.clipsContent = false; s.name = 'sample';
    const v = figma.createVector(); s.appendChild(v);
    await v.setVectorNetworkAsync({vertices: [{x: 0, y: 0, strokeCap: 'NONE'}, {x: 28, y: 0, strokeCap: 'ARROW_EQUILATERAL'}], segments: [{start: 0, end: 1}], regions: []});
    v.x = 0; v.y = 7; v.fills = []; v.strokes = [C.subtle]; v.strokeWeight = 1.5;
    if (dashed) v.dashPattern = [6, 5];
    item(s, legendText[dashed ? 'dashed' : 'solid']);
  }
  const firstTag = SPEC.nodes.find(n => n.tag);
  if (firstTag) item(T(firstTag.tag, {style: 'Medium', size: 9, ls: 6, color: 'subtle'}), legendText.tag);
  board.appendChild(legend); legend.x = G.MARGIN; legend.y = G.TOP - 90;

  // ---- notes: dashed cards for the corners the zones leave empty
  (SPEC.notes || []).forEach(nt => {
    const span = nt.spanCols || 1, w = span * ZW + (span - 1) * ZGAP;
    const f = AL('Note/' + nt.title, 'VERTICAL', {gap: 10, pad: [18, 20, 18, 20]});
    f.strokes = [C.border]; f.strokeWeight = 1; f.dashPattern = [3, 4]; f.cornerRadius = 12;
    f.appendChild(T(nt.title, {style: 'Medium', size: 11, ls: 8, color: 'fg'}));
    nt.lines.forEach(l => {
      const row = AL('line', 'HORIZONTAL', {gap: 14});
      row.appendChild(T(l[0], {style: 'Medium', size: 11, lh: 16, color: l[2] || 'muted', w: nt.keyWidth || 96}));
      row.appendChild(T(l[1], {size: 11, lh: 16, color: 'muted', w: w - 40 - 14 - (nt.keyWidth || 96)}));
      f.appendChild(row);
    });
    board.appendChild(f); f.x = zoneX(nt.col); f.y = rowY(nt.row) + (nt.dy || 0);
  });

  // ---- a strip along the bottom for what cuts across every zone
  let bottom = SPEC.edges.some(e => e.route === 'loop' || e.busY === 'bottom') ? BUS_BOTTOM + 20 : ZONE_BOTTOM;
  if (SPEC.strip) {
    const W = BW - 2 * G.MARGIN, cells = SPEC.strip.cells, cellW = Math.floor((W - 44 - 150 - cells.length * 36) / cells.length);
    const strip = AL('Strip/' + SPEC.strip.title, 'HORIZONTAL', {gap: 36, pad: [18, 22, 18, 22], fill: 'card', counter: 'CENTER'});
    strip.strokes = [C.border]; strip.strokeWeight = 1; strip.cornerRadius = 12;
    strip.appendChild(T(SPEC.strip.title, {style: 'Medium', size: 11, ls: 8, color: 'fg', w: 150, lh: 16}));
    cells.forEach(c => {
      const cell = AL('cell', 'VERTICAL', {gap: 4});
      cell.appendChild(T(c[0], {style: 'Medium', size: 12, lh: 16, color: 'fg', w: cellW}));
      cell.appendChild(T(c[1], {size: 11, lh: 16, color: 'muted', w: cellW}));
      strip.appendChild(cell);
    });
    board.appendChild(strip); strip.x = G.MARGIN; strip.y = bottom + 20;
    bottom = strip.y + strip.height;
  }
  board.resize(BW, Math.round(bottom + 72));

  return {createdNodeIds: [board.id], board: {id: board.id, x: board.x, y: board.y, w: BW, h: board.height},
    nodes: SPEC.nodes.length, edges: SPEC.edges.length, font: FAMILY, warnings: warnings};
}
