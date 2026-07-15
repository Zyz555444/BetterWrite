# Phase 4 学生端 Web 完整开发实施计划

## Context（背景）

BetterWrite 已完成 Phase 3 教师端闭环（任务/批改/资源/学生管理/数据分析）。学生端目前仅有"提交作文 + 看批改"两条基础路径，Phase 4 要求补齐学生端完整功能。本计划基于 `docs/00-项目总览-PRD.md` 和 `docs/05-开发实施计划.md` 第 6 节，覆盖 4 个核心模块（错题本、写作成长、AI写作助手、自主练习）+ 附带增强（首页、写作编辑器）。

**已确认的关键决策**：
- 练习批改：两者结合（默认轻量即时反馈 + 可选深度异步批改）
- 草稿保存：数据库表（跨设备同步，新增 essay_drafts 表）

**现状**：5 张新表待建、AI 助手能力待扩展、~20 个新路由待加、4 个新页面目录待建；corrections 表已存 errors/errorStats JSON，错题本可基于此聚合；自研 SVG 图表组件可复用；AI 引擎 router/completeStructured 调用模式可复用。

---

## 一、新增数据库表（6 张）

沿用现有风格：`sqliteTable` + text 主键 + ISO 时间 + JSON 存 text + `xxxRelations({ one, many })`，在 `packages/db/src/schema/index.ts` 透传导出。

| 表 | 文件 | 关键字段 |
|---|---|---|
| error_books | `schema/error-books.ts` | id, student_id→users, essay_id→essays, correction_id→corrections, error_type, original, corrected, explanation, position(default '{}'), status(default 'unresolved'), practice_count(default 0), mastered_at, created_at, updated_at |
| question_bank | `schema/question-bank.ts` | id, topic_type, topic_category, title, requirements, key_points(default '[]'), reference_essay, word_limit_min(80), word_limit_max(125), time_limit_minutes(15), difficulty(default 'medium'), source, is_public(default true), created_at, updated_at |
| practice_exercises | `schema/practice-exercises.ts` | id, student_id→users, exercise_type(question_bank\|timed_mock), question_id→question_bank, topic_type, title, content, word_count, score, score_tier, ai_feedback(default '{}'), duration_ms, status(default 'completed'), started_at, submitted_at, created_at |
| ai_conversations | `schema/ai-conversations.ts` | id, student_id→users, mode(polish\|upgrade\|synonym\|grammar), input_text, output_text, metadata(default '{}'), ai_provider, ai_model, tokens_used, created_at |
| achievements | `schema/achievements.ts` | id, student_id→users, code, tier(bronze\|silver\|gold\|platinum), title, description, icon, earned_at, created_at；唯一索引 (student_id, code) |
| essay_drafts | `schema/essay-drafts.ts` | id, student_id→users, task_id, content, word_count, duration_ms, updated_at；唯一索引 (student_id, task_id) |

relations：各表 `student: one(users)`；error_books 另加 `essay/correction`；users/essays 的 Relations 补 `many(...)`。

迁移：`pnpm --filter @betterwrite/db db:generate` 生成 0002，再 `db:migrate`。种子：脚本追加若干 question_bank 题目（按 PRD 6 大话题分类）。

---

## 二、Shared 层扩展（packages/shared/src/）

**constants/essay.ts 追加**：`PracticeDifficulty`、`ExerciseType`、`AchievementTier`、`AiAssistantMode`、`ErrorBookStatus` 及对应 `*Value` 类型。

**types/essay.ts 追加**：`ErrorBookItem`、`QuestionBankItem`、`PracticeExercise`、`AiConversation`、`AiAssistantResult`、`Achievement`、`StudentProgress`、`EssayDraft`、`DailyQuote`。

**utils/index.ts 追加**：
- `calculateAbilityRadar(essays)` → 雷达图 data（四维均分，含 max：content 4.5 / language 6 / structure 3 / presentation 1.5）
- `calculateProgressCurve(essays)` → LineChart data
- `calculateClassRank(myAvg, peerScores)` → { rank, total, percentile }
- `checkAchievements(stats)` → 应解锁勋章 code 列表
- `formatDuration(ms)` → 计时器 `mm:ss`

---

## 三、AI 层扩展（packages/ai/src/）

新建 `assistant.ts` + `assistants/schemas.ts`，`index.ts` 透传导出。

**assistant.ts 导出**：
- `polishEssay(router, text)` → { polished, changes[] }
- `upgradeSentences(router, text)` → { sentences[] }
- `getSynonyms(router, word, context)` → { synonyms[] }
- `checkGrammar(router, text)` → { errors[] }

