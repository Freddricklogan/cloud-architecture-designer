import { describe, it, expect } from 'vitest';
import { PILLARS, RULES, reviewDesign, serviceTypes } from '../src/review.js';
import { addNode, connect, createIdFactory, emptyDesign } from '../src/graph.js';

/** Tiny builder: b.add('ec2','Web') returns the id; b.link(a,b). */
function builder() {
  const nextId = createIdFactory();
  let design = emptyDesign();
  return {
    add(type, name) {
      design = addNode(design, { type, name, x: 0, y: 0 }, nextId);
      return design.nodes[design.nodes.length - 1].id;
    },
    link(from, to) { design = connect(design, from, to); },
    get() { return design; }
  };
}

const finding = (design, id) => reviewDesign(design).findings.find((f) => f.id === id);

describe('rule catalogue', () => {
  it('ids are unique and every pillar has at least one rule', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const p of PILLARS) expect(RULES.some((r) => r.pillar === p.key)).toBe(true);
  });

  it('an empty design yields only n/a and a null score', () => {
    const r = reviewDesign(emptyDesign());
    expect(r.findings.every((f) => f.status === 'na')).toBe(true);
    expect(r.score).toBeNull();
    expect(r.pillars.every((p) => p.score === null)).toBe(true);
  });
});

describe('OPS-1 telemetry', () => {
  it('fails with compute and no CloudWatch', () => {
    const b = builder(); b.add('lambda');
    expect(finding(b.get(), 'OPS-1').status).toBe('fail');
  });
  it('warns when some compute cannot reach CloudWatch', () => {
    const b = builder(); const a = b.add('lambda', 'A'); b.add('lambda', 'B'); const cw = b.add('cloudwatch');
    b.link(a, cw);
    const f = finding(b.get(), 'OPS-1');
    expect(f.status).toBe('warn');
    expect(f.note).toMatch(/1 of 2 compute services/);
  });
  it('passes when every compute reaches CloudWatch, including transitively', () => {
    const b = builder(); const a = b.add('lambda', 'A'); const q = b.add('sqs'); const w = b.add('lambda', 'W'); const cw = b.add('cloudwatch');
    b.link(a, q); b.link(q, w); b.link(w, cw);
    expect(finding(b.get(), 'OPS-1').status).toBe('pass');
  });
});

describe('OPS-2 decoupling', () => {
  it('is n/a below two compute services', () => {
    const b = builder(); b.add('lambda');
    expect(finding(b.get(), 'OPS-2').status).toBe('na');
  });
  it('warns with no messaging, warns with unconnected messaging, passes when wired', () => {
    const b = builder(); const a = b.add('lambda'); const c = b.add('ecs');
    expect(finding(b.get(), 'OPS-2').status).toBe('warn');
    const q = b.add('sqs');
    expect(finding(b.get(), 'OPS-2').note).toMatch(/not connected/);
    b.link(a, q); b.link(q, c);
    expect(finding(b.get(), 'OPS-2').status).toBe('pass');
  });
});

describe('SEC-1 identity', () => {
  it('fails with no IAM', () => {
    const b = builder(); b.add('s3');
    expect(finding(b.get(), 'SEC-1').status).toBe('fail');
  });
  it('passes with IAM and no compute', () => {
    const b = builder(); b.add('s3'); b.add('iam');
    expect(finding(b.get(), 'SEC-1').status).toBe('pass');
  });
  it('warns when a compute service has no role reaching it', () => {
    const b = builder(); const i = b.add('iam'); const a = b.add('ec2', 'A'); b.add('ec2', 'B');
    b.link(i, a);
    expect(finding(b.get(), 'SEC-1').note).toMatch(/1 of 2/);
  });
});

describe('SEC-2 WAF', () => {
  it('is n/a with no public entry', () => {
    const b = builder(); b.add('rds');
    expect(finding(b.get(), 'SEC-2').status).toBe('na');
  });
  it('fails with an ALB and no WAF, warns when the WAF is not attached, passes when attached', () => {
    const b = builder(); const alb = b.add('alb', 'Front');
    expect(finding(b.get(), 'SEC-2').status).toBe('fail');
    const waf = b.add('waf');
    expect(finding(b.get(), 'SEC-2')).toMatchObject({ status: 'warn', note: expect.stringContaining('Front') });
    b.link(waf, alb);
    expect(finding(b.get(), 'SEC-2').status).toBe('pass');
  });
  it('a WAF upstream of CloudFront also protects the ALB behind it', () => {
    const b = builder(); const waf = b.add('waf'); const cdn = b.add('cloudfront'); const alb = b.add('alb');
    b.link(waf, cdn); b.link(cdn, alb);
    expect(finding(b.get(), 'SEC-2').status).toBe('pass');
  });
  it('direction matters: ALB -> WAF is not protection', () => {
    const b = builder(); const alb = b.add('alb'); const waf = b.add('waf');
    b.link(alb, waf);
    expect(finding(b.get(), 'SEC-2').status).toBe('warn');
  });
});

