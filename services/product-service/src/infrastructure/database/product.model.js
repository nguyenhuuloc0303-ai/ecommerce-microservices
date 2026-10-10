const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("Counter", counterSchema);

const productSchema = new mongoose.Schema({
  pid: { type: Number, unique: true, index: true },
  pname: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 }
}, { timestamps: true });

productSchema.pre("save", async function(next) {
  if (this.isNew && !this.pid) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "product_pid" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.pid = counter.seq;
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = { Product, Counter };
