import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const content = sqliteTable('content', {
  id: integer('id').primaryKey(),
  revision: integer('revision').notNull(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});
