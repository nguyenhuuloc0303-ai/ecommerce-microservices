# E-commerce Microservices MVP · IUH Bài Tập Lớn 3

Hệ thống kiến trúc vi dịch vụ thương mại điện tử (E-commerce Microservices) chuẩn Domain-Driven Design (DDD), Database-per-Service, Event-Driven Architecture (Apache Kafka), gRPC high-performance inter-service communication, API Gateway với Redis Rate Limiting & Caching, và Transactional Outbox Pattern.

Hệ sinh thái chuẩn 10 container tối ưu, đáp ứng trọn vẹn 8 tiêu chí chấm thực hành theo `PHIEU_CHAM.pdf`.

---

## 🚀 Khởi chạy hệ thống trong 3 bước

```bash
# Bước 1: Clone repo hoặc cd vào thư mục dự án
cd ecommerce-microservices


# Bước 3: Khởi động toàn bộ 10 container
docker compose up -d --build
```

Kiểm tra trạng thái hệ thống:
```bash
curl http://localhost:8080/api/health
docker ps
```

Chạy toàn bộ 25 bài test tự động (Unit + E2E):
```bash
npm run ci
# hoặc: node scripts/ci.js
```

---

## 🏛️ Danh mục 10 Container & Cổng dịch vụ

| STT | Container | Dịch vụ | Cổng HTTP | Cổng gRPC / DB | Database |
|---|---|---|---|---|---|
| 1 | `api-gateway` | API Gateway (Reverse Proxy + Redis Cache + RBAC + Rate Limit) | 8080 | — | Redis (Cache) |
| 2 | `auth-service` | Identity & Access Management (BCrypt + JWT + Outbox) | 3001 | — | PostgreSQL (`auth_db`) |
| 3 | `customer-service` | Customer & Membership Tier Service | 3002 | 50052 | PostgreSQL (`customer_db`) |
| 4 | `product-service` | Product Catalog & Inventory Service | 3003 | 50053 | MongoDB (`product_db`) |
| 5 | `order-service` | Order Management & Discount Policy (Outbox) | 3004 | — | PostgreSQL (`order_db`) |
| 6 | `shipment-service` | Shipment & Tracking State Machine (Consumer) | 3005 | — | MongoDB (`shipment_db`) |
| 7 | `postgres` | PostgreSQL 16 (3 logical DBs cách ly hoàn toàn) | — | 5432 | Postgres Engine |
| 8 | `mongo` | MongoDB 7 (2 logical DBs cách ly hoàn toàn) | — | 27017 | Mongo Engine |
| 9 | `redis` | Redis 7 Alpine (Fixed-window Rate Limit & Product Cache) | — | 6379 | In-memory K/V |
| 10 | `kafka` | Apache Kafka 3.9 KRaft (Event Broker: `user-registered`, `order-created`) | — | 9092 | Event Log |

---

## 📚 Tài liệu chi tiết
- **Kiến trúc hệ thống & Trả lời vấn đáp:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Kịch bản Demo thi vấn đáp theo Phiếu chấm:** [`docs/DEMO.md`](./docs/DEMO.md)
- **Postman Collection demo tự động:** [`docs/postman_collection.json`](./docs/postman_collection.json)
