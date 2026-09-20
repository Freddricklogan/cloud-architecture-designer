/**
 * Well-Architected review — rules as data, evaluated against the design graph.
 *
 * Each rule returns one of four statuses:
 *   pass  the design satisfies the check
 *   warn  a gap that is common and worth a conversation
 *   fail  a gap that would block a production review
 *   na    the check does not apply to this design (excluded from scoring)
 *
 * The original demo passed "Multi-AZ deployment" whenever an ALB existed
 * anywhere on the canvas and "Right-sized resources" whenever the canvas was
 * non-empty. Every rule here reads the topology: what is connected to what,
 * and in which direction.
 *
 * The pillar names follow the AWS Well-Architected Framework. The checks are a
 * teaching approximation of what an architect looks for on a whiteboard, not
 * an implementation of the AWS Well-Architected Tool's question set.
 */

import {
  COMPUTE_TYPES, CREDENTIALED_STORE_TYPES, DATA_STORE_TYPES, MESSAGING_TYPES,
  PUBLIC_ENTRY_TYPES, getEntry
} from './catalog.js';
import {
  downstream, neighbours, nodesIn, nodesOfType, orphans, reaches, typeSet, upstream
} from './graph.js';

export const PILLARS = [
  { key: 'operational', label: 'Operational Excellence' },
  { key: 'security', label: 'Security' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'performance', label: 'Performance Efficiency' },
  { key: 'cost', label: 'Cost Optimization' },
  { key: 'sustainability', label: 'Sustainability' }
];

/** @typedef {'pass'|'warn'|'fail'|'na'} Status */
/** @typedef {{ status: Status, note: string }} Verdict */
/** @typedef {{ id: string, pillar: string, title: string, evaluate: (design: import('./graph.js').Design) => Verdict }} Rule */

