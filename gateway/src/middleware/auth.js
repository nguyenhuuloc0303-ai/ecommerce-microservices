const jwt = require("jsonwebtoken");
const config = require("../config");
const logger = require("./logger");

// Route permissions config table (Section 4.1 + Section 12.5)
const routeRules = [
  { method: "POST", pattern: /^\/api\/auth\/register$/, public: true },
  { method: "POST", pattern: /^\/api\/auth\/login$/, public: true },
  { method: "GET", pattern: /^\/api\/health$/, public: true },
  { method: "GET", pattern: /^\/health$/, public: true },
  
  // Product APIs
  { method: "GET", pattern: /^\/api\/products(\/.*)?$/, roles: ["normal", "admin", "shipment_staff"] },
  { method: "POST", pattern: /^\/api\/products$/, roles: ["admin"] },
  { method: "PUT", pattern: /^\/api\/products\/[^\/]+$/, roles: ["admin"] },
  { method: "DELETE", pattern: /^\/api\/products\/[^\/]+$/, roles: ["admin"] },

  // Customer APIs
  { method: "GET", pattern: /^\/api\/customers\/[^\/]+$/, roles: ["normal", "admin"] },
  { method: "PUT", pattern: /^\/api\/customers\/[^\/]+$/, roles: ["normal", "admin"] },

  // Order APIs
  { method: "POST", pattern: /^\/api\/orders$/, roles: ["normal"] },
  { method: "GET", pattern: /^\/api\/orders(\/.*)?$/, roles: ["normal", "admin"] },

  // Shipment APIs
  { method: "GET", pattern: /^\/api\/shipments\/[^\/]+$/, roles: ["normal", "admin", "shipment_staff"] },
  { method: "PATCH", pattern: /^\/api\/shipments\/[^\/]+\/status$/, roles: ["admin", "shipment_staff"] }
];

function authenticateAndAuthorize(req, res, next) {
  // Strip any spoofed headers sent by the client (Crucial Security Check DoD)
  delete req.headers["x-user-id"];
  delete req.headers["x-user-role"];

  const path = req.path;
  const method = req.method.toUpperCase();

  // Match route rule
  const rule = routeRules.find(r => r.method === method && r.pattern.test(path));

  if (!rule) {
    // Route not defined in specification
    return res.status(404).json({ code: "NOT_FOUND", message: "Endpoint not found" });
  }

  if (rule.public) {
    return next();
  }

  // Protected route: require Authorization header Bearer <token>
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authorization token required (Bearer <token>)"
    });
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const userRole = (decoded.role || "").toLowerCase();
    const userId = String(decoded.sub);

    // Check RBAC
    if (rule.roles && !rule.roles.includes(userRole)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Forbidden: insufficient permissions for this role"
      });
    }

    // Propagate verified identity headers to internal services
    req.headers["x-user-id"] = userId;
    req.headers["x-user-role"] = userRole;
    req.user = { id: userId, role: userRole };

    next();
  } catch (err) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Invalid or expired token"
    });
  }
}

module.exports = { authenticateAndAuthorize };
