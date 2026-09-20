/**
 * Service catalog — the vocabulary of the designer.
 *
 * Every node on the canvas is an instance of one catalog entry. The entry
 * carries the category (which drives colour and the Well-Architected rules),
 * an illustrative monthly planning figure, and the Terraform / CloudFormation
 * resource types used by the exporters.
 *
 * The `cost` values are round planning placeholders inherited from the
 * original demo. They are NOT AWS list prices and the UI labels them as such;
 * replace them with figures from your own account before using the estimate
 * for anything beyond a whiteboard conversation.
 */

/** @typedef {'compute'|'storage'|'database'|'networking'|'security'|'integration'|'operations'} Category */

/**
 * @typedef {object} CatalogEntry
 * @property {string} type       stable identifier, used in templates and exports
 * @property {Category} category
 * @property {string} name       display name
 * @property {string} abbr       short label drawn on the canvas node
 * @property {string} description
 * @property {number} cost       illustrative USD / month planning figure
 * @property {boolean} managed   true when AWS operates the infrastructure (serverless / fully managed)
 * @property {string} terraform  Terraform resource type
 * @property {string} cfn        CloudFormation resource type
 */

/** @type {CatalogEntry[]} */
export const CATALOG = [
  // Compute
  { type: 'ec2', category: 'compute', name: 'EC2 Instance', abbr: 'EC2', description: 'Virtual server', cost: 150, managed: false, terraform: 'aws_instance', cfn: 'AWS::EC2::Instance' },
  { type: 'lambda', category: 'compute', name: 'Lambda', abbr: 'λ', description: 'Serverless function', cost: 25, managed: true, terraform: 'aws_lambda_function', cfn: 'AWS::Lambda::Function' },
  { type: 'ecs', category: 'compute', name: 'ECS', abbr: 'ECS', description: 'Container service', cost: 200, managed: true, terraform: 'aws_ecs_service', cfn: 'AWS::ECS::Service' },
  { type: 'eks', category: 'compute', name: 'EKS', abbr: 'EKS', description: 'Kubernetes', cost: 350, managed: false, terraform: 'aws_eks_cluster', cfn: 'AWS::EKS::Cluster' },
  { type: 'asg', category: 'compute', name: 'Auto Scaling group', abbr: 'ASG', description: 'Elastic EC2 fleet', cost: 0, managed: true, terraform: 'aws_autoscaling_group', cfn: 'AWS::AutoScaling::AutoScalingGroup' },
  // Storage
  { type: 's3', category: 'storage', name: 'S3 Bucket', abbr: 'S3', description: 'Object storage', cost: 50, managed: true, terraform: 'aws_s3_bucket', cfn: 'AWS::S3::Bucket' },
  { type: 'ebs', category: 'storage', name: 'EBS Volume', abbr: 'EBS', description: 'Block storage', cost: 80, managed: false, terraform: 'aws_ebs_volume', cfn: 'AWS::EC2::Volume' },
  { type: 'efs', category: 'storage', name: 'EFS', abbr: 'EFS', description: 'File system', cost: 120, managed: true, terraform: 'aws_efs_file_system', cfn: 'AWS::EFS::FileSystem' },
  { type: 'backup', category: 'storage', name: 'AWS Backup', abbr: 'BKP', description: 'Backup plan', cost: 20, managed: true, terraform: 'aws_backup_plan', cfn: 'AWS::Backup::BackupPlan' },
  // Database
  { type: 'rds', category: 'database', name: 'RDS', abbr: 'RDS', description: 'Relational DB', cost: 300, managed: true, terraform: 'aws_db_instance', cfn: 'AWS::RDS::DBInstance' },
  { type: 'dynamodb', category: 'database', name: 'DynamoDB', abbr: 'DDB', description: 'NoSQL DB', cost: 100, managed: true, terraform: 'aws_dynamodb_table', cfn: 'AWS::DynamoDB::Table' },
  { type: 'elasticache', category: 'database', name: 'ElastiCache', abbr: 'EC', description: 'In-memory cache', cost: 180, managed: true, terraform: 'aws_elasticache_cluster', cfn: 'AWS::ElastiCache::CacheCluster' },
  { type: 'redshift', category: 'database', name: 'Redshift', abbr: 'RS', description: 'Data warehouse', cost: 500, managed: true, terraform: 'aws_redshift_cluster', cfn: 'AWS::Redshift::Cluster' },
  // Networking
  { type: 'vpc', category: 'networking', name: 'VPC', abbr: 'VPC', description: 'Virtual network', cost: 0, managed: true, terraform: 'aws_vpc', cfn: 'AWS::EC2::VPC' },
  { type: 'alb', category: 'networking', name: 'ALB', abbr: 'ALB', description: 'Load balancer', cost: 40, managed: true, terraform: 'aws_lb', cfn: 'AWS::ElasticLoadBalancingV2::LoadBalancer' },
  { type: 'cloudfront', category: 'networking', name: 'CloudFront', abbr: 'CF', description: 'CDN', cost: 60, managed: true, terraform: 'aws_cloudfront_distribution', cfn: 'AWS::CloudFront::Distribution' },
  { type: 'route53', category: 'networking', name: 'Route 53', abbr: 'R53', description: 'DNS', cost: 5, managed: true, terraform: 'aws_route53_zone', cfn: 'AWS::Route53::HostedZone' },
  { type: 'apigw', category: 'networking', name: 'API Gateway', abbr: 'API', description: 'API management', cost: 35, managed: true, terraform: 'aws_apigatewayv2_api', cfn: 'AWS::ApiGatewayV2::Api' },
  // Security
  { type: 'iam', category: 'security', name: 'IAM', abbr: 'IAM', description: 'Identity & access', cost: 0, managed: true, terraform: 'aws_iam_role', cfn: 'AWS::IAM::Role' },
  { type: 'waf', category: 'security', name: 'WAF', abbr: 'WAF', description: 'Web firewall', cost: 30, managed: true, terraform: 'aws_wafv2_web_acl', cfn: 'AWS::WAFv2::WebACL' },
  { type: 'kms', category: 'security', name: 'KMS', abbr: 'KMS', description: 'Key management', cost: 10, managed: true, terraform: 'aws_kms_key', cfn: 'AWS::KMS::Key' },
  { type: 'secretsmanager', category: 'security', name: 'Secrets Manager', abbr: 'SEC', description: 'Credential vault', cost: 5, managed: true, terraform: 'aws_secretsmanager_secret', cfn: 'AWS::SecretsManager::Secret' },
  // Integration
  { type: 'sqs', category: 'integration', name: 'SQS', abbr: 'SQS', description: 'Message queue', cost: 15, managed: true, terraform: 'aws_sqs_queue', cfn: 'AWS::SQS::Queue' },
  { type: 'sns', category: 'integration', name: 'SNS', abbr: 'SNS', description: 'Notifications', cost: 10, managed: true, terraform: 'aws_sns_topic', cfn: 'AWS::SNS::Topic' },
  { type: 'eventbridge', category: 'integration', name: 'EventBridge', abbr: 'EB', description: 'Event bus', cost: 20, managed: true, terraform: 'aws_cloudwatch_event_bus', cfn: 'AWS::Events::EventBus' },
  { type: 'stepfunctions', category: 'integration', name: 'Step Functions', abbr: 'SF', description: 'Workflow orchestration', cost: 30, managed: true, terraform: 'aws_sfn_state_machine', cfn: 'AWS::StepFunctions::StateMachine' },
  // Operations
  { type: 'cloudwatch', category: 'operations', name: 'CloudWatch', abbr: 'CW', description: 'Metrics, logs, alarms', cost: 15, managed: true, terraform: 'aws_cloudwatch_log_group', cfn: 'AWS::Logs::LogGroup' }
];

