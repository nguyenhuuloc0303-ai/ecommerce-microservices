const { Product } = require("../database/product.model");
const ProductEntity = require("../../domain/product.entity");

class ProductRepositoryMongo {
  async findAll() {
    const docs = await Product.find({}).sort({ pid: 1 }).lean();
    return docs.map(d => new ProductEntity(d));
  }

  async findByPid(pid) {
    const doc = await Product.findOne({ pid: Number(pid) }).lean();
    return doc ? new ProductEntity(doc) : null;
  }

  async create({ pname, price, quantity }) {
    const product = new Product({ pname, price, quantity });
    const saved = await product.save();
    return new ProductEntity(saved);
  }

  async update(pid, updateData) {
    const updated = await Product.findOneAndUpdate(
      { pid: Number(pid) },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();
    return updated ? new ProductEntity(updated) : null;
  }

  async delete(pid) {
    const deleted = await Product.findOneAndDelete({ pid: Number(pid) }).lean();
    return !!deleted;
  }
}

module.exports = new ProductRepositoryMongo();
