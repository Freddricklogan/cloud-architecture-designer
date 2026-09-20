import { describe, it, expect } from 'vitest';
import { hclString, logicalId, terraformName, toCloudFormation, toReviewMarkdown, toTerraform, yamlString } from '../src/export.js';
import { addNode, connect, createIdFactory, emptyDesign } from '../src/graph.js';
import { reviewDesign } from '../src/review.js';
import { estimateCost } from '../src/cost.js';
import { instantiateTemplate, TEMPLATES } from '../src/templates.js';

function sample() {
  const nextId = createIdFactory();
  let d = emptyDesign();
  d = addNode(d, { type: 'alb', name: 'ALB', x: 0, y: 0 }, nextId);
  d = addNode(d, { type: 'ec2', name: 'EC2 (Web)', x: 0, y: 0 }, nextId);
  d = addNode(d, { type: 'ec2', name: 'EC2 (Web)', x: 0, y: 0 }, nextId); // duplicate name
  d = connect(d, 'n1', 'n2');
  d = connect(d, 'n1', 'n3');
  return d;
}

describe('naming', () => {
  it('produces valid unique Terraform names', () => {
    const taken = new Set();
    expect(terraformName('EC2 (Web)', taken)).toBe('ec2_web');
    expect(terraformName('EC2 (Web)', taken)).toBe('ec2_web_2');
    expect(terraformName('EC2 (Web)', taken)).toBe('ec2_web_3');
    expect(terraformName('!!!')).toBe('resource');
    expect(terraformName('3 tier')).toBe('r_3_tier');
  });
  it('produces valid unique CloudFormation logical ids', () => {
    const taken = new Set();
    expect(logicalId('EC2 (Web)', taken)).toBe('EC2Web');
    expect(logicalId('EC2 (Web)', taken)).toBe('EC2Web2');
    expect(logicalId('---')).toBe('Resource');
    expect(logicalId('3rd tier')).toBe('R3rdTier');
  });
});

describe('toTerraform', () => {
  it('emits a provider block and a comment for an empty design', () => {
    const hcl = toTerraform(emptyDesign());
    expect(hcl).toContain('required_providers');
    expect(hcl).toContain('(empty design)');
  });

  it('emits one typed resource per node with depends_on from upstream edges', () => {
    const hcl = toTerraform(sample());
    expect(hcl).toContain('resource "aws_lb" "alb"');
    expect(hcl).toContain('resource "aws_instance" "ec2_web"');
    expect(hcl).toContain('resource "aws_instance" "ec2_web_2"');
    expect(hcl).toContain('depends_on = [\n    aws_lb.alb,\n  ]');
    expect((hcl.match(/TODO/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(hcl).not.toContain('depends_on = [\n  ]');
  });

  it('escapes quotes and backslashes in names', () => {
    const d = addNode(emptyDesign(), { type: 's3', name: 'my "bucket" c:\\tmp', x: 0, y: 0 }, createIdFactory());
    expect(toTerraform(d)).toContain('Name      = "my \\"bucket\\" c:\\\\tmp"');
    expect(hclString('a\\b')).toBe('"a\\\\b"');
  });
});

describe('toCloudFormation', () => {
  it('emits an empty Resources map for an empty design', () => {
    expect(toCloudFormation(emptyDesign())).toContain('Resources: {}');
  });

  it('emits typed resources with DependsOn and quoted metadata', () => {
    const yaml = toCloudFormation(sample());
    expect(yaml).toContain("AWSTemplateFormatVersion: '2010-09-09'");
    expect(yaml).toContain('  ALB:\n    Type: AWS::ElasticLoadBalancingV2::LoadBalancer');
    expect(yaml).toContain('  EC2Web:\n    Type: AWS::EC2::Instance\n    DependsOn:\n      - ALB');
    expect(yaml).toContain('EC2Web2:');
    expect(yaml).toContain('Name: "EC2 (Web)"');
  });

  it('escapes quotes and backslashes in names', () => {
    const d = addNode(emptyDesign(), { type: 's3', name: 'Bob\'s "share" \\\\srv', x: 0, y: 0 }, createIdFactory());
    expect(toCloudFormation(d)).toContain('Name: "Bob\'s \\"share\\" \\\\\\\\srv"');
    expect(yamlString('x\\y')).toBe('"x\\\\y"');
  });
});

describe('every template exports cleanly', () => {
  for (const t of TEMPLATES) {
    it(t.id, () => {
      const d = instantiateTemplate(t, 0, 0, createIdFactory());
      const hcl = toTerraform(d);
      const yaml = toCloudFormation(d);
      expect((hcl.match(/^resource "/gm) || []).length).toBe(d.nodes.length);
      expect((yaml.match(/^ {4}Type: AWS::/gm) || []).length).toBe(d.nodes.length);
    });
  }
});

describe('toReviewMarkdown', () => {
  it('summarises counts, score and every finding, escaping pipes', () => {
    const d = sample();
    const md = toReviewMarkdown(d, reviewDesign(d), estimateCost(d));
    expect(md).toContain('- Components: 3');
    expect(md).toContain('- Connections: 2');
    expect(md).toContain('$340');
    expect(md).toMatch(/Score: \d+ \/ 100/);
    expect(md).toContain('| SEC-2 | Security |');
    // Every finding row has exactly the table's column separators once pipes in notes are escaped.
    const rows = md.split('\n').filter((l) => /^\| [A-Z]+-\d /.test(l));
    expect(rows.length).toBe(reviewDesign(d).findings.length);
    for (const row of rows) expect((row.replace(/\\\|/g, '').match(/\|/g) || []).length).toBe(6);
  });
  it('prints n/a when nothing applies', () => {
    const d = emptyDesign();
    expect(toReviewMarkdown(d, reviewDesign(d), estimateCost(d))).toContain('Score: n/a');
  });
});
