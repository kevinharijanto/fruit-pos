-- Add performance indexes for faster queries
-- These indexes are safe to add and won't modify any existing data

-- Orders table indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON "Order"(createdAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status ON "Order"(paymentStatus);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivery_status ON "Order"(deliveryStatus);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id ON "Order"(customerId);

-- Composite index for orders filtered by status and date (very common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_date ON "Order"(paymentStatus, createdAt DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivery_date ON "Order"(deliveryStatus, createdAt DESC);

-- OrderItem table indexes for joins and lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON "OrderItem"(orderId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_item_id ON "OrderItem"(itemId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_composite ON "OrderItem"(orderId, itemId);

-- Customer table indexes for search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_name ON "Customer"(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_whatsapp ON "Customer"(whatsapp);

-- Item table indexes for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_category_id ON "Item"(categoryId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_unit ON "Item"(unit);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_stock_mode ON "Item"(stockMode);

-- Full-text search indexes for better search performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_name_gin ON "Customer" USING gin(to_tsvector('english', name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivery_note_gin ON "Order" USING gin(to_tsvector('english', deliveryNote));