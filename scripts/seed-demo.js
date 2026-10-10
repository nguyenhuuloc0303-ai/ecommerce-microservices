const http = require("http");

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function seed() {
  console.log(">>> Seeding demo data for practical exam presentation...");

  // 1. Admin login
  const loginRes = await request({
    host: "localhost", port: 8080, path: "/api/auth/login", method: "POST",
    headers: { "Content-Type": "application/json" }
  }, { username: "admin", password: "Admin@123" });
  const adminToken = loginRes.data.accessToken;
  console.log("Admin token acquired");

  // 2. Create standard products X and Y according to PHIEU_CHAM
  const pX = await request({
    host: "localhost", port: 8080, path: "/api/products", method: "POST",
    headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
  }, { pname: "Product X", price: 150.0, quantity: 100 });
  console.log("Product X created:", pX.data);

  const pY = await request({
    host: "localhost", port: 8080, path: "/api/products", method: "POST",
    headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" }
  }, { pname: "Product Y", price: 250.0, quantity: 80 });
  console.log("Product Y created:", pY.data);

  console.log(">>> Demo seed finished successfully!");
}

seed().catch(console.error);
