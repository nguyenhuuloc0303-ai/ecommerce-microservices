const express = require("express");
const controller = require("./customer.controller");
const router = express.Router();

router.get("/:uid", (req, res, next) => controller.getOne(req, res, next));
router.put("/:uid", (req, res, next) => controller.update(req, res, next));

module.exports = router;
