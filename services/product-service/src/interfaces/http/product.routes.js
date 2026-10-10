const express = require("express");
const controller = require("./product.controller");
const { requireRole } = require("./middlewares/auth.middleware");

const router = express.Router();

// API-PRO-01: List all products (public or all roles)
router.get("/", (req, res, next) => controller.getAll(req, res, next));

// API-PRO-02: Get product by pid
router.get("/:pid", (req, res, next) => controller.getOne(req, res, next));

// API-PRO-03: Create product (ADMIN only)
router.post("/", requireRole("ADMIN"), (req, res, next) => controller.create(req, res, next));

// API-PRO-04: Update product (ADMIN only)
router.put("/:pid", requireRole("ADMIN"), (req, res, next) => controller.update(req, res, next));

// API-PRO-05: Delete product (ADMIN only)
router.delete("/:pid", requireRole("ADMIN"), (req, res, next) => controller.delete(req, res, next));

module.exports = router;