const pass = (note) => ({ status: 'pass', note });
const warn = (note) => ({ status: 'warn', note });
const fail = (note) => ({ status: 'fail', note });
const na = (note) => ({ status: 'na', note });

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** @type {Rule[]} */
export const RULES = [
  /* ------------------------------------------------ Operational Excellence */
  {
    id: 'OPS-1',
    pillar: 'operational',
    title: 'Workload emits telemetry',
    evaluate(design) {
      const compute = nodesIn(design, COMPUTE_TYPES);
      if (!compute.length) return na('No compute to monitor yet.');
      const cw = nodesOfType(design, 'cloudwatch');
      if (!cw.length) return fail('No CloudWatch on the design; nothing would page you when this breaks.');
      const wired = compute.filter((c) => cw.some((w) => reaches(design, c.id, w.id)));
      if (wired.length === compute.length) return pass(`All ${plural(compute.length, 'compute service')} report to CloudWatch.`);
      return warn(`${compute.length - wired.length} of ${plural(compute.length, 'compute service')} do not reach CloudWatch.`);
    }
  },
  {
    id: 'OPS-2',
    pillar: 'operational',
    title: 'Asynchronous work is decoupled',
    evaluate(design) {
      const compute = nodesIn(design, COMPUTE_TYPES);
      if (compute.length < 2) return na('Decoupling matters once there are two or more compute services.');
      const messaging = nodesIn(design, MESSAGING_TYPES);
      if (!messaging.length) return warn('Services call each other directly; a queue or event bus would absorb bursts and failures.');
      const wired = messaging.filter((m) => neighbours(design, m.id).some((id) => COMPUTE_TYPES.has(design.nodes.find((n) => n.id === id)?.type)));
      if (!wired.length) return warn('Messaging services are on the canvas but not connected to any compute.');
      return pass(`${plural(wired.length, 'messaging service')} sit between compute services.`);
    }
  },

  /* ------------------------------------------------------------ Security */
  {
    id: 'SEC-1',
    pillar: 'security',
    title: 'Identity boundary defined',
    evaluate(design) {
      if (!design.nodes.length) return na('Empty design.');
      const iam = nodesOfType(design, 'iam');
      if (!iam.length) return fail('No IAM on the design; every service would run with implicit or shared credentials.');
      const compute = nodesIn(design, COMPUTE_TYPES);
      if (!compute.length) return pass('IAM present.');
      const covered = compute.filter((c) => iam.some((i) => reaches(design, i.id, c.id)));
      if (covered.length === compute.length) return pass('Every compute service has an IAM role wired to it.');
      return warn(`${compute.length - covered.length} of ${plural(compute.length, 'compute service')} have no IAM role attached.`);
    }
  },
  {
    id: 'SEC-2',
    pillar: 'security',
    title: 'Public entry points are behind a WAF',
    evaluate(design) {
      const entries = nodesIn(design, PUBLIC_ENTRY_TYPES);
      if (!entries.length) return na('No public entry point (CloudFront, ALB or API Gateway).');
      const wafs = nodesOfType(design, 'waf');
      if (!wafs.length) return fail(`${plural(entries.length, 'public entry point')} with no WAF in front.`);
      // A WAF counts when it sits anywhere on the inbound path: WAF -> CloudFront -> ALB
      // protects the ALB, but ALB -> WAF (wrong direction) protects nothing.
      const unprotected = entries.filter((e) => !wafs.some((w) => reaches(design, w.id, e.id)));
      if (!unprotected.length) return pass('Every public entry point has a WAF on its inbound path.');
      return warn(`WAF present but not attached to: ${unprotected.map((e) => e.name).join(', ')}.`);
    }
  },
  {
    id: 'SEC-3',
    pillar: 'security',
    title: 'Data at rest is encrypted with a managed key',
    evaluate(design) {
      const stores = nodesIn(design, DATA_STORE_TYPES);
      if (!stores.length) return na('No data store on the design.');
      const kms = nodesOfType(design, 'kms');
      if (!kms.length) return fail(`${plural(stores.length, 'data store')} and no KMS key.`);
      const unkeyed = stores.filter((s) => !kms.some((k) => upstream(design, s.id).includes(k.id)));
      if (!unkeyed.length) return pass('Every data store is wired to a KMS key.');
      return warn(`KMS present but not attached to: ${unkeyed.map((s) => s.name).join(', ')}.`);
    }
  },
  {
    id: 'SEC-4',
    pillar: 'security',
    title: 'Database credentials come from a vault',
    evaluate(design) {
      const stores = nodesIn(design, CREDENTIALED_STORE_TYPES);
      if (!stores.length) return na('No credentialed data store (RDS, Redshift, ElastiCache).');
      const vault = nodesOfType(design, 'secretsmanager');
      if (!vault.length) return warn('Credentials for the database would live in code or config; add Secrets Manager.');
      const unmanaged = stores.filter((s) => !vault.some((v) => upstream(design, s.id).includes(v.id)));
      if (!unmanaged.length) return pass('Every credentialed store is wired to Secrets Manager.');
      return warn(`Secrets Manager not attached to: ${unmanaged.map((s) => s.name).join(', ')}.`);
    }
  },
  {
    id: 'SEC-5',
    pillar: 'security',
    title: 'No data store is exposed at the edge',
    evaluate(design) {
      const stores = nodesIn(design, CREDENTIALED_STORE_TYPES);
      if (!stores.length) return na('No credentialed data store.');
      const edge = new Set(['route53', 'cloudfront', 'alb']);
      const exposed = stores.filter((s) => upstream(design, s.id).some((id) => edge.has(design.nodes.find((n) => n.id === id)?.type)));
      if (exposed.length) return fail(`Edge services connect directly to: ${exposed.map((s) => s.name).join(', ')}.`);
      return pass('Data stores are only reached through compute.');
    }
  },

  /* --------------------------------------------------------- Reliability */
  {
    id: 'REL-1',
    pillar: 'reliability',
    title: 'Load balancer fronts redundant targets',
    evaluate(design) {
      const albs = nodesOfType(design, 'alb');
      const servers = nodesOfType(design, 'ec2');
      if (!albs.length && !servers.length) return na('No ALB or EC2 fleet.');
      if (!albs.length) return warn(`${plural(servers.length, 'EC2 instance')} with no load balancer; a single instance is a single point of failure.`);
      const thin = albs.filter((a) => downstream(design, a.id).filter((id) => {
        const t = design.nodes.find((n) => n.id === id)?.type;
        return t && (COMPUTE_TYPES.has(t));
      }).length < 2);
      if (!thin.length) return pass('Every load balancer has two or more targets.');
      return warn(`${thin.map((a) => a.name).join(', ')}: fewer than two targets behind the load balancer.`);
    }
  },
  {
    id: 'REL-2',
    pillar: 'reliability',
    title: 'Capacity scales with demand',
    evaluate(design) {
      const servers = nodesOfType(design, 'ec2');
      const compute = nodesIn(design, COMPUTE_TYPES);
      if (!compute.length) return na('No compute on the design.');
      if (!servers.length) return pass('Compute is fully managed; scaling is handled by the platform.');
      const asgs = nodesOfType(design, 'asg');
      if (!asgs.length) return warn(`${plural(servers.length, 'EC2 instance')} with no Auto Scaling group.`);
      const unscaled = servers.filter((s) => !asgs.some((a) => downstream(design, a.id).includes(s.id)));
      if (!unscaled.length) return pass('Every EC2 instance belongs to an Auto Scaling group.');
      return warn(`Not in an Auto Scaling group: ${unscaled.map((s) => s.name).join(', ')}.`);
    }
  },
  {
    id: 'REL-3',
    pillar: 'reliability',
    title: 'Stateful services are backed up',
    evaluate(design) {
      const backable = new Set(['rds', 'ebs', 'efs', 'dynamodb']);
      const stores = nodesIn(design, backable);
      if (!stores.length) return na('No backup-eligible store (RDS, EBS, EFS, DynamoDB).');
      const plans = nodesOfType(design, 'backup');
      if (!plans.length) return warn(`${plural(stores.length, 'store')} with no AWS Backup plan.`);
      const uncovered = stores.filter((s) => !plans.some((p) => upstream(design, s.id).includes(p.id)));
      if (!uncovered.length) return pass('Every eligible store is attached to a backup plan.');
      return warn(`Backup plan not attached to: ${uncovered.map((s) => s.name).join(', ')}.`);
    }
  },
  {
    id: 'REL-4',
    pillar: 'reliability',
    title: 'No orphaned components',
    evaluate(design) {
      if (design.nodes.length < 2) return na('Needs two or more components.');
      const loose = orphans(design);
      if (!loose.length) return pass('Every component is connected to at least one other.');
      return warn(`${plural(loose.length, 'component')} not connected to anything: ${loose.map((n) => n.name).join(', ')}.`);
    }
  },

  /* ---------------------------------------------- Performance Efficiency */
  {
    id: 'PERF-1',
    pillar: 'performance',
    title: 'Web-facing origins are served from the edge',
    evaluate(design) {
      // A web-facing origin is an S3 bucket or ALB that DNS or a CDN points at
      // directly. An S3 bucket used as internal storage is not one.
      const front = new Set(['route53', 'cloudfront']);
      const typeOf = (id) => design.nodes.find((n) => n.id === id)?.type;
      const origins = [...nodesOfType(design, 's3'), ...nodesOfType(design, 'alb')]
        .filter((o) => upstream(design, o.id).some((id) => front.has(typeOf(id))));
      if (!origins.length) return na('No web-facing origin (S3 or ALB behind DNS or a CDN).');
      const bare = origins.filter((o) => !upstream(design, o.id).some((id) => typeOf(id) === 'cloudfront'));
      if (!bare.length) return pass(`CloudFront fronts ${origins.map((o) => o.name).join(', ')}.`);
      return warn(`DNS points straight at ${bare.map((o) => o.name).join(', ')}; put CloudFront in front.`);
    }
  },
  {
    id: 'PERF-2',
    pillar: 'performance',
    title: 'Relational reads are cached',
    evaluate(design) {
      const dbs = nodesOfType(design, 'rds');
      if (!dbs.length) return na('No relational database.');
      const caches = nodesOfType(design, 'elasticache');
      if (!caches.length) return warn('RDS with no cache in front; read-heavy paths will hit the database directly.');
      const shared = dbs.filter((db) => caches.some((c) => upstream(design, db.id).some((id) => upstream(design, c.id).includes(id))));
      if (shared.length) return pass('A cache shares an upstream service with the database.');
      return warn('ElastiCache present but no service reads from both the cache and the database.');
    }
  },

  /* ---------------------------------------------------- Cost Optimization */
  {
    id: 'COST-1',
    pillar: 'cost',
    title: 'Fixed capacity is not paying for peak',
    evaluate(design) {
      const servers = nodesOfType(design, 'ec2');
      if (!servers.length) return na('No fixed instances.');
      const asgs = nodesOfType(design, 'asg');
      if (asgs.length) return pass('EC2 capacity can scale down when idle.');
      return warn(`${plural(servers.length, 'fixed instance')} run 24×7 regardless of load.`);
    }
  },
  {
    id: 'COST-2',
    pillar: 'cost',
    title: 'Warehouse has a landing zone',
    evaluate(design) {
      const dws = nodesOfType(design, 'redshift');
      if (!dws.length) return na('No data warehouse.');
      const fed = dws.filter((d) => upstream(design, d.id).some((id) => design.nodes.find((n) => n.id === id)?.type === 's3'));
      if (fed.length === dws.length) return pass('Redshift loads from S3; the warehouse is not the system of record.');
      return warn('Redshift without an S3 landing zone tends to become an expensive primary store.');
    }
  },

  /* ------------------------------------------------------- Sustainability */
  {
    id: 'SUS-1',
    pillar: 'sustainability',
    title: 'Managed services carry most of the workload',
    evaluate(design) {
      if (!design.nodes.length) return na('Empty design.');
      const managed = design.nodes.filter((n) => getEntry(n.type)?.managed).length;
      const share = managed / design.nodes.length;
      const pct = Math.round(share * 100);
      if (share >= 0.7) return pass(`${pct}% of components are managed by AWS.`);
      if (share >= 0.5) return warn(`${pct}% managed; consider replacing self-operated services.`);
      return warn(`Only ${pct}% of components are managed; self-operated fleets are rarely right-sized.`);
    }
  }
];

