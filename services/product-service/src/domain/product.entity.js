class ProductEntity {
  constructor({ pid, pname, price, quantity }) {
    this.pid = pid;
    this.pname = pname;
    this.price = Number(price);
    this.quantity = Number(quantity);
  }
}
module.exports = ProductEntity;
