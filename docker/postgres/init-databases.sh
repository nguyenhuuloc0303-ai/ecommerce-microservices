#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Service Users
    CREATE USER auth_user WITH PASSWORD '${AUTH_DB_PASSWORD:-auth_pass}';
    CREATE USER customer_user WITH PASSWORD '${CUSTOMER_DB_PASSWORD:-customer_pass}';
    CREATE USER order_user WITH PASSWORD '${ORDER_DB_PASSWORD:-order_pass}';

    -- Create Logical Databases with Dedicated Owners
    CREATE DATABASE auth_db OWNER auth_user;
    CREATE DATABASE customer_db OWNER customer_user;
    CREATE DATABASE order_db OWNER order_user;

    -- Revoke Public Connection (Enforce strict isolation)
    REVOKE CONNECT ON DATABASE auth_db FROM PUBLIC;
    REVOKE CONNECT ON DATABASE customer_db FROM PUBLIC;
    REVOKE CONNECT ON DATABASE order_db FROM PUBLIC;

    -- Grant connect strictly to designated service owners
    GRANT CONNECT ON DATABASE auth_db TO auth_user;
    GRANT CONNECT ON DATABASE customer_db TO customer_user;
    GRANT CONNECT ON DATABASE order_db TO order_user;
EOSQL
