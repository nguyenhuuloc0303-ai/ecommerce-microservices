#!/bin/bash
set -e

mongosh <<EOF
  use product_db;
  db.createUser({
    user: "${PRODUCT_DB_USER:-product_user}",
    pwd: "${PRODUCT_DB_PASSWORD:-product_pass}",
    roles: [{ role: "readWrite", db: "product_db" }]
  });

  use shipment_db;
  db.createUser({
    user: "${SHIPMENT_DB_USER:-shipment_user}",
    pwd: "${SHIPMENT_DB_PASSWORD:-shipment_pass}",
    roles: [{ role: "readWrite", db: "shipment_db" }]
  });
EOF