describe('SEC-3 encryption', () => {
  it('fails with data and no KMS, warns when unattached, passes when every store is keyed', () => {
    const b = builder(); const s3 = b.add('s3', 'Bucket'); const db = b.add('rds', 'DB');
    expect(finding(b.get(), 'SEC-3').status).toBe('fail');
    const kms = b.add('kms');
    b.link(kms, s3);
    expect(finding(b.get(), 'SEC-3')).toMatchObject({ status: 'warn', note: expect.stringContaining('DB') });
    b.link(kms, db);
    expect(finding(b.get(), 'SEC-3').status).toBe('pass');
  });
});

describe('SEC-4 secrets', () => {
  it('n/a without credentialed stores; warn without vault; pass when attached', () => {
    const b = builder(); b.add('dynamodb');
    expect(finding(b.get(), 'SEC-4').status).toBe('na');
    const db = b.add('rds');
    expect(finding(b.get(), 'SEC-4').status).toBe('warn');
    const v = b.add('secretsmanager');
    expect(finding(b.get(), 'SEC-4').note).toMatch(/not attached/);
    b.link(v, db);
    expect(finding(b.get(), 'SEC-4').status).toBe('pass');
  });
});

describe('SEC-5 edge exposure', () => {
  it('fails when an ALB connects straight to RDS', () => {
    const b = builder(); const alb = b.add('alb'); const db = b.add('rds', 'Prod');
    b.link(alb, db);
    expect(finding(b.get(), 'SEC-5')).toMatchObject({ status: 'fail', note: expect.stringContaining('Prod') });
  });
  it('passes when the database is only reached through compute', () => {
    const b = builder(); const alb = b.add('alb'); const app = b.add('ec2'); const db = b.add('rds');
    b.link(alb, app); b.link(app, db);
    expect(finding(b.get(), 'SEC-5').status).toBe('pass');
  });
});

describe('REL-1 load balancing', () => {
  it('n/a with neither ALB nor EC2', () => {
    const b = builder(); b.add('lambda');
    expect(finding(b.get(), 'REL-1').status).toBe('na');
  });
  it('warns for EC2 with no ALB', () => {
    const b = builder(); b.add('ec2');
    expect(finding(b.get(), 'REL-1').note).toMatch(/single point of failure/);
  });
  it('warns for an ALB with one target, passes with two', () => {
    const b = builder(); const alb = b.add('alb', 'LB'); const a = b.add('ec2', 'A');
    b.link(alb, a);
    expect(finding(b.get(), 'REL-1')).toMatchObject({ status: 'warn', note: expect.stringContaining('LB') });
    const c = b.add('ecs', 'B'); b.link(alb, c);
    expect(finding(b.get(), 'REL-1').status).toBe('pass');
  });
  it('an ALB on the canvas alone is not a pass (the original demo passed it)', () => {
    const b = builder(); b.add('alb');
    expect(finding(b.get(), 'REL-1').status).toBe('warn');
  });
});

describe('REL-2 scaling', () => {
  it('passes for fully managed compute', () => {
    const b = builder(); b.add('lambda');
    expect(finding(b.get(), 'REL-2').status).toBe('pass');
  });
  it('warns for EC2 without an ASG, warns when the ASG does not cover every instance, passes when it does', () => {
    const b = builder(); const a = b.add('ec2', 'A'); const c = b.add('ec2', 'C');
    expect(finding(b.get(), 'REL-2').status).toBe('warn');
    const asg = b.add('asg'); b.link(asg, a);
    expect(finding(b.get(), 'REL-2').note).toMatch(/C/);
    b.link(asg, c);
    expect(finding(b.get(), 'REL-2').status).toBe('pass');
  });
});

describe('REL-3 backups', () => {
  it('n/a for stores that are not backup-eligible', () => {
    const b = builder(); b.add('s3');
    expect(finding(b.get(), 'REL-3').status).toBe('na');
  });
  it('warn, then pass when the plan is attached', () => {
    const b = builder(); const db = b.add('rds');
    expect(finding(b.get(), 'REL-3').status).toBe('warn');
    const p = b.add('backup');
    expect(finding(b.get(), 'REL-3').note).toMatch(/not attached/);
    b.link(p, db);
    expect(finding(b.get(), 'REL-3').status).toBe('pass');
  });
});

