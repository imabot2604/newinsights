import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nimbleConversationsTable = sqliteTable("nimble_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  month: integer("month"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const nimbleMessagesTable = sqliteTable("nimble_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => nimbleConversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const insertNimbleConversationSchema = createInsertSchema(nimbleConversationsTable).omit({ id: true, createdAt: true });
export const insertNimbleMessageSchema = createInsertSchema(nimbleMessagesTable).omit({ id: true, createdAt: true });

export type NimbleConversation = typeof nimbleConversationsTable.$inferSelect;
export type InsertNimbleConversation = z.infer<typeof insertNimbleConversationSchema>;
export type NimbleMessage = typeof nimbleMessagesTable.$inferSelect;
export type InsertNimbleMessage = z.infer<typeof insertNimbleMessageSchema>;
