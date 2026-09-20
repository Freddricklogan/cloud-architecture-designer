# AUDIT — Cloud Architecture Designer (pre-refactor)

Audit of the previous single-file `index.html` (419 lines: ~60 lines of CSS,
~90 lines of markup, ~265 lines of inline JavaScript). Line numbers refer to
that file as it stood on `main` before this change.

The idea was sound — a canvas, a service palette, a cost figure and a
Well-Architected checklist. The findings are mostly **checks that could not
fail, connections that meant nothing, and the usual single-file hygiene**.

---

## A. Correctness — the review was not a review

### A1 — Rules read the *set of service types*, never the topology

`reviewArchitecture()` (lines 307–330) built `types = new Set(nodes.map(n => n.type))`
and every rule was a membership test on it:

```js
313: check:'Multi-AZ deployment', status: types.has('alb') ? 'pass' : 'warn'
316: check:'IAM configured',     status: types.has('iam') ? 'pass' : 'fail'
318: check:'Encryption at rest', status: types.has('kms') ? 'pass' : 'warn'
```

A WAF dropped anywhere on the canvas "protected" the application. An ALB with
nothing behind it "enabled multi-AZ". A KMS key with no connection to any data
store "enabled encryption". The connections the user drew were decorative.

**Fix:** `src/review.js` holds fifteen rules across six pillars, each a
function of the design *graph*. `SEC-2` walks the inbound path of every public
entry point looking for a WAF; `SEC-3` checks that a KMS key is attached to each
data store; `REL-1` counts targets behind each load balancer; `SEC-5` fails when
an edge service connects straight to a database. Direction matters: `ALB → WAF`
is not protection and a test says so.

### A2 — Two checks could never fail

```js
327: check:'Right-sized resources', status: nodes.length > 0 ? 'pass' : 'warn'
```

"Sustainability" passed whenever the canvas was non-empty. "Auto-scaling
configured" (line 314) passed when EC2 *and* ALB existed, with the same advisory
note either way. Both are replaced by rules that read something real
(`REL-2` requires an Auto Scaling group wired to each instance; `SUS-1` computes
the managed-service share).

### A3 — Template "connections" were positional accidents

```js
392: // Auto-connect sequential nodes
393: for (let i = 0; i < nodes.length - 1; i++) {
394:   if (Math.abs(nodes[i].y - nodes[i+1].y) < 200) connections.push({from: nodes[i].id, to: nodes[i+1].id});
```

Templates listed nodes and the code wired each one to the next in the array if
they were vertically close. In the three-tier template that produced
`ElastiCache → RDS → S3 → IAM → WAF` — a chain with no meaning. Because the
review ignored edges (A1) nobody noticed.

**Fix:** `src/templates.js` declares every edge explicitly in the direction
traffic flows. A test asserts every template instantiates with no orphan and
passes the security pillar outright.

### A4 — Undirected storage, directed drawing

Edges were stored as unordered pairs (line 186 checked both orientations) but
drawn with an arrowhead from `from` to `to` — i.e. whichever node was clicked
first. The arrow conveyed click order, not data flow. Edges are now directed
and the rules depend on it.

### A5 — Node ids from `Date.now()`

Line 174 used the millisecond clock as an id and line 391 used `Date.now() + i`.
Two drops inside one millisecond (possible from an automated or touch source)
would collide and `nodes.find(n => n.id === …)` would silently pick the wrong
node. Replaced by a counter (`createIdFactory`).

### A6 — Cost presented as an estimate

The panel read **"Estimated Monthly Cost"** over a sum of flat per-service
numbers (`data-cost="150"` for EC2, and so on) with no sizing, region or usage
assumption. The numbers are kept as *planning placeholders* — they were never
list prices — and the UI now says so in the panel and beside the total, with a
per-category breakdown so the reader can see where the figure comes from.

---

## B. Security

- **B1** Inline handlers `onchange=` (69) and `onclick=` (77–79) and one
  inline `<script>` block — incompatible with any strict CSP. Now
  `addEventListener` everywhere; `script-src 'self'` and no `'unsafe-inline'`.
- **B2** No Content-Security-Policy at all. Now
  `default-src 'none'; script-src 'self'; style-src 'self' fonts.googleapis.com; …`.
  No CDN script is loaded, so there is nothing to pin with SRI.
- **B3** `innerHTML` with interpolated node names (lines 296, 329). Names came
  only from the palette in the old build, but this build adds JSON import, so
  every string is rendered through `textContent` / `createElement`
  (`src/ui.js`). A test feeds `<script>alert(1)</script>` through the importer.
- **B4** JSON import is new and therefore audited on arrival: unknown types,
  duplicate ids, dangling and duplicate edges and non-finite coordinates are
  dropped with warnings rather than thrown (`parseDesign`, 5 tests).
- **B5** ~40 inline `style=` attributes (every palette icon, the footer, the
  floating "View Source" pill). Moved to classes; `html-validate` enforces
  `no-inline-style`.

---

## C. Accessibility

- **C1** The canvas was the only way to see or change the design — invisible
  to a screen reader and unreachable from a keyboard. Added an **Inventory**
  panel listing every component with the same select / connect / remove
  actions, an **Add** button on every palette item, `Delete` to remove and
  arrow keys to nudge the selection, `Escape` to cancel a connection.
- **C2** Two `<h1>`s once the shell was added; demoted the page heading.
- **C3** The `<select>` had no label; buttons had no `type`. Fixed.
- **C4** Nothing announced state changes. `role="status"` line under the
  canvas and `aria-live` on every changing number.
- **C5** Bespoke light theme; replaced by the shared dark token set with
  AA contrast.

---

## D. Engineering hygiene

- **D1** Module-level mutable globals (`nodes`, `connections`, `selectedNode`,
  `connectingFrom`, `draggingNode`) — nothing testable. Now an immutable
  design object; every operation returns a new one, which also gave undo for
  free.
- **D2** Canvas drawn at 1× — blurred on high-DPI displays. `fitCanvas()`
  scales the backing store by `devicePixelRatio`.
- **D3** Nodes could be dragged off-canvas and lost. `clampPosition()` keeps
  every node inside, on drag, on import and on resize.
- **D4** No tests, no lint, no CI, no `package.json`. Now 110 Vitest tests over
  the pure modules at 100% statement coverage, ESLint flat config,
  html-validate, Trivy and CodeQL in CI.
- **D5** `og:description` and the JSON-LD `description` were the literal string
  "Cloud Architecture Designer". Replaced with real descriptions.

---

## E. What is new (not fixes)

- Terraform and CloudFormation skeleton export: every node becomes a
  correctly typed resource, ordered by the design's edges through
  `depends_on` / `DependsOn`, with attributes marked `TODO` rather than
  invented.
- Design JSON export / import, a Markdown review report, undo, and four
  catalog additions the rules needed to be honest about (Auto Scaling group,
  AWS Backup, Secrets Manager, CloudWatch).
