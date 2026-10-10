const { execSync } = require("child_process");
const path = require("path");
const projectRoot = path.resolve(__dirname, "..");

function run(cmd, desc) {
  console.log(`\n>>> [CI] ${desc}...`);
  execSync(cmd, { stdio: "inherit", cwd: projectRoot });
}

try {
  console.log("==================================================");
  console.log("    E-COMMERCE MICROSERVICES CI / CD PIPELINE     ");
  console.log("==================================================");

  // 1. Run unit tests in all services
  run("docker exec product-service npm test", "Running Product Service Unit/Integration Tests");
  run("docker exec order-service npm test", "Running Order Service Unit Tests (DiscountPolicy)");
  run("docker exec shipment-service npm test", "Running Shipment Service Unit Tests (State Machine)");

  // 2. Run E2E Integration Suite
  run("node --test tests/e2e/e2e.test.js", "Running Full 25 Test Cases E2E Suite");

  // 3. Print Docker Stats
  run("docker stats --no-stream", "Capturing Real Docker Container Resource Stats");

  console.log("\n==================================================");
  console.log("  CI PIPELINE COMPLETED SUCCESSFULLY (EXIT 0)    ");
  console.log("==================================================");
  process.exit(0);
} catch (err) {
  console.error("\n[CI ERROR] Pipeline failed:", err.message);
  process.exit(1);
}
