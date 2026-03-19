# Cloud Architecture Designer

An interactive, drag-and-drop cloud architecture diagramming tool for designing AWS infrastructure. Includes pre-built templates, cost estimation, and AWS Well-Architected Framework review. Single-page web application — no installation required.

## Features

### Visual Architecture Builder
- Drag-and-drop cloud service components onto an interactive canvas
- Draw connections between services (Shift+click two nodes)
- Move, select, and delete components
- Snap-to-grid alignment for clean layouts

### Component Library
- **Compute** — EC2, Lambda, ECS, EKS
- **Storage** — S3, EBS, EFS
- **Database** — RDS, DynamoDB, ElastiCache, Redshift
- **Networking** — VPC, ALB, CloudFront, Route 53, API Gateway
- **Security** — IAM, WAF, KMS
- **Integration** — SQS, SNS, EventBridge, Step Functions

### Pre-Built Templates
- **Three-Tier Web App** — Classic web architecture with load balancing and caching
- **Serverless API** — API Gateway + Lambda + DynamoDB pattern
- **Data Pipeline** — ETL workflow with S3, Lambda, SQS, and Redshift
- **Microservices** — EKS-based containerized services with message queues
- **Static Website + CDN** — S3 + CloudFront with WAF protection

### Well-Architected Review
- Automated review against AWS Well-Architected Framework pillars:
  - Reliability, Security, Performance, Cost Optimization, Operational Excellence, Sustainability
- Pass/warn/fail indicators with actionable recommendations
- Updates dynamically as components are added

### Cost Estimation
- Real-time monthly cost projection based on selected components
- Running total updates as architecture evolves

### Export
- Export architecture diagram as PNG image

## Technologies

- **HTML5 Canvas** — Interactive diagramming with drag-and-drop
- **Vanilla JavaScript** — Component management, connections, and review logic
- **CSS3** — Responsive layout with dark professional theme
- **Client-Side Only** — No server dependencies

## How to Use

1. Open `index.html` in any modern browser
2. **Drag** components from the left sidebar onto the canvas
3. **Shift+click** two components to draw a connection between them
4. **Double-click** a component to remove it
5. Select a **template** from the dropdown for a pre-built starting point
6. Click **Review Architecture** to see Well-Architected Framework analysis
7. Click **Export PNG** to save the diagram

## Use Cases

- **Solutions Architecture** — Design and communicate cloud architectures
- **Cloud Certification Study** — Practice AWS service selection and patterns
- **Technical Interviews** — Whiteboard-style architecture design exercises
- **Team Planning** — Quick architecture sketching during design sessions

## License

MIT License
