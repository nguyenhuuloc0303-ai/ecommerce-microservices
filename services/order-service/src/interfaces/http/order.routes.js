const express = require("express");
const controller = require("./order.controller");
const router = express.Router();

router.post("/", (req, res, next) => controller.create(req, res, next));
router.get("/", (req, res, next) => controller.getAll(req, res, next));
router.get("/:oid", (req, res, next) => controller.getOne(req, res, next));

module.exports = router;
