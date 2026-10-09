# The FigJam path

Use this when the person chose a **FigJam board** in Step 0 (or gave a `figma.com/board/...` URL).
The facts, the question the diagram answers and the SPEC are the same as for a design file; what
changes is the output: the SPEC becomes **Mermaid**, FigJam lays it out, and the board is made by
the Figma MCP's `generate_diagram` tool, not by the bundled builder.

**Source of truth for the tool.** Everything about `generate_diagram` below comes from the Figma
plugin's own skills, `figma-generate-diagram` and `figma-use-figjam` (read from plugin v2.2.127 on
2026-10-09). They change with the plugin. Load them and trust them over this file when they differ.

**Not yet run end to end.** This path was written from those skills' documentation, without a Figma
session. The first real run should check the mapping below against what comes out and amend this file.

## When FigJam is the wrong answer

Say so and offer the design file when:

- the SPEC has more than about 20 edges or 30 nodes: the plugin's architecture guidance is 15-20
  edges per diagram, and an auto-layout you cannot steer spreads a dense pipeline into a thin strip;
- the diagram has to carry zones as columns, a legend, dated notes or a strip of cross-cutting
  rules: Mermaid has no equivalent and the tool will not draw them;
- the reader needs the exact look of the house style (dark board, amber person steps, tags).

## Steps

1. **Load the plugin skills.** `figma-generate-diagram` is mandatory before every
   `generate_diagram` call. If you will add notes afterwards, also load `figma-use` and
   `figma-use-figjam`.
2. **Pick the mode.**
   - **Generic flowchart (the default for this skill's diagrams).** `flowchart LR`. It has the
     shapes this skill needs (cylinder, diamond, hexagon), subgraphs, dotted edges and `style`
     lines. Read the plugin's `references/flowchart.md`.
   - **Architecture layout**, only when the SPEC is pure software architecture (apps, a gateway,
     services, datastores, queues, outside APIs) and nothing in it is a person's decision. It is a
     fixed grid: subgraph IDs must be exactly `client`, `gateway`, `service`, `datastore`,
     `external`, `async`; every node sits in one; every edge must fit the plugin's allowed-edge
     table; anything touching `async` or `external` is dotted. Pass
     `useArchitectureLayoutCode: "FIGMA_DIAGRAM_2026"`. Read `references/architecture.md` in the
     plugin skill before writing it. A SPEC with a `person` node cannot use this mode.
3. **Translate the SPEC** (generic flowchart):

   | SPEC | Mermaid |
   |---|---|
   | `zone` | `subgraph zoneId ["LABEL"]` with a light fill: `style zoneId fill:#F5F5F5,stroke:#B3B3B3`. Order of `col` is the order to write them in |
   | `node` kind `step` | `id[Title]` |
   | `node` kind `store` | `id[("Title")]` (cylinder; the shape already says "stored data", so do not write "database" in the title) |
   | `node` kind `person` | `id{"Title"}` (diamond) with the amber pair: `style id fill:#FFECBD,stroke:#FFC943` |
   | `node` kind `outside` | `id["Title (outside)"]` with the gray pair `fill:#D9D9D9,stroke:#B3B3B3`. A dashed border cannot be drawn; the word and the shape carry it |
   | `node.tag` (`NOT ON YET`, `SHADOW`) | In the label: `Title (not on yet)`. Never drop it: a planned system drawn as live is wrong |
   | `node.sub` | A second line only if it is a name a reader would search for; keep labels short |
   | `edge` | `a -->|"label"| b`, one label of 1-4 words. `dashed` becomes `-.->`; `both` becomes `<-->` |
   | `edge.color: 'warn'` | No per-edge colour. The amber diamond it leaves from says it |
   | `edge.route`, `channel`, `fromOffset`, `toOffset`, `busY`, `sideX` | Dropped. The layout engine routes |
   | `col`, `row` | Only the order they imply: write nodes and subgraphs in the flow's order |
   | `notes`, `strip`, `legend` | Not generated. See step 6 |
   | `eyebrow`, `title`, `subtitle` | `name` carries the title; the question the diagram answers goes in `userIntent` and in a text note (step 6) |

   Colours apply as `fill` and `stroke` only (font size, `stroke-width`, `stroke-dasharray` are
   ignored). Soft fills with a darker stroke, and never colour alone: the shape and the label must
   still read in grayscale.
4. **Obey the Mermaid constraints.** No emoji, no `\n`, no HTML tags in labels; node IDs in
   camelCase with no spaces or underscores; quote labels with special characters; do not use `end`,
   `subgraph` or `graph` as an ID. Do not invent a node or an edge to round the diagram out: a gap
   is better than a guess.
5. **Call `generate_diagram`.** `name` (the title), `mermaidSyntax`, `userIntent` (one sentence;
   the question), and `useArchitectureLayoutCode` only in architecture mode. It makes its own file:
   do not call `create_new_file` first. To add to a board that exists, pass `fileKey`, the part of
   `figma.com/board/<fileKey>/...`.
6. **Check, then add what Mermaid cannot carry.**
   - Open the link it returns. For a screenshot, get a `nodeId` from `get_figjam` first
     (`get_screenshot` rejects an empty one; `get_metadata` does not work on FigJam). Compare the
     board with the SPEC: every node and edge present, nothing invented, every tag still there.
   - If the SPEC has `notes`, `tags` or a `strip`, and the board will be shared, add them with
     `use_figma` and the `figma-use-figjam` skill: a sticky or text node per note, a section if
     they belong together. FigJam has one implicit page; do not call `figma.createPage()`.
7. **Say what it can't do.** The layout is automatic: no columns by zone, no legend, no tags drawn as
   tags. To move or restyle one shape, edit it in Figma; to change content, regenerate. Regenerating
   adds a new file unless you pass `fileKey`: ask once whether to replace the old diagram or keep
   both side by side, and reuse the answer. If the person is unhappy after two attempts, stop
   regenerating and ask what is wrong.

## What FigJam does better

The arrows are connectors, not loose lines, so they should stay attached when a shape is moved
(check on the first run). Anyone with edit access can change a label without a builder or a SPEC.
That is the reason to choose it for a working sketch that others will edit; the design file is for the
diagram that will be read and believed.
