# E-Commerce Microservices System

A production-grade microservices architecture for an e-commerce platform built with Domain-Driven Design (DDD), Database-per-Service pattern, Event-Driven messaging via Apache Kafka, high-performance inter-service communication via gRPC, and an API Gateway with Redis caching & rate limiting.

---

## Architecture Overview

- **Architecture Style**: Microservices, Event-Driven Architecture.
- **Service Communication**:
  - External: REST APIs through API Gateway (`:8080`).
  - Synchronous Internal: gRPC (Protobuf v3) for stock reservations and membership queries.
  - Asynchronous Internal: Apache Kafka (KRaft mode) for transactional event publishing.
- **Data Persistence**:
  - PostgreSQL 16 (Logical isolation: `auth_db`, `customer_db`, `order_db`).
  - MongoDB 7.0 (Logical isolation: `product_db`, `shipment_db`).
  - Redis 7 (Fixed-window rate limiting & product catalog caching).
- **Reliability & Consistency**: Transactional Outbox Pattern with polling publisher and idempotency safeguards.

---

## Services & Ports Directory

| Container | Service Name | HTTP Port | Internal / gRPC | Primary Datastore |
|---|---|---|---|---|
| `api-gateway` | API Gateway (Proxy, Cache, Rate Limit, RBAC) | `8080` | — | Redis (Cache & Limiter) |
| `auth-service` | IAM Service (BCrypt, JWT, Outbox) | `3001` | — | PostgreSQL (`auth_db`) |
| `customer-service` | Customer & Membership Service | `3002` | `50052` (gRPC) | PostgreSQL (`customer_db`) |
| `product-service` | Product Catalog & Inventory Service | `3003` | `50053` (gRPC) | MongoDB (`product_db`) |
| `order-service` | Order Management & Discount Engine | `3004` | — | PostgreSQL (`order_db`) |
| `shipment-service` | Shipment & Tracking State Machine | `3005` | — | MongoDB (`shipment_db`) |
| `postgres` | PostgreSQL 16 Relational Engine | — | `5432` | PostgreSQL Engine |
| `mongo` | MongoDB 7 NoSQL Engine | — | `27017` | MongoDB Engine |
| `redis` | Redis In-Memory Store | — | `6379` | In-memory Cache |
| `kafka` | Apache Kafka 3.9 Event Broker | — | `9092` | Event Log |

---

## Quickstart

### 1. Start All Containers
```bash
docker compose up -d --build
```

### 2. Verify System Health
```bash
curl http://localhost:8080/api/health
docker ps
```

### 3. Seed Initial Catalog Data
```bash
node scripts/seed.js
```

### 4. Run Automated CI / Test Suite
```bash
node scripts/ci.js
```
