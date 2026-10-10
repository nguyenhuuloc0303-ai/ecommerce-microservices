const { describe, it } = require("node:test");
const assert = require("node:assert");
const DiscountPolicy = require("../src/domain/discount.policy");

describe("DiscountPolicy Domain Unit Tests", () => {
  it("score < 10 returns 0% discount (edges: 0, 9)", () => {
    assert.strictEqual(DiscountPolicy.fromScore(0), 0);
    assert.strictEqual(DiscountPolicy.fromScore(9), 0);
  });

  it("10 <= score < 50 returns 10% discount (edges: 10, 49)", () => {
    assert.strictEqual(DiscountPolicy.fromScore(10), 10);
    assert.strictEqual(DiscountPolicy.fromScore(49), 10);
  });

  it("50 <= score < 100 returns 15% discount (edges: 50, 99)", () => {
    assert.strictEqual(DiscountPolicy.fromScore(50), 15);
    assert.strictEqual(DiscountPolicy.fromScore(99), 15);
  });

  it("score >= 100 returns 20% discount (edges: 100, 200)", () => {
    assert.strictEqual(DiscountPolicy.fromScore(100), 20);
    assert.strictEqual(DiscountPolicy.fromScore(200), 20);
  });

  it("calculateTotal computes correct rounded amount", () => {
    const items = [
      { pid: 1, qty: 2, unit_price: 1000 },
      { pid: 2, qty: 1, unit_price: 500 }
    ];
    // Subtotal: 2500, Discount 10% -> 2250
    assert.strictEqual(DiscountPolicy.calculateTotal(items, 10), 2250);
    // Subtotal: 2500, Discount 15% -> 2125
    assert.strictEqual(DiscountPolicy.calculateTotal(items, 15), 2125);
    // Subtotal: 2500, Discount 20% -> 2000
    assert.strictEqual(DiscountPolicy.calculateTotal(items, 20), 2000);
  });
});
