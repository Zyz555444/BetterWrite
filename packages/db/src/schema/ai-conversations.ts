import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const aiConversations = sqliteTable('ai_conversations', {
  id: text('id').primaryKey(),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  mode: text('mode').notNull(),
  inputText: text('input_text').notNull(),
  outputText: text('output_text').notNull(),
  metadata: text('metadata').default('{}'),
  aiProvider: text('ai_provider'),
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used'),
  createdAt: text('created_at').notNull(),
});

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  student: one(users, {
    fields: [aiConversations.studentId],
    references: [users.id],
  }),
}));
