const { describe, it } = require("node:test");
const assert = require("node:assert");
const { createProductSchema, updateProductSchema } = require("../src/interfaces/http/validators/product.validator");

describe("Product Validator Unit Tests", () => {
  it("should pass valid product data", () => {
    const valid = { pname: "iPhone 15", price: 999.99, quantity: 50 };
    const result = createProductSchema.parse(valid);
    assert.strictEqual(result.pname, "iPhone 15");
    assert.strictEqual(result.price, 999.99);
    assert.strictEqual(result.quantity, 50);
  });

  it("should fail when pname is empty", () => {
    assert.throws(() => {
      createProductSchema.parse({ pname: "", price: 100, quantity: 10 });
    });
  });

  it("should fail when price is negative", () => {
    assert.throws(() => {
      createProductSchema.parse({ pname: "Item", price: -10, quantity: 10 });
    });
  });

  it("should fail when quantity is not an integer", () => {
    assert.throws(() => {
      createProductSchema.parse({ pname: "Item", price: 10, quantity: 2.5 });
    });
  });

  it("should allow partial update data", () => {
    const update = { price: 899 };
    const result = updateProductSchema.parse(update);
    assert.strictEqual(result.price, 899);
  });
});
