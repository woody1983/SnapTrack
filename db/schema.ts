import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trackingNumber: text('tracking_number').notNull().unique(),
  carrier: text('carrier').notNull(), // 'UPS' | 'FedEx'
  shipFromAddress: text('ship_from_address'),
  shipToAddress: text('ship_to_address'),
  shipperFirstName: text('shipper_first_name'),
  shipperLastName: text('shipper_last_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;

// Role: 'warehouser' | 'service_desk'
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role').notNull().unique(), // 'warehouser' | 'service_desk'
  passwordHash: text('password_hash').notNull(), // PBKDF2 hex
  salt: text('salt').notNull(),                  // random hex salt
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: integer('locked_until'),          // unix timestamp ms, nullable
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;

export const pinnedTrackings = sqliteTable('pinned_trackings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role').notNull(),             // which role pinned it
  trackingNumber: text('tracking_number').notNull(),
  carrier: text('carrier').notNull(),
  pinnedAt: integer('pinned_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  lastRefreshedAt: integer('last_refreshed_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type PinnedTracking = typeof pinnedTrackings.$inferSelect;
