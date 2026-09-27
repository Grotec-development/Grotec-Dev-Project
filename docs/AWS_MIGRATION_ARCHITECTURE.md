# GROTEC FarmerOS — AWS Production Migration Blueprint

**Document Version:** 1.0  
**Target Architecture:** Amazon Web Services (AWS) Asia Pacific (Mumbai - `ap-south-1`)  
**Scope:** Migration of GROTEC FarmerOS Monorepo (Vite React SPA + NestJS REST API + PostgreSQL + Asynchronous Telephony Workers)

---

## 1. Executive Summary & Migration Objective

GROTEC FarmerOS is currently deployed across a modern hybrid environment:
- **Frontend SPA:** Vercel Edge Network
- **Backend API & Workers:** Containerized Docker runtime on Render
- **Database:** Supabase Managed PostgreSQL (AWS Singapore region)
- **External Providers:** Exotel IVRS / Cloud Telephony, WhatsApp Cloud API, Groq AI

This document establishes the end-to-end blueprint to transition GROTEC FarmerOS to **AWS India (Mumbai - `ap-south-1`)** following pilot client approval. Migrating to AWS India achieves:
1. **Ultra-Low Latency in India (<25ms):** CloudFront edge pops in Chennai, Bangalore, Hyderabad, and Mumbai for field agents and delivery drivers.
2. **Data Sovereignty & Compliance:** Indian farmer and agricultural transaction data stored within India's jurisdiction.
3. **Consolidated Enterprise Billing:** Single AWS account with strict IAM role separation and auditability.
4. **Predictable Scalability:** Auto-scaling containers and managed RDS failover.

---