/** Category display order and labels for the sidebar. */
export const CATEGORIES = [
  { key: 'compute', label: 'Compute' },
  { key: 'storage', label: 'Storage' },
  { key: 'database', label: 'Database' },
  { key: 'networking', label: 'Networking' },
  { key: 'security', label: 'Security' },
  { key: 'integration', label: 'Integration' },
  { key: 'operations', label: 'Operations' }
];

const BY_TYPE = new Map(CATALOG.map((entry) => [entry.type, entry]));

/** @param {string} type @returns {CatalogEntry|undefined} */
export function getEntry(type) {
  return BY_TYPE.get(type);
}

/** @param {string} type */
export function isKnownType(type) {
  return BY_TYPE.has(type);
}

/** Service types that terminate public traffic. */
export const PUBLIC_ENTRY_TYPES = new Set(['cloudfront', 'alb', 'apigw']);

/** Service types that hold customer data at rest. */
export const DATA_STORE_TYPES = new Set(['s3', 'ebs', 'efs', 'rds', 'dynamodb', 'elasticache', 'redshift']);

/** Data stores that need database credentials. */
export const CREDENTIALED_STORE_TYPES = new Set(['rds', 'redshift', 'elasticache']);

/** Services that run application code. */
export const COMPUTE_TYPES = new Set(['ec2', 'lambda', 'ecs', 'eks']);

/** Asynchronous messaging services. */
export const MESSAGING_TYPES = new Set(['sqs', 'sns', 'eventbridge']);
