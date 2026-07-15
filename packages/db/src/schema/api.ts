import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { essays } from './essays.js';

export const apiConfigs = sqliteTable(
  'api_configs',
  {
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
  },
  (t) => ({
    providerIdx: index('api_configs_provider_idx').on(t.provider),
    activeIdx: index('api_configs_active_idx').on(t.isActive),
  }),
);

export const apiCallLogs = sqliteTable(
  'api_call_logs',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    model: text('model'),
    endpoint: text('endpoint'),
    tokensUsed: integer('tokens_used'),
    latencyMs: integer('latency_ms'),
    cost: real('cost'),
    status: text('status'),
    errorMessage: text('error_message'),
    essayId: text('essay_id').references(() => essays.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    createdIdx: index('api_call_logs_created_idx').on(t.createdAt),
    endpointIdx: index('api_call_logs_endpoint_idx').on(t.endpoint),
    statusIdx: index('api_call_logs_status_idx').on(t.status),
  }),
);
