# RUNBOOK DEMO THI THỰC HÀNH & VẤN ĐÁP
## Ánh xạ trực tiếp 8 Tiêu chí trong PHIEU_CHAM.pdf

Runbook này hướng dẫn từng thao tác cụ thể, lệnh CLI và kiểm tra dữ liệu tương ứng với 8 mục trên phiếu chấm thi thực hành của Trường ĐH Công nghiệp TP.HCM (IUH).

---

### TIÊU CHÍ 1: Git, .gitignore và Bảo mật Biến môi trường
- **Mục tiêu:** Chứng minh repo không track file `.env`, tuân thủ bí mật cấu hình.
- **Thao tác:**
  ```bash
  git status
  git log -p | grep "DATABASE_URL"
  ```
- **Giải thích:** File `.gitignore` đã cấu hình chặn nghiêm ngặt `.env`. Dự án chỉ chia sẻ `.env.example` chứa các biến mẫu không chứa secret thực tế.

---

### TIÊU CHÍ 2: Docker Compose & Healthcheck 10 Container
- **Mục tiêu:** Khởi động hệ thống sạch và chứng minh 10/10 container hoạt động khỏe mạnh.
- **Thao tác:**
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
  docker ps
  curl http://localhost:8080/api/health
  docker stats --no-stream
  ```
- **Bằng chứng:** Tất cả 10 container hiển thị `(healthy)`. `/api/health` trả về trạng thái `UP` cho tất cả downstream services, PostgreSQL, MongoDB, Redis và Kafka. Tổng RAM đo thực tế < 900 MB.

---

### TIÊU CHÍ 3: Quản lý Sản phẩm (MongoDB & Redis Cache)
- **Mục tiêu:** Thêm sản phẩm bằng quyền Admin, xem dữ liệu trên MongoDB và cache trên Redis.
- **Thao tác:**
  ```bash
  # 1. Đăng nhập Admin lấy Token
  curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d "{"username":"admin","password":"Admin@123"}"

  # 2. Tạo sản phẩm mới
  curl -X POST http://localhost:8080/api/products -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d "{"pname":"Ban phim co RGB","price":250.0,"quantity":100}"

  # 3. Kiểm tra dữ liệu trong MongoDB
  docker exec -it mongo mongosh -u product_user -p product_pass --authenticationDatabase product_db --eval "use product_db; db.products.find({pname:'Ban phim co RGB'}).pretty()"

  # 4. Kiểm tra Redis Cache qua Gateway
  curl -i http://localhost:8080/api/products -H "Authorization: Bearer <ADMIN_TOKEN>"
  # Lần 1: X-Cache: MISS -> Lần 2: X-Cache: HIT
  ```

---

### TIÊU CHÍ 4: Đăng ký Khách hàng & Tích hợp Sự kiện Kafka
- **Mục tiêu:** Đăng ký tài khoản người dùng -> Auth Service xuất sự kiện -> Customer Service tự tạo hồ sơ khách hàng.
- **Thao tác:**
  ```bash
  # 1. Đăng ký khách hàng mới
  curl -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d "{"username":"sinhvien01","password":"MatKhau@123","email":"sv01@iuh.edu.vn"}"

  # 2. Đăng nhập lấy JWT khách hàng
  curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d "{"username":"sinhvien01","password":"MatKhau@123"}"

  # 3. Tra cứu thông tin khách hàng qua Gateway
  curl -X GET http://localhost:8080/api/customers/<UID> -H "Authorization: Bearer <TOKEN_KHACH_HANG>"
  # Trả về: fullname: "sinhvien01", mid: 1, membership: { mname: "normal", score: 10 }
  ```

---

### TIÊU CHÍ 5: Đặt hàng Đa Sản phẩm & Giao tiếp gRPC
- **Mục tiêu:** Đặt đơn 2 sản phẩm -> Order Service gọi gRPC tính discount, trừ tồn kho nguyên tử -> Cấp shipid -> Lưu Order + OrderDetail.
- **Thao tác:**
  ```bash
  # 1. Đặt hàng qua Gateway
  curl -X POST http://localhost:8080/api/orders -H "Authorization: Bearer <TOKEN_KHACH_HANG>" -H "Content-Type: application/json" -d "{"items":[{"pid":1,"qty":2},{"pid":2,"qty":1}]}"
  # Trả về: 201 Created với oid (1001), shipid (5001), discount (10%), total_amount, shipment: { status: "PENDING" }

  # 2. Kiểm tra dữ liệu PostgreSQL trong order_db
  docker exec -it postgres psql -U order_user -d order_db -c "SELECT * FROM "Order"; SELECT * FROM "OrderDetail";"
  ```

---

### TIÊU CHÍ 6: Xử lý Vận chuyển Bất đồng bộ (Shipment Service)
- **Mục tiêu:** Order Service đẩy Outbox -> Kafka topic `order-created` -> Shipment Service tự tạo đơn giao vận với trạng thái `PENDING`.
- **Thao tác:**
  ```bash
  # 1. Tra cứu shipment bằng shipid được cấp
  curl -X GET http://localhost:8080/api/shipments/5001 -H "Authorization: Bearer <TOKEN_KHACH_HANG>"
  # Trả về status: PENDING, history: [{ status: "PENDING" }]

  # 2. Đăng nhập Shipment Staff cập nhật trạng thái sang SHIPPING
  curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d "{"username":"shipment_staff","password":"Staff@123"}"

  curl -X PATCH http://localhost:8080/api/shipments/5001/status -H "Authorization: Bearer <STAFF_TOKEN>" -H "Content-Type: application/json" -d "{"status":"SHIPPING"}"

  # 3. Chuyển tiếp sang DELIVERED
  curl -X PATCH http://localhost:8080/api/shipments/5001/status -H "Authorization: Bearer <STAFF_TOKEN>" -H "Content-Type: application/json" -d "{"status":"DELIVERED"}"

  # 4. Thử chuyển DELIVERED -> PENDING (Thử vi phạm Rule A8)
  curl -X PATCH http://localhost:8080/api/shipments/5001/status -H "Authorization: Bearer <STAFF_TOKEN>" -H "Content-Type: application/json" -d "{"status":"PENDING"}"
  # Trả về: HTTP 400 INVALID_STATE_TRANSITION
  ```

---

### TIÊU CHÍ 7: Kiểm thử Khả năng Phục hồi (Resilience & Chaos)
- **Mục tiêu:** Chứng minh hệ thống không sập khi broker hoặc database phụ bị ngắt quãng.
- **Thao tác:**
  ```bash
  # 1. Tắt Kafka:
  docker stop kafka
  # Đặt hàng vẫn thành công 201 Created (Outbox lưu trạng thái PENDING)
  # Khởi động lại Kafka:
  docker start kafka
  # Sau vài giây, Outbox worker tự động đẩy sang Kafka -> chuyển status thành SENT!
  ```

---

### TIÊU CHÍ 8: Chạy Toàn bộ Bộ Test Tự động CI / CD (25 Test Cases)
- **Mục tiêu:** Chạy tự động trọn gói 25 test cases trong 1 lệnh duy nhất.
- **Thao tác:**
  ```bash
  node scripts/ci.js
  ```
- **Kết quả:** Báo cáo 25/25 test cases đạt kết quả PASS (100%), exit code 0.
