# Case study — Cloud Architecture Designer

## 1 Who has this problem

Anyone who must sign off on a cloud design before it exists: in my work, a
university IT director approving a vendor's architecture for a
student-facing system, or a consulting client asking whether their
contractor's diagram is safe to build. Both need to answer "is this sound?"
without an AWS solutions architect in the room.

## 2 The problem, as a scenario

A registrar's office commissions a credential-verification portal. The
contractor's slide shows Route 53, CloudFront, a load balancer, two EC2
instances, RDS, and a WAF in the corner. Asked whether it meets policy, the
contractor says yes: there is a WAF, encryption, a load balancer. Nobody in
the room can say whether the WAF is in front of anything, whether the KMS key
is attached to the database, or whether "load balancer" means two instances
or one. The slide lists parts; the question is about wiring.

## 3 What it costs to leave it alone

A design that passes a parts-list review and fails a real one later — after
procurement, sometimes after go-live. In education that means a security
finding against a system holding student records, and remediation I have
watched consume a semester. I will not put a dollar figure on it; it varies
too much by institution and exposure. AWS frames the same cost as
"high-risk issues" that grow more expensive the later they are found
(<https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html>).
The smaller, constant cost: a review that depends on one expert reading a
diagram does not happen when that expert is busy.

## 4 The approach and the alternative rejected

A design is a directed graph — services as nodes, traffic flow as edges —
and the review is fifteen rules that read that graph. A WAF counts only on
the inbound path to a public entry point; a KMS key only for the stores it
is attached to; a load balancer only with two or more targets. Five
reference architectures ship with explicit edges, and designs export as
Terraform or CloudFormation skeletons ordered by those edges.

The alternative I rejected is what the previous version of this repo did:
reduce the design to the set of service types present and check membership.
It is simpler, it is what most "architecture checkers" do, and it is exactly
the review the contractor in the scenario would pass. `AUDIT.md` shows what
it looked like — "Sustainability" passed whenever the canvas was non-empty.

## 5 What the code does today

**Real.** The graph model, the fifteen rules, per-pillar scoring, the five
templates, the Terraform and CloudFormation exporters, JSON import/export
and the accessibility layer are working, unit-tested code. The rules are
direction-aware: `ALB → WAF` earns nothing, and a test says so.

**Simulated.** No random data anywhere, but the cost figure deserves the
label: it sums round planning placeholders per service, not AWS pricing,
and the panel says so beside the number.

**Reference implementation.** The rule set is a teaching approximation of a
whiteboard review, modelled on the six Well-Architected pillars — not the
AWS Well-Architected Tool's question set. The exported infrastructure code
is a typed skeleton with `TODO` markers, not a deployable stack.

## 6 Evidence

From the repository's CI and the browser smoke test recorded in the README:
109 unit tests across six files, all passing; 100% statement and 98.18%
branch coverage over the six pure modules; ESLint and html-validate clean;
zero console errors in headless Chrome. All five templates instantiate with
no orphaned component and no failing rule, scoring 97, 100, 96, 100 and 100.
The tour's "break it on purpose" step drops the three-tier score from 97 to
90 with one failing check; the repair step restores it. The security-pillar
test found four wiring gaps in my own templates first — the evidence I
value most.

## 7 What it would take to run this in production

As a design-review aid it already runs — static files on GitHub Pages, no
backend. As an institutional tool it would need: import from real sources
(a Terraform state file or an AWS Config inventory), the largest piece of
work; a rule set mapped to the institution's own policy; persistence and
sharing behind campus SSO; and export into the team's IaC repository as a
pull request. Rough effort: import and policy mapping a few weeks each; the
rest days. The static tool costs nothing to host; the API tier is one small
container.

## 8 Limits and next steps

The rules know nothing of regions, availability zones, subnets or IAM
policy contents, so redundancy is inferred from targets, not checked.
Cost is a placeholder. There is no grouping (VPC as a container) and no
per-node configuration, so two EC2 nodes differ only by name. Next, in
order: VPC and subnet containment in the graph; per-node attributes that flow
into the exporters so the `TODO` markers shrink; a Terraform state importer.

## 9 Who should look at this

- **Hiring manager:** I turn a checklist into a model, test it against my
  own reference designs, and document what it does not do.
- **Consulting client:** a working way to ask "is this diagram sound?" before
  a build starts, with a clear statement of what production would cost.
- **Engineer:** `src/review.js` and `src/graph.js` — fifteen rules as data
  over an immutable directed graph, 109 tests, an exporter that invents
  nothing.
