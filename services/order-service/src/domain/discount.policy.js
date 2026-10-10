class DiscountPolicy {
  /**
   * Calculate discount percentage from membership score (Rule A1)
   * Score >= 100 -> 20%
   * Score >= 50  -> 15%
   * Score >= 10  -> 10%
   * Else         -> 0%
   */
  static fromScore(score) {
    const s = Number(score) || 0;
    if (s >= 100) return 20;
    if (s >= 50) return 15;
    if (s >= 10) return 10;
    return 0;
  }

  /**
   * Calculate total order amount after discount (rounded to 2 decimal places)
   */
  static calculateTotal(items, discountPercent) {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_price)), 0);
    const total = subtotal * (1 - (discountPercent / 100));
    return Math.round(total * 100) / 100;
  }
}

module.exports = DiscountPolicy;