## 2. Target AWS Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │          Users / Field Telecallers      │
                     │          (Android App & Web Client)     │
                     └────────────────────┬────────────────────┘
                                          │ HTTPS (Route 53 DNS)
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │          AWS CloudFront (CDN)           │
                     │  - SSL Termination (ACM cert *.grotec)  │
                     │  - Edge Caching (Mumbai / Chennai / BLR)│
                     └─────────┬─────────────────────┬─────────┘
        Static Asset Requests  │                     │ API Traffic (/api/v1/*)
                               ▼                     ▼
              ┌─────────────────────────┐   ┌───────────────────────────┐
              │     Amazon S3 Bucket    │   │  Application Load Balancer│
              │  (Vite React 18 SPA)    │   │           (ALB)           │
              │  - 404 SPA fallback to  │   └─────────────┬─────────────┘
              │    /index.html          │                 │ Private VPC
              └─────────────────────────┘                 ▼
                                            ┌───────────────────────────┐
                                            │ AWS ECS Fargate Cluster   │
                                            │ (NestJS REST API Tasks)   │
                                            │  - Auto-scaling (1-4 tasks│
                                            │  - Health checks: /health │
                                            │  - Outbox domain workers  │
                                            └─────────────┬─────────────┘
                                                          │ Port 5432
                                                          ▼
                                            ┌───────────────────────────┐
                                            │ AWS RDS PostgreSQL (gp3)  │
                                            │  - Multi-AZ (Active/Stand)│
                                            │  - Automated daily backups│
                                            │  - Parameter groups tuned │
                                            └───────────────────────────┘
```

---

## 3. Component-by-Component AWS Mapping

| Current Layer | Current Service | Target AWS Service | AWS Sizing & Configuration |
| :--- | :--- | :--- | :--- |
| **Domain & DNS** | Cloudflare / Vercel DNS | **Amazon Route 53** | Latency-based routing, ACM alias records |
| **SSL / TLS** | Let's Encrypt / Vercel SSL | **AWS Certificate Manager (ACM)** | Free wildcard certificate `*.grotec.in` with auto-renewal |
| **Frontend CDN** | Vercel CDN | **CloudFront + Amazon S3** | S3 Private bucket with Origin Access Control (OAC), Gzip/Brotli compression, custom 404 rewrite to `/index.html` |
| **Backend API** | Render Web Service | **AWS ECS Fargate** (or **AWS App Runner**) | 0.5 vCPU / 1 GB RAM per task, container images stored in Amazon ECR |
| **Database** | Supabase Postgres (Singapore) | **Amazon RDS PostgreSQL 16** | `db.t4g.small` (2 vCPU, 2GB RAM), Multi-AZ, 50 GB gp3 SSD with auto-scaling to 200 GB |
| **Secrets & Env** | `.env` / Render Secrets | **AWS Systems Manager Parameter Store** | SecureString encrypted with AWS KMS (`/grotec/prod/*`) |
| **File Storage** | Local / Ephemeral | **Amazon S3 (Media Bucket)** | POD signatures, delivery photos, farmer invoices with presigned URLs |
| **Logging & Metrics** | Render console | **Amazon CloudWatch Logs** | Centralized application logs with 30-day retention and error alarms |

---

## 4. Cost Estimation (INR & USD)

### Option 1: Pilot / Production Tier (Cost-Optimized for Handover)
*Recommended for initial launch and pilot (10–50 concurrent users)*

- **AWS CloudFront & S3:** ₹150 / mo (~$1.80)
- **AWS App Runner (or ECS Fargate 1 task):** ₹1,800 / mo (~$21.50)
- **AWS RDS PostgreSQL (`db.t4g.micro` / `db.t4g.small` Single-AZ):** ₹1,600 / mo (~$19.20)
- **AWS Route 53 (1 Hosted Zone):** ₹42 / mo (~$0.50)
- **CloudWatch & KMS:** ₹250 / mo (~$3.00)
- **Total Estimated Cost:** **~₹3,842 / month (~$46.00 / month)**

### Option 2: Enterprise High-Availability Tier (Scale-Out Phase)
*Recommended for full commercial rollout (100+ telecallers, full factory operations)*

- **AWS CloudFront & S3:** ₹450 / mo (~$5.40)
- **Application Load Balancer (ALB):** ₹1,800 / mo (~$21.50)
- **ECS Fargate (2 Tasks Multi-AZ):** ₹3,600 / mo (~$43.00)
- **AWS RDS PostgreSQL (`db.t4g.small` Multi-AZ):** ₹3,200 / mo (~$38.40)
- **Total Estimated Cost:** **~₹9,050 / month (~$108.00 / month)**

---

## 5. Step-by-Step Migration Execution Plan

### Phase 1: AWS Foundation & Networking
1. Create AWS VPC in `ap-south-1` with 2 Public Subnets and 2 Private Subnets.
2. Configure Internet Gateway (IGW) for public subnets and NAT Gateway for private subnets.
3. Establish Security Groups:
   - `sg-alb`: Allow HTTP/HTTPS (80/443) from `0.0.0.0/0`.
   - `sg-backend`: Allow port 3000 only from `sg-alb`.
   - `sg-database`: Allow port 5432 only from `sg-backend`.

### Phase 2: Database Provisioning & Data Migration
1. Launch RDS PostgreSQL 16 instance inside private database subnets.
2. Extract existing Supabase database snapshot preserving all 5,011 customers, role permissions, and attendance logs:
   ```bash
   pg_dump --clean --if-exists --no-owner --no-privileges -d "$SUPABASE_DATABASE_URL" -f grotec_backup.sql
   ```
3. Restore into AWS RDS instance:
   ```bash
   psql -d "$AWS_RDS_DATABASE_URL" -f grotec_backup.sql
   ```
4. Verify table row counts:
   ```sql
   SELECT count(*) FROM "Customer"; -- Should be 5,011
   SELECT count(*) FROM "Employee"; -- Should be 18
   ```

### Phase 3: Backend Containerization & ECR Deployment
1. Authenticate with Amazon Elastic Container Registry (ECR):
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com
   ```
2. Build and push backend Docker image:
   ```bash
   docker build -t grotec-backend -f backend/Dockerfile .
   docker tag grotec-backend:latest <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/grotec-backend:latest
   docker push <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/grotec-backend:latest
   ```
3. Deploy to ECS Fargate task with environment variables pulled from AWS Systems Manager.

### Phase 4: Frontend Build & S3 / CloudFront Deployment
1. Build production React SPA bundle:
   ```bash
   npm run build:shared && npm run build --workspace @grotec/frontend
   ```
2. Sync `dist/` directory to AWS S3:
   ```bash
   aws s3 sync frontend/dist/ s3://grotec-app-frontend/ --delete
   ```
3. Create CloudFront distribution pointing to S3 origin with fallback error responses:
   - HTTP Error Code: `404` -> Response Page Path: `/index.html` -> HTTP Response Code: `200`.
4. Invalidate CloudFront cache:
   ```bash
   aws cloudfront create-invalidation --distribution-id <dist_id> --paths "/*"
   ```

### Phase 5: DNS Switch & Zero-Downtime Cutover
1. Point `api.grotec.in` to the ALB DNS name via Route 53 Alias record.
2. Point `app.grotec.in` (and root `grotec.in`) to the CloudFront distribution.
3. Validate health checks on `https://api.grotec.in/api/v1/health` (HTTP 200).
4. Run full site regression audit suite:
   ```bash
   npx vitest run src/qa-comprehensive-route-audit.spec.js
   ```