const WEIGHT = { pass: 1, warn: 0.5, fail: 0 };

/**
 * @typedef {{ id: string, pillar: string, pillarLabel: string, title: string, status: Status, note: string }} Finding
 * @typedef {{ findings: Finding[], pillars: Array<{ key: string, label: string, score: number|null, counts: Record<Status, number> }>, score: number|null, counts: Record<Status, number> }} Review
 */

/**
 * Evaluate every rule. `score` is 0–100 over applicable rules only
 * (pass = 1, warn = 0.5, fail = 0), null when nothing applies.
 * @param {import('./graph.js').Design} design
 * @returns {Review}
 */
export function reviewDesign(design) {
  const findings = RULES.map((rule) => {
    const verdict = rule.evaluate(design);
    return {
      id: rule.id,
      pillar: rule.pillar,
      pillarLabel: PILLARS.find((p) => p.key === rule.pillar)?.label ?? rule.pillar,
      title: rule.title,
      status: verdict.status,
      note: verdict.note
    };
  });

  const counts = { pass: 0, warn: 0, fail: 0, na: 0 };
  for (const f of findings) counts[f.status] += 1;

  const pillars = PILLARS.map((p) => {
    const mine = findings.filter((f) => f.pillar === p.key);
    const c = { pass: 0, warn: 0, fail: 0, na: 0 };
    for (const f of mine) c[f.status] += 1;
    const applicable = mine.filter((f) => f.status !== 'na');
    const score = applicable.length
      ? Math.round((applicable.reduce((a, f) => a + WEIGHT[f.status], 0) / applicable.length) * 100)
      : null;
    return { key: p.key, label: p.label, score, counts: c };
  });

  const applicable = findings.filter((f) => f.status !== 'na');
  const score = applicable.length
    ? Math.round((applicable.reduce((a, f) => a + WEIGHT[f.status], 0) / applicable.length) * 100)
    : null;

  return { findings, pillars, score, counts };
}

/** Distinct types present, exposed for the KPI strip. */
export function serviceTypes(design) {
  return typeSet(design);
}
