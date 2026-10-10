const productRepo = require("../../infrastructure/repositories/product.repository.mongo");
const { createProductSchema, updateProductSchema } = require("./validators/product.validator");

class ProductController {
  async getAll(req, res, next) {
    try {
      const products = await productRepo.findAll();
      return res.status(200).json({
        items: products.map(p => ({
          pid: p.pid,
          pname: p.pname,
          price: p.price,
          quantity: p.quantity
        }))
      });
    } catch (err) {
      next(err);
    }
  }

  async getOne(req, res, next) {
    try {
      const pid = Number(req.params.pid);
      if (isNaN(pid)) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid pid parameter" });
      }
      const product = await productRepo.findByPid(pid);
      if (!product) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Product with pid ${pid} not found` });
      }
      return res.status(200).json({
        pid: product.pid,
        pname: product.pname,
        price: product.price,
        quantity: product.quantity
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const validated = createProductSchema.parse(req.body);
      const created = await productRepo.create(validated);
      return res.status(201).json({
        pid: created.pid,
        pname: created.pname,
        price: created.price,
        quantity: created.quantity
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const pid = Number(req.params.pid);
      if (isNaN(pid)) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid pid parameter" });
      }
      const validated = updateProductSchema.parse(req.body);
      const updated = await productRepo.update(pid, validated);
      if (!updated) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Product with pid ${pid} not found` });
      }
      return res.status(200).json({
        pid: updated.pid,
        pname: updated.pname,
        price: updated.price,
        quantity: updated.quantity
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const pid = Number(req.params.pid);
      if (isNaN(pid)) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid pid parameter" });
      }
      const success = await productRepo.delete(pid);
      if (!success) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Product with pid ${pid} not found` });
      }
      return res.status(200).json({ message: "Product deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductController();
