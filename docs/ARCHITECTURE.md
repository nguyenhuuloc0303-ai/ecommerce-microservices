# ARCHITECTURE & ORAL EXAM GUIDE
## Kiến trúc Vi dịch vụ Thương mại Điện tử (IUH)

Tài liệu này cung cấp giải thích kiến trúc chi tiết, giải đáp các câu hỏi vấn đáp trọng tâm, và phân tích các mẫu thiết kế (Design Patterns) đã triển khai.

---

### 1. Phân chia Bounded Contexts (DDD)

Hệ thống được chia thành 5 Bounded Contexts độc lập theo chuẩn Domain-Driven Design:
1. **Identity & Access Management (IAM - Auth Service):**
   - Quản lý định danh người dùng (`User`, `Role`).
   - Mã hóa mật khẩu bằng BCrypt (`$2a$10$...`), không lưu password thô.
   - Phát hành JSON Web Token (JWT) có chữ ký số bí mật (`JWT_SECRET`).
   - Ghi nhận sự kiện người dùng đăng ký vào Transactional Outbox.
2. **Customer & Membership Context (Customer Service):**
   - Quản lý hồ sơ khách hàng và hạng thành viên (`MemberShip`: normal, silver, gold).
   - Lắng nghe Kafka topic `user-registered` để tự động đồng bộ khách hàng.
   - Cung cấp gRPC endpoint `GetCustomerMembership` phục vụ tra cứu điểm xếp hạng tốc độ cao.
3. **Product Catalog & Inventory Context (Product Service):**
   - Quản lý danh mục sản phẩm trên MongoDB với mã `pid` số nguyên tự tăng (`counters`).
   - Cung cấp gRPC server (`:50053`) với cơ chế `ReserveStock` (giữ hàng all-or-nothing nguyên tử) và `ReleaseStock` (bù trừ hoàn kho).
4. **Order Context (Order Service - Trọng tâm luồng đặt hàng):**
   - Nhận yêu cầu đặt hàng qua Gateway (`x-user-id`).
   - Gọi gRPC sang Customer Service lấy điểm thành viên -> tính `discount` bằng `DiscountPolicy` (A1).
   - Gọi gRPC sang Product Service giữ kho (`ReserveStock`).
   - Cấp trước mã vận chuyển `shipid` từ sequence PostgreSQL (`shipment_id_seq` từ 5001).
   - Thực thi Transaction nội bộ: lưu `Order`, `OrderDetail` (khóa chính kép `oid, pid`) và `OutboxEvent`.
   - Nếu lỗi DB: tự động kích hoạt giao dịch bù trừ `ReleaseStock` để bảo toàn tồn kho.
5. **Shipment & Tracking Context (Shipment Service):**
   - Lắng nghe sự kiện `order-created` từ Kafka.
   - Lưu trữ thông tin giao vận và lịch sử hành trình (`history`) trên MongoDB `shipment_db`.
   - Máy trạng thái hữu hạn (Finite State Machine) kiểm soát quá trình chuyển trạng thái theo Rule A8.

---

### 2. Mô hình Giao tiếp (Communication Patterns)

1. **Đồng bộ qua gRPC (Inter-Service Synchronous):**
   - Tại sao dùng gRPC giữa Order -> Product và Order -> Customer?
     - Hiệu năng cực cao nhờ giao thức HTTP/2 đa kênh (multiplexing) và binary serialization (Protocol Buffers).
     - Hợp đồng giao tiếp (Contract) chặt chẽ qua file `.proto`, tránh lỗi format dữ liệu.
     - Tích hợp sẵn Deadline/Timeout (3000ms) chống treo luồng khi dịch vụ downstream nghẽn.
2. **Bất đồng bộ qua Apache Kafka (Event-Driven Asynchronous):**
   - Giao tiếp giữa Auth -> Customer (`user-registered`) và Order -> Shipment (`order-created`).
   - Đảm bảo tính lỏng (Loose Coupling): Order Service tạo đơn thành công mà không cần chờ Shipment Service xử lý xong.
   - Khả năng chịu lỗi (Resilience): Nếu Shipment Service tạm thời offline, message vẫn an toàn trên Kafka broker và được xử lý ngay khi service online trở lại.
3. **Transactional Outbox Pattern (Chống mất mát sự kiện):**
   - Vấn đề: Nếu ghi DB thành công nhưng publish Kafka thất bại (network partition), sự kiện sẽ biến mất vĩnh viễn (Dual-write problem).
   - Giải pháp: Outbox Pattern lưu `OutboxEvent` chung trong một Transaction nguyên tử với `Order`. Một background worker định kỳ đọc các sự kiện `PENDING` đẩy lên Kafka và đánh dấu `SENT`.

---

### 3. Cách ly Dữ liệu (Database Isolation)

- **PostgreSQL (1 container - 3 logical databases độc lập):**
  - `auth_db`: chỉ gán quyền cho `auth_user`.
  - `customer_db`: chỉ gán quyền cho `customer_user`.
  - `order_db`: chỉ gán quyền cho `order_user`.
  - DoD đã kiểm chứng: `auth_user` kết nối vào `order_db` bị PostgreSQL từ chối lập tức (`FATAL: permission denied for database "order_db"`).
- **MongoDB (1 container - 2 logical databases độc lập):**
  - `product_db`: tài khoản `product_user` có quyền readWrite.
  - `shipment_db`: tài khoản `shipment_user` có quyền readWrite.

---

### 4. Chiến lược API Gateway & Bảo mật

1. **Xác thực & Ủy quyền (Authentication & RBAC):**
   - Kiểm tra JWT trên mọi route được bảo vệ.
   - Chặn đứng Spoofing Header: xóa sạch `x-user-id` và `x-user-role` do client tự gửi trước khi inject thông tin từ JWT đã verify.
2. **Rate Limiting:**
   - Dùng Redis Fixed Window counter.
   - Global: 100 requests / phút / IP.
   - Auth endpoints: 10 requests / phút / IP (chống Brute-force).
   - Vượt ngưỡng trả HTTP 429 kèm header `Retry-After`.
   - Cơ chế Fail-open: Khi Redis gặp sự cố, Gateway ghi cảnh báo nhưng vẫn route request để không làm tê liệt hệ thống.
3. **Redis Product Cache:**
   - `GET /api/products` được cache với TTL 30 giây.
   - Trả header `X-Cache: HIT` khi trúng cache và `X-Cache: MISS` khi đọc database.
   - Tự động xóa cache (Invalidation) ngay khi có request POST, PUT, DELETE sản phẩm.