describe('REL-4 orphans', () => {
  it('names the loose components', () => {
    const b = builder(); const a = b.add('s3', 'Bucket'); const k = b.add('kms', 'Key'); b.add('iam', 'Role');
    b.link(k, a);
    expect(finding(b.get(), 'REL-4')).toMatchObject({ status: 'warn', note: expect.stringContaining('Role') });
  });
});

describe('PERF-1 edge caching', () => {
  it('ignores internal buckets: n/a when nothing web-facing', () => {
    const b = builder(); const fn = b.add('lambda'); const s3 = b.add('s3'); b.link(fn, s3);
    expect(finding(b.get(), 'PERF-1').status).toBe('na');
  });
  it('warns when DNS points straight at an origin, passes once CloudFront is in front', () => {
    const b = builder(); const dns = b.add('route53'); const s3 = b.add('s3', 'Site');
    b.link(dns, s3);
    expect(finding(b.get(), 'PERF-1')).toMatchObject({ status: 'warn', note: expect.stringContaining('Site') });
    const cf = b.add('cloudfront'); b.link(cf, s3);
    expect(finding(b.get(), 'PERF-1').status).toBe('pass');
  });
  it('an ALB behind CloudFront passes', () => {
    const b = builder(); const cf = b.add('cloudfront'); const alb = b.add('alb'); b.link(cf, alb);
    expect(finding(b.get(), 'PERF-1').status).toBe('pass');
  });
});

describe('PERF-2 read caching', () => {
  it('passes only when a service reads from both cache and database', () => {
    const b = builder(); const app = b.add('ec2'); const db = b.add('rds');
    b.link(app, db);
    expect(finding(b.get(), 'PERF-2').status).toBe('warn');
    const cache = b.add('elasticache');
    expect(finding(b.get(), 'PERF-2').note).toMatch(/no service reads from both/);
    b.link(app, cache);
    expect(finding(b.get(), 'PERF-2').status).toBe('pass');
  });
});

describe('COST rules', () => {
  it('COST-1 warns for fixed EC2 and passes once an ASG exists', () => {
    const b = builder(); b.add('ec2');
    expect(finding(b.get(), 'COST-1').status).toBe('warn');
    b.add('asg');
    expect(finding(b.get(), 'COST-1').status).toBe('pass');
  });
  it('COST-2 wants Redshift fed from S3', () => {
    const b = builder(); const rs = b.add('redshift');
    expect(finding(b.get(), 'COST-2').status).toBe('warn');
    const s3 = b.add('s3'); b.link(s3, rs);
    expect(finding(b.get(), 'COST-2').status).toBe('pass');
  });
});

describe('SUS-1 managed share', () => {
  it('scores by the managed fraction', () => {
    const b = builder(); b.add('ec2'); b.add('eks');
    expect(finding(b.get(), 'SUS-1').note).toMatch(/Only 0%/);
    b.add('lambda'); b.add('s3');
    expect(finding(b.get(), 'SUS-1').status).toBe('warn');
    b.add('sqs'); b.add('sns'); b.add('kms');
    expect(finding(b.get(), 'SUS-1').status).toBe('pass');
  });
});

describe('scoring', () => {
  it('weights pass 1, warn 0.5, fail 0 over applicable rules only', () => {
    const b = builder(); b.add('alb');
    const r = reviewDesign(b.get());
    // Applicable: SEC-1 fail, SEC-2 fail, REL-1 warn, REL-4 na, PERF-1 warn, SUS-1 pass
    const applicable = r.findings.filter((f) => f.status !== 'na');
    const expected = Math.round((applicable.reduce((a, f) => a + ({ pass: 1, warn: 0.5, fail: 0 })[f.status], 0) / applicable.length) * 100);
    expect(r.score).toBe(expected);
    expect(r.counts.na + r.counts.pass + r.counts.warn + r.counts.fail).toBe(RULES.length);
    const sec = r.pillars.find((p) => p.key === 'security');
    expect(sec.score).toBe(0);
    expect(sec.counts.fail).toBe(2);
  });

  it('exposes the service type set for KPIs', () => {
    const b = builder(); b.add('ec2'); b.add('ec2'); b.add('s3');
    expect([...serviceTypes(b.get())].sort()).toEqual(['ec2', 's3']);
  });
});
