const express = require("express");
const controller = require("./shipment.controller");
const router = express.Router();

router.get("/:shipid", (req, res, next) => controller.getOne(req, res, next));
router.patch("/:shipid/status", (req, res, next) => controller.updateStatus(req, res, next));

module.exports = router;