统一调用模式：`if (router.availableNames().length === 0) throw new Error('AI 服务未配置')`；`router.executeWithFallback('language', p => p.completeStructured(prompt, schema, { maxOutputTokens: 1024 }))`。

**防作弊**：prompt 模板约束"仅提供片段级建议，不得输出完整作文"；输入 >200 词时首尾采样。

**schemas**：polishSchema、upgradeSchema、synonymSchema、grammarSchema（zod）。

---

## 四、新增 API 路由清单（routes.ts 追加）

全部 `authMiddleware + requireRole(UserRole.STUDENT)`，日志 `[API /student/xxx]` 前缀。

**错题本**
- `GET /api/student/errors` — 聚合（按 type 分组 + 消灭进度），合并 error_books 表
- `GET /api/student/errors/:type` — 类型列表（offset 分页）
- `POST /api/student/errors/:id/master` — 标记已消灭
- `POST /api/student/errors/sync` — 增量同步（从 corrections.errors 拆写入 error_books）
- `POST /api/student/errors/practice` — AI 生成针对性练习（body: errorType）

**写作成长**
- `GET /api/student/progress` — 雷达图+进步曲线+成就+班级排名
- `GET /api/student/achievements` — 勋章列表（含未解锁）

**AI 助手**
- `POST /api/student/ai/polish|upgrade|synonym|grammar` — 同步调用 assistant 函数，写 ai_conversations
- `GET /api/student/ai/history` — 对话历史（offset 分页）

**自主练习**
- `GET /api/student/question-bank` — 题库列表（query: topicType, difficulty, offset, limit）
- `GET /api/student/question-bank/:id` — 单题
- `POST /api/student/practice` — 提交练习，**轻量即时反馈**（调 checkGrammar），写 practice_exercises
- `POST /api/student/practice/deep` — **深度异步批改**（创建 essay status=pending 触发 worker，返回 essayId 供轮询）
- `GET /api/student/practice/history` — 练习历史

**首页 + 草稿**
- `GET /api/student/dashboard` — 聚合统计 + 每日金句（从 teaching_resources type=sentence 随机）
- `GET /api/student/drafts/:taskId` — 读取草稿
- `POST /api/student/drafts/:taskId` — 保存草稿（upsert）
- `DELETE /api/student/drafts/:taskId` — 删除草稿

---

## 五、Web 端 AI Router 单例

新建 `apps/web/src/lib/ai/router.ts`：懒初始化 `createProviderRouter(process.env)`，导出 `getAiRouter()`。AI 助手路由调用前检查 `availableNames().length`，为空返回 `{ success: false, error: 'AI 服务未配置' }`。

---

## 六、任务分解与执行顺序

### Phase 0 — 基础层（T1/T2/T3 可并行，收尾串行 build）
- **T1** DB：新建 6 表 schema + relations + index.ts 导出 + users/essays Relations 补 many + 生成迁移
- **T2** Shared：新增常量/类型/utils（独立）
- **T3** AI：新建 assistant.ts + schemas + index.ts 导出（依赖 T2 类型）
- 收尾：`pnpm --filter @betterwrite/db db:generate && db:migrate && build`；`shared build`；`ai build`

### Phase 1 — API 与 Router（依赖 Phase 0）
- **T4** 新建 `apps/web/src/lib/ai/router.ts` 单例（依赖 T3）
- **T5** routes.ts 追加全部新路由（依赖 T1/T2/T3/T4）

### Phase 2 — Fetcher（依赖 T5）
- **T6** fetcher.ts 新增 ~18 方法 + 接口类型（ErrorBookItem/PracticeExercise/AiAssistantResult/Achievement/StudentProgress/EssayDraft/DailyQuote）

### Phase 3 — 前端（依赖 T6，可并行）
- **T7** 新建共享组件 `components/student/{error-card,achievement-badge,ai-assistant-panel,practice-card,daily-quote,checklist-guard}.tsx`
- **T8a** 错题本页：`app/student/errors/page.tsx` + `errors/[type]/page.tsx`
- **T8b** 写作成长页：`app/student/progress/page.tsx`（替换占位）
- **T8c** AI 助手页：`app/student/assistant/page.tsx`
- **T8d** 自主练习页：`app/student/practice/page.tsx` + `practice/[id]/page.tsx` + `practice/mock/page.tsx`
- **T9** 首页增强：改造 `app/student/dashboard/page.tsx`（金句 + 统计图表）
- **T10** 编辑器增强：改造 `app/student/tasks/[id]/write/page.tsx` + `student/write/page.tsx`，抽 `useEssayDraft` hook（草稿 API + 计时器持久化 + 自查清单提交校验）
- **T11** 导航补项：`dashboard-layout.tsx` navItems 增"错题本/AI助手/自主练习"

