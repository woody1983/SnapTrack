import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trackingNumber: text('tracking_number').notNull().unique(),
  carrier: text('carrier').notNull(), // 'UPS' | 'FedEx'
  shipFromAddress: text('ship_from_address'), // 可空
  shipToAddress: text('ship_to_address'), // 可空
  shipperFirstName: text('shipper_first_name'), // 寄件人名
  shipperLastName: text('shipper_last_name'),   // 寄件人姓
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
