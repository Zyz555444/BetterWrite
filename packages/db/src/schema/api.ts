import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const apiConfigs = sqliteTable('api_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  baseUrl: text('base_url'),
  model: text('model'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  maxTokens: integer('max_tokens').default(4096),
  temperature: real('temperature').default(0.3),
  rateLimitPerMin: integer('rate_limit_per_min').default(60),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const apiCallLogs = sqliteTable('api_call_logs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model'),
  endpoint: text('endpoint'),
  tokensUsed: integer('tokens_used'),
  latencyMs: integer('latency_ms'),
  cost: real('cost'),
  status: text('status'),
  errorMessage: text('error_message'),
  essayId: text('essay_id'),
  createdAt: text('created_at').notNull(),
});