### Phase 4 — 验证
- **T12** `pnpm -r build` + `pnpm typecheck` + `pnpm exec biome check` 全绿；浏览器冒烟测试

**并行策略**：T8a/b/c/d 互相独立可并行；T9/T10 独立。关键路径：T1→T5→T6→T8。

---

## 七、复用策略

**直接复用**：RoleGuard + DashboardLayout、Card/Badge/Button/Input、自研 4 种 SVG 图表、fetcher.request + ApiResponse<T>、calculateErrorStats/calculateScoreDistribution/countWords/formatScore、authMiddleware/requireRole、router.executeWithFallback + completeStructured、worker correctEssay（深度批改复用）。

**新建**：6 张 schema 表 + 迁移、`lib/ai/router.ts`、`packages/ai/src/assistant.ts` + schemas、`components/student/*` 6 组件、4 个新页面目录、fetcher ~18 方法。

**改造**：routes.ts（+~22 路由）、fetcher.ts、dashboard-layout.tsx（+3 导航）、student/dashboard/page.tsx、student/tasks/[id]/write/page.tsx、student/write/page.tsx。

---

## 八、风险与对策

1. **AI 助手同步阻塞**：单次 2-5s，前端加 loading + AbortController + 10s timeout；maxOutputTokens 限 1024；长文本截断。
2. **错题聚合性能**：corrections.errors 是 JSON text 全表扫描。对策：写时聚合到 error_books 表 + `POST /errors/sync` 增量同步（查 correction_id 不在 error_books 的）。
3. **深度批改延迟**：practice/deep 走 worker 异步，前端轮询 essay status（复用现有 /essays/:id 流程）。
4. **Biome 规则**：noNonNullAssertion（用 if 守卫）、useExhaustiveDependencies（显式列依赖或 biome-ignore 注释，参考 essays/[id]/page.tsx 第 32 行）。
5. **类型同步**：改 shared/db 后必须先 `pnpm --filter @betterwrite/<pkg> build` 重建 dist，否则 web typecheck 拿旧类型。
6. **草稿并发**：upsert 用 (student_id, task_id) 唯一索引；前端防抖 2s 自动保存。

---

## 九、验证方式

| 阶段 | 命令 | 预期 |
|---|---|---|
| Phase 0 后 | `pnpm --filter @betterwrite/db db:generate`；三包 `build`+`typecheck` | 0002 迁移生成，dist 更新，无类型错误 |
| Phase 1 后 | `pnpm --filter @betterwrite/web typecheck` | routes.ts 编译通过 |
| Phase 2 后 | `pnpm --filter @betterwrite/web typecheck` | fetcher 签名匹配 |
| Phase 3 后 | `pnpm -r build` + `pnpm typecheck` + `pnpm exec biome check` | 全绿 |
| 冒烟 | 学生登录→写 1 篇触发批改→访问错题本/成长/AI助手/练习→AI 助手有 key 返回结果无 key 降级提示→练习轻量反馈即时+深度批改轮询→草稿跨设备保存 | 各页可渲染、核心流程通 |

---

## 关键文件清单

- `packages/db/src/schema/index.ts` — 透传 6 张新表
- `packages/db/src/schema/{error-books,question-bank,practice-exercises,ai-conversations,achievements,essay-drafts}.ts` — 新建
- `packages/shared/src/{constants,types,utils}/...` — 扩展
- `packages/ai/src/assistant.ts` + `assistants/schemas.ts` — 新建
- `apps/web/src/lib/ai/router.ts` — 新建 web router 单例
- `apps/web/src/lib/api/routes.ts` — 追加 ~22 路由
- `apps/web/src/lib/api/fetcher.ts` — 追加 ~18 方法
- `apps/web/src/components/student/*.tsx` — 6 新组件
- `apps/web/src/app/student/{errors,progress,assistant,practice}/...` — 4 新页面目录
- `apps/web/src/app/student/dashboard/page.tsx` — 改造
- `apps/web/src/app/student/tasks/[id]/write/page.tsx` + `student/write/page.tsx` — 改造
- `apps/web/src/components/layout/dashboard-layout.tsx` — 导航补项
