CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, product TEXT NOT NULL, name TEXT, email TEXT, amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', gateway_id TEXT, created_at INTEGER, paid_at INTEGER, downloads INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_gateway ON orders(gateway_id);
