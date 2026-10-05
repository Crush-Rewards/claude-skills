---
name: architecture-diagram
description: Use when asked to draw an architecture, system, pipeline or data-flow diagram in a Figma design file as boxes and arrows — zones, nodes (steps, stored data, a person's decision, outside systems), labelled arrows, a legend and notes — built from one spec with the bundled builder for the Figma `use_figma` tool.
---

# Architecture diagram (Figma)

Draw how a system works as nodes and arrows on a Figma board: something a person can follow with a
finger from where work starts to where it ends.

**Where it runs:** against a Figma design file (`figma.com/design/...`) through the Figma MCP's
`use_figma` tool. Load the `figma-use` skill before the first call. The diagram itself has no repo,
but its facts come from one: read the code and docs of the system being drawn before placing a box.
For a throwaway sketch in FigJam, `generate_diagram` is quicker and this skill is the wrong tool.

## What a good one does

- **Answers one question.** "How does an ask become a served product" is a diagram. "Everything
  about discovery" is three. State the question in the subtitle.
- **Flows one way.** Left to right across zones, top to bottom inside one. A reader should never
  have to guess where to start.
- **Uses four kinds of box and no more.** A step the system runs. Stored data, drawn as a cylinder.
  A person's decision, in amber. Something outside the system, dashed.
- **Makes the arrows mean something.** Solid is the main path. Dashed is a side flow, feedback, or
  an older path that still runs. Amber is anything a person gates.
- **Uses plain words.** The title of a box is what it does, in words the owner would use. The code
  name goes underneath only if a reader would search for it.
- **Says what is not switched on.** A tag on the node, and a line in a note. A diagram that shows a
  planned system as if it were live is wrong, however accurate the boxes.
- **Is checked against the code.** Which job runs a step, what feeds a table, when it runs: read
  it, don't recall it. The diagram will be believed.
- **Stays under about 30 nodes.** More than that is two diagrams.

## How to make one

1. **Gather the facts.** List the components (jobs, tables, review steps, outside systems), the
   edges between them, the schedule, and what is built but off. Note the source for each: a file, a
   config value, a PR.
2. **Lay it out on the grid.** Zones are columns, in the order the data moves. Put consecutive
   steps in adjacent rows of one column, or in the same row of adjacent columns: those arrows come
   out straight. Let each zone span only the rows it uses, so the flow steps down and to the right.
   A second track (a record built from the main flow's output, say) goes in a wide zone along the
   bottom, with an empty row above it.
3. **Write the SPEC.** One object: zones, nodes, edges, notes. The format is below, and
   `references/example-discovery.js` is a complete one.
4. **Build.** One `use_figma` call whose code is the SPEC, then the whole of `references/builder.js`,
   then `return await buildDiagram(SPEC);`. Together they are well under the tool's 50,000
   characters.
5. **Check.** The builder returns `warnings`: a subtitle that wraps, a label wider than the gap it
   sits in. Then take `get_screenshot` at the board's own width, crop it into quarters, and look at
   each one for arrows crossing captions, labels touching a zone's border, and lines crossing lines.
6. **Fix the SPEC and build again.** The builder removes the board with the same name first, so a
   rebuild is the edit. A small fix can be patched in place, but then change the SPEC to match: the
   SPEC is the source.
7. **Say what it can't do.** Design files have no connectors. The arrows are plain lines, so they
   do not follow a box that someone drags.

## The SPEC

```js
const SPEC = {
  page: 'Discovery',                 // page name; the first page when omitted
  name: '10 — Discovery architecture, as a diagram',   // the board; an existing one with this name is replaced
  position: {x: 0, y: 18000},        // optional; default is below everything else on the page
  eyebrow: 'SYNTALIC ADMIN / DISCOVERY', title: '...', subtitle: '...',
  legend: {step: 'a step the pipeline runs'},          // optional wording: step, store, person, outside, solid, dashed, tag
  zones: [{label: '1  WHO ASKS', sub: 'apps that file requests', col: 1, rows: [1, 4]},
          {label: '7  BRAND RECORD', cols: [3, 6], rows: [9, 9]}],   // `cols` for a wide zone
  nodes: [{id: 'app', col: 1, row: 1, title: 'Customer app', sub: 'a customer tracks a competitor'},
          {id: 'requests', col: 2, row: 2, kind: 'store', title: 'Requests', sub: 'discovery.requests', tag: 'NOT ON YET'}],
  edges: [{from: 'app', to: 'requests', label: 'pulled at 02:30'}],
  notes: [{title: 'A DAY, IN UTC', col: 5, row: 1, dy: -64, spanCols: 2, lines: [['03:00', 'Morning run.']]}],
  strip: {title: 'ACROSS EVERY STAGE', cells: [['Audit', 'Every change is recorded.']]},
  grid: {}, palette: {}, font: 'Inter',                // optional overrides
};
```

| Field | Values |
|---|---|
| `node.kind` | `step` (default), `store`, `person`, `outside` |
| `node.tag` | A short word in the corner, for what is built but off: `NOT ON YET`, `SHADOW` |
| `edge.dashed`, `edge.both`, `edge.color` | Dashed line; an arrowhead at both ends; `'warn'` for amber |
| `edge.label` | A string, or `{text, side: 'left' \| 'right', dy, bg: 'zone' \| 'bg', color}` |
| `edge.fromOffset`, `edge.toOffset` | Where on the box's side the line leaves or lands, in pixels from its top (left and right sides) or from its left (top and bottom). Use it to keep two lines into one box apart |
| `edge.channel` | Pixels left or right of the middle of the gap, for an elbow's vertical run. Two elbows in one gap need different channels |
| `note` | A dashed card at `col`, `row`, moved by `dy`, `spanCols` zones wide; each line is `[key, text, colour?]` |

## Routing

The builder picks the route from where the two nodes sit. Neighbours need nothing; anything else
needs a `route`.

| The two nodes | What to write | What is drawn |
|---|---|---|
| Same column, next row | nothing | A straight vertical line; the label sits beside it |
| Next column, same row | nothing | A straight horizontal line; the label sits under it |
| Next column, another row | `channel`, `toOffset` if several share the gap | An elbow through the gap; the label sits on its vertical run |
| Far apart, over the top or underneath | `route: 'bus'`, `fromSide`/`toSide: 'T' \| 'B'`, `busY: 'top' \| 'bottom' \| {aboveRow: n} \| {belowRow: n} \| y` | Out of the box, along a horizontal line, into the other box |
| Far apart, round the side | `route: 'side'`, `side: 'L' \| 'R'`, `sideX` | Out of one side, along a vertical line, into the same side of the other box |
| Feedback from the end to the start | `route: 'loop'`, `also: [ids]` for more boxes it reaches | Right, round the bottom of everything, up the left |

## Sizes that decide what fits

The grid is 236 by 76 pixel nodes, 280 pixel zones, 96 pixel gaps, rows 112 pixels apart. With the
mono face at these sizes:

- A node title fits about 26 characters, a subtitle about 30. A second line of subtitle fits, a
  third does not.
- A label on an elbow or a straight arrow has to fit in the gap: about 14 characters.
- A label beside a vertical arrow can be about 20 characters before it leaves the zone.
- A zone's caption is two lines above its first node. An arrow that enters a node from above
  crosses the caption unless it lands to the right of the text: shorten the caption or set
  `toOffset`.
- Leave an empty row above a wide zone, so the line that feeds it has somewhere to run.

## What cost time the first time

- **Arrowheads are per vertex.** A vector network's last vertex takes `strokeCap:
  'ARROW_EQUILATERAL'`; setting `strokeCap` on the node puts a head on both ends.
- **Place a vector after setting its network.** Vertices are relative to the node, so build them
  from the bounding box's corner and then set `x` and `y`.
- **`vectorPaths` takes M, L, C, Q and Z.** The cylinder is four cubic curves and two lines, with
  an ellipse on top for the lid.
- **A label is a text in a frame filled with what is behind it,** so the line looks cut. Inside a
  zone that is the zone's fill, not the board's.
- **Text wraps without telling you.** Measure a text after creating it; the builder warns when a
  title or subtitle wraps.
- **Colours come from the file's variables when it has them,** matched by name (`bg/card`,
  `text/muted`, `status/warn`, ...), and from the builder's dark palette when it doesn't. Pass
  `palette` to map other names or a light theme.
- **An index of boards, if the file has one, grows when you add a row,** and may then touch the
  board below it. Check and move the boards down.

## Reference files

| File | What it is |
|---|---|
| `references/builder.js` | The builder. Paste it whole after the SPEC; it defines `buildDiagram(SPEC)` |
| `references/example-discovery.js` | A full SPEC: seven zones, 29 nodes, 34 edges, two notes, every route kind |
