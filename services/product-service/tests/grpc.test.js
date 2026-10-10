const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const mongoose = require('mongoose');
const { Product } = require('../src/infrastructure/database/product.model');
const config = require('../src/infrastructure/config');

describe('Product gRPC Integration Tests (ReserveStock & ReleaseStock)', () => {
  let client;

  before(async () => {
    await mongoose.connect(config.MONGO_URI);

    const protoPath = path.resolve(__dirname, '../proto/product.proto');
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const productProto = grpc.loadPackageDefinition(packageDef).product;
    client = new productProto.ProductService('localhost:' + config.GRPC_PORT, grpc.credentials.createInsecure());

    // Clean up test data
    await Product.deleteMany({ pid: { $in: [8888, 8889] } });
    await Product.create({ pid: 8888, pname: 'Test Item 1', price: 100.5, quantity: 10 });
    await Product.create({ pid: 8889, pname: 'Test Item 2', price: 200.0, quantity: 5 });
  });

  after(async () => {
    await Product.deleteMany({ pid: { $in: [8888, 8889] } });
    await mongoose.disconnect();
  });

  it('1. ReserveStock succeeds when stock is sufficient', async () => {
    const reply = await new Promise((resolve, reject) => {
      client.ReserveStock({ items: [{ pid: 8888, qty: 3 }, { pid: 8889, qty: 2 }] }, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });

    assert.strictEqual(reply.items.length, 2);
    assert.strictEqual(reply.items[0].pid, 8888);
    assert.strictEqual(reply.items[0].qty, 3);
    assert.strictEqual(reply.items[0].unit_price, 100.5);
    assert.strictEqual(reply.items[1].pid, 8889);
    assert.strictEqual(reply.items[1].qty, 2);
    assert.strictEqual(reply.items[1].unit_price, 200.0);

    const p1 = await Product.findOne({ pid: 8888 });
    const p2 = await Product.findOne({ pid: 8889 });
    assert.strictEqual(p1.quantity, 7);
    assert.strictEqual(p2.quantity, 3);
  });

  it('2. ReserveStock rolls back all items when any item lacks stock', async () => {
    // Request 2 of item 1 (available: 7), and 10 of item 2 (available: 3)
    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        client.ReserveStock({ items: [{ pid: 8888, qty: 2 }, { pid: 8889, qty: 10 }] }, (err, res) => {
          if (err) return reject(err);
          resolve(res);
        });
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Should have thrown error');
    assert.strictEqual(caughtErr.code, 9, 'Should be FAILED_PRECONDITION (code 9)');

    // Ensure item 1 was rolled back / compensated!
    const p1 = await Product.findOne({ pid: 8888 });
    const p2 = await Product.findOne({ pid: 8889 });
    assert.strictEqual(p1.quantity, 7, 'Item 1 quantity must remain 7 (rolled back)');
    assert.strictEqual(p2.quantity, 3, 'Item 2 quantity must remain 3');
  });

  it('3. ReserveStock returns NOT_FOUND for non-existent product', async () => {
    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        client.ReserveStock({ items: [{ pid: 999999, qty: 1 }] }, (err, res) => {
          if (err) return reject(err);
          resolve(res);
        });
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Should have thrown error');
    assert.strictEqual(caughtErr.code, 5, 'Should be NOT_FOUND (code 5)');
  });

  it('4. ReleaseStock restores deducted stock correctly', async () => {
    const reply = await new Promise((resolve, reject) => {
      client.ReleaseStock({ items: [{ pid: 8888, qty: 3 }, { pid: 8889, qty: 2 }] }, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });

    assert.strictEqual(reply.ok, true);
    const p1 = await Product.findOne({ pid: 8888 });
    const p2 = await Product.findOne({ pid: 8889 });
    assert.strictEqual(p1.quantity, 10, 'Item 1 should be back to 10');
    assert.strictEqual(p2.quantity, 5, 'Item 2 should be back to 5');
  });

  it('5. Concurrent reservations do not exceed inventory', async () => {
    await Product.updateOne({ pid: 8888 }, { quantity: 2 });

    const promises = [1, 2, 3, 4, 5].map(() =>
      new Promise(resolve => {
        client.ReserveStock({ items: [{ pid: 8888, qty: 1 }] }, (err, res) => {
          resolve({ success: !err, err });
        });
      })
    );

    const results = await Promise.all(promises);
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;

    assert.strictEqual(successes, 2, 'Exactly 2 reservations should succeed');
    assert.strictEqual(failures, 3, 'Exactly 3 reservations should fail');

    const p1 = await Product.findOne({ pid: 8888 });
    assert.strictEqual(p1.quantity, 0, 'Remaining inventory must be exactly 0, never negative');
  });
});
