const express = require("express");
const controller = require("./auth.controller");
const router = express.Router();

// API-AUTH-01: Register
router.post("/register", (req, res, next) => controller.register(req, res, next));

// API-AUTH-02: Login
router.post("/login", (req, res, next) => controller.login(req, res, next));

module.exports = router;
