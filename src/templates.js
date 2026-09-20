/**
 * Reference architectures. Each template lists its nodes with a local key and
 * an offset from the canvas centre, and its edges as explicit `from -> to`
 * pairs in the direction traffic flows.
 *
 * The original demo "auto-connected" whichever nodes happened to sit near
 * each other vertically, which wired IAM to S3 and WAF to IAM. Edges are
 * now data, so a template's topology is reviewable and testable.
 */

import { addNode, connect, emptyDesign } from './graph.js';

/**
 * @typedef {{ key: string, type: string, name: string, dx: number, dy: number }} TemplateNode
 * @typedef {{ id: string, name: string, summary: string, nodes: TemplateNode[], edges: Array<[string, string]> }} Template
 */

/** @type {Template[]} */
export const TEMPLATES = [
  {
    id: 'three-tier',
    name: 'Three-Tier Web App',
    summary: 'DNS → CDN → WAF-fronted ALB → auto-scaled web and app tiers → cache and relational store, with KMS, backups and monitoring.',
    nodes: [
      { key: 'dns', type: 'route53', name: 'Route 53', dx: 0, dy: -230 },
      { key: 'cdn', type: 'cloudfront', name: 'CloudFront', dx: 0, dy: -150 },
      { key: 'waf', type: 'waf', name: 'WAF', dx: -160, dy: -150 },
      { key: 'alb', type: 'alb', name: 'ALB', dx: 0, dy: -70 },
      { key: 'asg', type: 'asg', name: 'Auto Scaling', dx: -190, dy: 10 },
      { key: 'web', type: 'ec2', name: 'EC2 (Web)', dx: -70, dy: 10 },
      { key: 'app', type: 'ec2', name: 'EC2 (App)', dx: 70, dy: 10 },
      { key: 'cache', type: 'elasticache', name: 'ElastiCache', dx: -70, dy: 100 },
      { key: 'db', type: 'rds', name: 'RDS Primary', dx: 70, dy: 100 },
      { key: 'assets', type: 's3', name: 'S3 Assets', dx: 180, dy: -150 },
      { key: 'iam', type: 'iam', name: 'IAM', dx: 210, dy: 10 },
      { key: 'kms', type: 'kms', name: 'KMS', dx: 210, dy: 100 },
      { key: 'secrets', type: 'secretsmanager', name: 'Secrets Manager', dx: 210, dy: 190 },
      { key: 'backup', type: 'backup', name: 'AWS Backup', dx: 70, dy: 190 },
      { key: 'cw', type: 'cloudwatch', name: 'CloudWatch', dx: -70, dy: 190 }
    ],
    edges: [
      ['dns', 'cdn'], ['waf', 'cdn'], ['cdn', 'alb'], ['cdn', 'assets'],
      ['alb', 'web'], ['alb', 'app'], ['asg', 'web'], ['asg', 'app'],
      ['web', 'cache'], ['app', 'cache'], ['app', 'db'], ['app', 'assets'],
      ['iam', 'web'], ['iam', 'app'], ['kms', 'db'], ['kms', 'cache'], ['kms', 'assets'],
      ['secrets', 'db'], ['secrets', 'cache'], ['backup', 'db'], ['web', 'cw'], ['app', 'cw']
    ]
  },
  {
    id: 'serverless',
    name: 'Serverless API',
    summary: 'API Gateway in front of three Lambda functions, DynamoDB and S3 for state, SQS and SNS for asynchronous work.',
    nodes: [
      { key: 'dns', type: 'route53', name: 'Route 53', dx: 0, dy: -200 },
      { key: 'waf', type: 'waf', name: 'WAF', dx: -160, dy: -110 },
      { key: 'api', type: 'apigw', name: 'API Gateway', dx: 0, dy: -110 },
      { key: 'auth', type: 'lambda', name: 'Lambda Auth', dx: -140, dy: -20 },
      { key: 'fn', type: 'lambda', name: 'Lambda API', dx: 0, dy: -20 },
      { key: 'worker', type: 'lambda', name: 'Lambda Worker', dx: 140, dy: -20 },
      { key: 'ddb', type: 'dynamodb', name: 'DynamoDB', dx: 0, dy: 80 },
      { key: 's3', type: 's3', name: 'S3 Storage', dx: 140, dy: 80 },
      { key: 'queue', type: 'sqs', name: 'SQS Queue', dx: -140, dy: 80 },
      { key: 'topic', type: 'sns', name: 'SNS Topics', dx: -140, dy: 170 },
      { key: 'iam', type: 'iam', name: 'IAM', dx: 160, dy: -110 },
      { key: 'kms', type: 'kms', name: 'KMS', dx: 140, dy: 170 },
      { key: 'backup', type: 'backup', name: 'AWS Backup', dx: 280, dy: 80 },
      { key: 'cw', type: 'cloudwatch', name: 'CloudWatch', dx: 0, dy: 170 }
    ],
    edges: [
      ['dns', 'api'], ['waf', 'api'], ['api', 'auth'], ['api', 'fn'],
      ['fn', 'ddb'], ['fn', 'queue'], ['queue', 'worker'], ['worker', 's3'], ['worker', 'topic'],
      ['iam', 'auth'], ['iam', 'fn'], ['iam', 'worker'], ['kms', 'ddb'], ['kms', 's3'], ['backup', 'ddb'],
      ['auth', 'cw'], ['fn', 'cw'], ['worker', 'cw']
    ]
  },
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    summary: 'Event-triggered extraction from a raw bucket, queued processing on ECS, staging in RDS and a Redshift warehouse.',
    nodes: [
      { key: 'events', type: 'eventbridge', name: 'EventBridge', dx: -220, dy: -130 },
      { key: 'raw', type: 's3', name: 'S3 Raw Data', dx: -220, dy: -40 },
      { key: 'etl', type: 'lambda', name: 'Lambda ETL', dx: -90, dy: -40 },
      { key: 'queue', type: 'sqs', name: 'SQS Queue', dx: 40, dy: -40 },
      { key: 'proc', type: 'ecs', name: 'ECS Processing', dx: 170, dy: -40 },
      { key: 'staging', type: 'rds', name: 'RDS Staging', dx: 170, dy: 60 },
      { key: 'dw', type: 'redshift', name: 'Redshift DW', dx: 0, dy: 60 },
      { key: 'processed', type: 's3', name: 'S3 Processed', dx: -220, dy: 60 },
      { key: 'iam', type: 'iam', name: 'IAM', dx: 40, dy: -130 },
      { key: 'kms', type: 'kms', name: 'KMS', dx: -90, dy: 150 },
      { key: 'secrets', type: 'secretsmanager', name: 'Secrets Manager', dx: 170, dy: 150 },
      { key: 'backup', type: 'backup', name: 'AWS Backup', dx: 40, dy: 150 },
      { key: 'cw', type: 'cloudwatch', name: 'CloudWatch', dx: 170, dy: -130 }
    ],
    edges: [
      ['events', 'raw'], ['raw', 'etl'], ['etl', 'queue'], ['queue', 'proc'],
      ['proc', 'staging'], ['proc', 'processed'], ['staging', 'dw'], ['processed', 'dw'],
      ['iam', 'etl'], ['iam', 'proc'], ['kms', 'raw'], ['kms', 'processed'], ['kms', 'staging'], ['kms', 'dw'],
      ['secrets', 'staging'], ['secrets', 'dw'], ['backup', 'staging'], ['proc', 'cw'], ['etl', 'cw']
    ]
  },
  {
    id: 'microservices',
    name: 'Microservices',
    summary: 'A WAF-fronted ALB routing to three services hosted on an EKS cluster, each owning its own datastore, decoupled by SQS.',
    nodes: [
      { key: 'waf', type: 'waf', name: 'WAF', dx: -170, dy: -160 },
      { key: 'alb', type: 'alb', name: 'ALB', dx: 0, dy: -160 },
      { key: 'eks', type: 'eks', name: 'EKS Cluster', dx: 0, dy: -75 },
      { key: 'a', type: 'ecs', name: 'Service A', dx: -160, dy: 10 },
      { key: 'b', type: 'ecs', name: 'Service B', dx: 0, dy: 10 },
      { key: 'c', type: 'ecs', name: 'Service C', dx: 160, dy: 10 },
      { key: 'queue', type: 'sqs', name: 'SQS', dx: -160, dy: 100 },
      { key: 'db', type: 'rds', name: 'RDS', dx: 0, dy: 100 },
      { key: 'ddb', type: 'dynamodb', name: 'DynamoDB', dx: 160, dy: 100 },
      { key: 'cache', type: 'elasticache', name: 'Redis Cache', dx: 0, dy: 190 },
      { key: 'iam', type: 'iam', name: 'IAM', dx: 200, dy: -160 },
      { key: 'kms', type: 'kms', name: 'KMS', dx: 200, dy: -75 },
      { key: 'secrets', type: 'secretsmanager', name: 'Secrets Manager', dx: 160, dy: 190 },
      { key: 'backup', type: 'backup', name: 'AWS Backup', dx: 320, dy: 100 },
      { key: 'cw', type: 'cloudwatch', name: 'CloudWatch', dx: -160, dy: 190 }
    ],
    edges: [
      ['waf', 'alb'], ['alb', 'a'], ['alb', 'b'], ['alb', 'c'], ['eks', 'a'], ['eks', 'b'], ['eks', 'c'],
      ['a', 'queue'], ['queue', 'b'], ['b', 'db'], ['b', 'cache'], ['c', 'ddb'],
      ['iam', 'eks'], ['iam', 'a'], ['iam', 'b'], ['iam', 'c'], ['kms', 'db'], ['kms', 'ddb'], ['kms', 'cache'],
      ['secrets', 'db'], ['secrets', 'cache'], ['backup', 'db'], ['backup', 'ddb'],
      ['a', 'cw'], ['b', 'cw'], ['c', 'cw']
    ]
  },
  {
    id: 'static-site',
    name: 'Static Website + CDN',
    summary: 'Route 53 → WAF-protected CloudFront → private S3 origin, encrypted with KMS.',
    nodes: [
      { key: 'dns', type: 'route53', name: 'Route 53', dx: 0, dy: -130 },
      { key: 'waf', type: 'waf', name: 'WAF', dx: -160, dy: -40 },
      { key: 'cdn', type: 'cloudfront', name: 'CloudFront', dx: 0, dy: -40 },
      { key: 'site', type: 's3', name: 'S3 Website', dx: 0, dy: 50 },
      { key: 'kms', type: 'kms', name: 'KMS', dx: 160, dy: 50 },
      { key: 'iam', type: 'iam', name: 'IAM', dx: 160, dy: -40 },
      { key: 'cw', type: 'cloudwatch', name: 'CloudWatch', dx: 0, dy: 140 }
    ],
    edges: [
      ['dns', 'cdn'], ['waf', 'cdn'], ['cdn', 'site'], ['kms', 'site'], ['iam', 'site'], ['cdn', 'cw']
    ]
  }
];

/** @param {string} id */
export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Build a concrete design from a template, centred on (cx, cy).
 * @param {Template} template
 * @param {number} cx
 * @param {number} cy
 * @param {() => string} nextId
 */
export function instantiateTemplate(template, cx, cy, nextId) {
  let design = emptyDesign();
  const idByKey = new Map();
  for (const n of template.nodes) {
    design = addNode(design, { type: n.type, name: n.name, x: cx + n.dx, y: cy + n.dy }, nextId);
    idByKey.set(n.key, design.nodes[design.nodes.length - 1].id);
  }
  for (const [from, to] of template.edges) {
    const a = idByKey.get(from);
    const b = idByKey.get(to);
    if (!a || !b) throw new Error(`Template ${template.id}: edge references unknown key ${from} -> ${to}`);
    design = connect(design, a, b);
  }
  return design;
}
