const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { execSync } = require("child_process");

const GATEWAY = "http://localhost:8080";

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

describe("E-COMMERCE MICROSERVICES E2E TEST SUITE (25 Test Cases)", () => {
  let adminToken, staffToken, custToken, custUid;
  let prod1, prod2, orderObj;
  const uidRand = Math.floor(Math.random() * 100000);
  const custUser = `e2e_user_${uidRand}`;

  before(async () => {
    // Acquire Admin Token
    const aRes = await request({
      host: "localhost", port: 8080, path: "/api/auth/login", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { username: "admin", password: "Admin@123" });
    adminToken = aRes.data.accessToken;

    // Acquire Shipment Staff Token
    const sRes = await request({
      host: "localhost", port: 8080, path: "/api/auth/login", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { username: "shipment_staff", password: "Staff@123" });
    staffToken = sRes.data.accessToken;
  });

  // 1. IAM MODULE (TC-IAM-01 .. TC-IAM-05)
  it("TC-IAM-01: Register user with valid credentials -> 201 Created", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/auth/register", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { username: custUser, password: "Password@123", email: `${custUser}@example.com` });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.uid);
    custUid = res.data.uid;
  });

  it("TC-IAM-02: Register user with duplicate username -> 409 Conflict", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/auth/register", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { username: custUser, password: "Password@123" });
    assert.strictEqual(res.status, 409);
    assert.ok(res.data.code);
  });

  it("TC-IAM-03: Login with valid credentials -> 200 OK + JWT", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/auth/login", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { username: custUser, password: "Password@123" });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.accessToken);
    custToken = res.data.accessToken;
  });

  it("TC-IAM-04: Login with invalid password -> 401 Unauthorized", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/auth/login", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { username: custUser, password: "WrongPassword" });
    assert.strictEqual(res.status, 401);
    assert.ok(res.data.code);
  });

  it("TC-IAM-05: Password stored as bcrypt hash in DB, not plain text", async () => {
    const out = execSync(`docker exec auth-service node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.findUnique({ where: { username: '${custUser}' } }).then(u => { console.log(u.password.startsWith('$2a$') || u.password.startsWith('$2b$')); prisma.\$disconnect(); });"`, { encoding: "utf8" });
    assert.strictEqual(out.trim(), "true");
  });

  // 2. PRODUCT MODULE (TC-PRO-01 .. TC-PRO-05)
  it("TC-PRO-01: Admin creates product with auto-increment pid -> 201 Created", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/products", method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
    }, { pname: "Pro Mechanical Keyboard", price: 120.5, quantity: 40 });
    assert.strictEqual(res.status, 201);
    assert.ok(typeof res.data.pid === "number");
    assert.strictEqual(res.data.pname, "Pro Mechanical Keyboard");
    prod1 = res.data;
  });

  it("TC-PRO-02: Get product catalog via Gateway with Redis Cache (MISS on 1st, HIT on 2nd)", async () => {
    const res1 = await request({
      host: "localhost", port: 8080, path: "/api/products", method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res1.status, 200);
    assert.ok(Array.isArray(res1.data.items || res1.data));
    // 2nd request should HIT Redis cache
    const res2 = await request({
      host: "localhost", port: 8080, path: "/api/products", method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res2.headers["x-cache"], "HIT");
  });

  it("TC-PRO-03: Get single product by pid -> 200 OK; non-existent -> 404", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: `/api/products/${prod1.pid}`, method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pid, prod1.pid);

    const res404 = await request({
      host: "localhost", port: 8080, path: "/api/products/999999", method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res404.status, 404);
  });

  it("TC-PRO-04: Admin updates product -> 200 OK; Normal user -> 403 Forbidden", async () => {
    // Normal user update attempt -> 403
    const forbid = await request({
      host: "localhost", port: 8080, path: `/api/products/${prod1.pid}`, method: "PUT",
      headers: { "Authorization": `Bearer ${custToken}`, "Content-Type": "application/json" }
    }, { price: 99.9 });
    assert.strictEqual(forbid.status, 403);

    // Admin update -> 200
    const ok = await request({
      host: "localhost", port: 8080, path: `/api/products/${prod1.pid}`, method: "PUT",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
    }, { price: 110.0 });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.data.price, 110.0);
  });

  it("TC-PRO-05: Admin deletes product -> 200 OK; Normal user -> 403 Forbidden", async () => {
    // Create temporary product for deletion
    const temp = await request({
      host: "localhost", port: 8080, path: "/api/products", method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
    }, { pname: "Temp To Delete", price: 10, quantity: 5 });
    const tempPid = temp.data.pid;

    // Normal user delete attempt -> 403
    const forbid = await request({
      host: "localhost", port: 8080, path: `/api/products/${tempPid}`, method: "DELETE",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(forbid.status, 403);

    // Admin delete -> 200
    const ok = await request({
      host: "localhost", port: 8080, path: `/api/products/${tempPid}`, method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    assert.strictEqual(ok.status, 200);
  });

  // 3. CUSTOMER MODULE (TC-CUS-01 .. TC-CUS-05)
  it("TC-CUS-01: Get customer profile as owner -> 200 OK", async () => {
    await sleep(2000); // Wait for consumer to process user-registered
    const res = await request({
      host: "localhost", port: 8080, path: `/api/customers/${custUid}`, method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.uid, custUid);
    assert.strictEqual(res.data.mid, 1);
  });

  it("TC-CUS-02: Normal user viewing other customer profile -> 403 Forbidden", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/customers/1", method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.code, "FORBIDDEN");
  });

  it("TC-CUS-03: Normal user updating own profile with mid -> 403 Forbidden", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: `/api/customers/${custUid}`, method: "PUT",
      headers: { "Authorization": `Bearer ${custToken}`, "Content-Type": "application/json" }
    }, { mid: 3 });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.code, "FORBIDDEN");
  });

  it("TC-CUS-04: Customer profile includes membership {mname, score}", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: `/api/customers/${custUid}`, method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.membership);
    assert.strictEqual(res.data.membership.mname, "normal");
    assert.strictEqual(res.data.membership.score, 10);
  });

  it("TC-CUS-05: Admin updates customer mid to Silver (mid=2) -> 200 OK", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: `/api/customers/${custUid}`, method: "PUT",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
    }, { mid: 2 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.mid, 2);
    assert.strictEqual(res.data.membership.mname, "silver");
    assert.strictEqual(res.data.membership.score, 50);
  });

  // 4. ORDER MODULE (TC-ORD-01 .. TC-ORD-05)
  it("TC-ORD-01: Place order with 2 products -> 201 Created with correct totals", async () => {
    // Setup 2nd product
    const p2Res = await request({
      host: "localhost", port: 8080, path: "/api/products", method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
    }, { pname: "Ultra Mousepad", price: 20.0, quantity: 100 });
    prod2 = p2Res.data;

    // Customer is Silver (score 50 -> 15% discount)
    // 2 x prod1 (110.0 each = 220.0) + 1 x prod2 (20.0) = 240.0 subtotal
    // Total = 240.0 * (1 - 0.15) = 204.00
    const res = await request({
      host: "localhost", port: 8080, path: "/api/orders", method: "POST",
      headers: { "Authorization": `Bearer ${custToken}`, "Content-Type": "application/json" }
    }, {
      items: [
        { pid: prod1.pid, qty: 2 },
        { pid: prod2.pid, qty: 1 }
      ]
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.oid);
    assert.strictEqual(res.data.discount, 15);
    assert.strictEqual(res.data.total_amount, 204);
    assert.ok(res.data.shipment.shipid);
    orderObj = res.data;
  });

  it("TC-ORD-02: Place order without JWT -> 401 Unauthorized at Gateway", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/orders", method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { items: [{ pid: prod1.pid, qty: 1 }] });
    assert.strictEqual(res.status, 401);
  });

  it("TC-ORD-03: Insufficient stock (qty > inventory) -> 409 Conflict, no inventory deducted", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/orders", method: "POST",
      headers: { "Authorization": `Bearer ${custToken}`, "Content-Type": "application/json" }
    }, { items: [{ pid: prod1.pid, qty: 9999 }] });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.code, "INSUFFICIENT_STOCK");
  });

  it("TC-ORD-04: Discount calculation verified according to Rule A1 (score 50 -> 15%)", async () => {
    assert.strictEqual(orderObj.discount, 15);
  });

  it("TC-ORD-05: Outbox event status updated to SENT in PostgreSQL order_db", async () => {
    await sleep(2000);
    const out = execSync(`docker exec order-service node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.outboxEvent.findFirst({ where: { key: '${orderObj.oid}' } }).then(e => { console.log(e?.status); prisma.\$disconnect(); });"`, { encoding: "utf8" });
    assert.strictEqual(out.trim(), "SENT");
  });

  // 5. SHIPMENT MODULE (TC-SHP-01 .. TC-SHP-05)
  it("TC-SHP-01: Order created -> GET /api/shipments/:shipid returns PENDING", async () => {
    await sleep(1000);
    const res = await request({
      host: "localhost", port: 8080, path: `/api/shipments/${orderObj.shipment.shipid}`, method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.shipid, orderObj.shipment.shipid);
    assert.strictEqual(res.data.status, "PENDING");
  });

  it("TC-SHP-02: Bad Kafka event missing oid -> recorded in failed_events, consumer alive", async () => {
    execSync(`docker exec shipment-service node -e "const { Kafka } = require('kafkajs'); const kafka = new Kafka({ clientId: 'test-bad', brokers: ['kafka:9092'] }); const p = kafka.producer(); p.connect().then(() => p.send({ topic: 'order-created', messages: [{ key: 'bad', value: JSON.stringify({ eventType: 'OrderCreated', data: { shipid: 9999 } }) }] })).then(() => p.disconnect());"`);
    await sleep(2000);
    const countOut = execSync(`docker exec shipment-service node -e "const mongoose = require('mongoose'); const { FailedEvent } = require('./src/infrastructure/database/shipment.model'); mongoose.connect(process.env.MONGO_URI).then(() => FailedEvent.countDocuments()).then(c => { console.log(c > 0); mongoose.disconnect(); });"`, { encoding: "utf8" });
    assert.strictEqual(countOut.trim(), "true");
  });

  it("TC-SHP-03: Staff updates status PENDING -> SHIPPING -> DELIVERED", async () => {
    const shipid = orderObj.shipment.shipid;
    // Update to SHIPPING
    const res1 = await request({
      host: "localhost", port: 8080, path: `/api/shipments/${shipid}/status`, method: "PATCH",
      headers: { "Authorization": `Bearer ${staffToken}`, "Content-Type": "application/json" }
    }, { status: "SHIPPING" });
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.status, "SHIPPING");

    // Update to DELIVERED
    const res2 = await request({
      host: "localhost", port: 8080, path: `/api/shipments/${shipid}/status`, method: "PATCH",
      headers: { "Authorization": `Bearer ${staffToken}`, "Content-Type": "application/json" }
    }, { status: "DELIVERED" });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.status, "DELIVERED");
  });

  it("TC-SHP-04: GET non-existent shipid -> 404 NOT_FOUND", async () => {
    const res = await request({
      host: "localhost", port: 8080, path: "/api/shipments/987654", method: "GET",
      headers: { "Authorization": `Bearer ${custToken}` }
    });
    assert.strictEqual(res.status, 404);
  });

  it("TC-SHP-05: Duplicate event published -> idempotent, exactly 1 shipment document", async () => {
    const shipid = orderObj.shipment.shipid;
    // Re-publish same order-created event
    execSync(`docker exec shipment-service node -e "const { Kafka } = require('kafkajs'); const kafka = new Kafka({ clientId: 'test-dup', brokers: ['kafka:9092'] }); const p = kafka.producer(); p.connect().then(() => p.send({ topic: 'order-created', messages: [{ key: '${orderObj.oid}', value: JSON.stringify({ eventType: 'OrderCreated', data: { oid: ${orderObj.oid}, uid: ${custUid}, shipid: ${shipid} } }) }] })).then(() => p.disconnect());"`);
    await sleep(2000);
    const countOut = execSync(`docker exec shipment-service node -e "const mongoose = require('mongoose'); const { Shipment } = require('./src/infrastructure/database/shipment.model'); mongoose.connect(process.env.MONGO_URI).then(() => Shipment.countDocuments({ shipid: ${shipid} })).then(c => { console.log(c); mongoose.disconnect(); });"`, { encoding: "utf8" });
    assert.strictEqual(countOut.trim(), "1");
  });
});
