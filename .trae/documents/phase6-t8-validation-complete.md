# Phase 6 T8 验证收尾计划

## 背景与当前状态

Phase 6（超级管理员端）T1-T7 已全部完成：
- T1: announcements 表结构 ✅
- T2: shared admin 类型定义 ✅
- T3: API 路由 — dashboard + schools（6 路由）✅
- T4: API 路由 — apis + logs + announcements + question-bank + scoring（15 路由）+ crypto.ts ✅
- T5: Fetcher — admin 方法（~20 方法）✅
- T6: Web 页面 — dashboard + schools + apis ✅
- T7: Web 页面 — announcements + question-bank ✅
- T8: 导航更新 ✅ + 验证 ⏳

导航已更新（dashboard-layout.tsx 第 55-66 行已加入 `/admin/announcements` 和 `/admin/question-bank`）。typecheck 已通过。

**唯一剩余问题**：3 个 admin 页面文件存在 `lint/a11y/noLabelWithoutControl` 错误——独立 `<label>` 未关联控件。已在学校管理页验证修复方案可行：将独立视觉 `<label>` 改为 `<span>`，保留包裹 checkbox 的 `<label>` 不变。

## 待修复文件分析

### 1. apps/web/src/app/admin/apis/page.tsx
- **状态**：开标签已部分转换（`<label className="text-label-12 text-neutral-8">` 和 `whitespace-nowrap` 变体都已改为 `<span>`），但闭标签 `</label>` 仍是旧的
- **需修复**：所有 `</label>` → `</span>`
- **特殊处理**：第 467-474 行的 checkbox label（`<label className="flex items-center gap-2...">`）应保留为 `<label>`，需在 replace_all 后恢复其闭标签
- **checkbox 闭标签定位**：`启用状态\n                </span>` → `启用状态\n                </label>`

### 2. apps/web/src/app/admin/announcements/page.tsx
- **状态**：完全未修复
- **开标签**：3 处 `<label className="text-label-12 text-neutral-8">`（第 238、246、255 行）
- **checkbox label**：第 268-275 行 `<label className="flex items-center gap-2 text-copy-14 text-neutral-8">` 保留
- **修复步骤**：
  1. `replace_all` `<label className="text-label-12 text-neutral-8">` → `<span className="text-label-12 text-neutral-8">`
  2. `replace_all` `</label>` → `</span>`
  3. 恢复 checkbox 闭标签：`立即生效\n                  </span>` → `立即生效\n                  </label>`

### 3. apps/web/src/app/admin/question-bank/page.tsx
- **状态**：完全未修复
- **开标签**：2 处 `whitespace-nowrap` 变体（第 190、204 行）+ 11 处普通变体（第 335、348、356、364、373、382、391、401、411、421、433 行）
- **checkbox label**：本文件无 checkbox label，无需保留
- **修复步骤**：
  1. `replace_all` `<label className="text-label-12 text-neutral-8 whitespace-nowrap">` → `<span className="text-label-12 text-neutral-8 whitespace-nowrap">`
  2. `replace_all` `<label className="text-label-12 text-neutral-8">` → `<span className="text-label-12 text-neutral-8">`
  3. `replace_all` `</label>` → `</span>`

## 执行步骤

### 步骤 1：修复 apis/page.tsx
- `replace_all` `</label>` → `</span>`
- `Edit` 恢复 checkbox 闭标签（匹配 `启用状态\n                </span>` → `启用状态\n                </label>`）

### 步骤 2：修复 announcements/page.tsx
- `replace_all` 开标签转换
- `replace_all` 闭标签转换
- `Edit` 恢复 checkbox 闭标签（匹配 `立即生效\n                  </span>` → `立即生效\n                  </label>`）

### 步骤 3：修复 question-bank/page.tsx
- `replace_all` `whitespace-nowrap` 变体开标签
- `replace_all` 普通开标签
- `replace_all` 闭标签转换（无需恢复，本文件无 checkbox label）

### 步骤 4：运行 biome 验证
```powershell
pnpm exec biome check apps/web/src/app/admin apps/web/src/lib/crypto.ts apps/web/src/lib/api/routes.ts apps/web/src/lib/api/fetcher.ts apps/web/src/components/layout/dashboard-layout.tsx
```
预期：0 errors。若仍有错误，按报错信息继续修复。

### 步骤 5：运行全量构建
```powershell
pnpm -r build
```
预期：8 个 workspace 全部构建成功（web 22 页面 + mobile + worker + 4 个 packages）。

### 步骤 6：收尾
- 更新 TaskList 标记 T8 完成
- 向用户汇报 Phase 6 全部完成，询问是否进入 Phase 7（打磨与上线）

## 验证标准

- [ ] biome check 0 errors
- [ ] pnpm -r build 8 个 workspace 全绿
- [ ] 4 个 admin 页面（dashboard、schools、apis、announcements、question-bank）的独立 label 已改为 span
- [ ] 3 个含 checkbox 的页面（schools、apis、announcements）的 checkbox label 保留为 `<label>`

## 后续

Phase 6 完成后，下一步是 Phase 7（打磨与上线），包含：
- 测试：单元测试、集成测试、E2E、性能测试、安全测试
- 优化：前端性能、API 响应、AI 批改速度、移动端性能
- 部署：Vercel + VPS + 数据库 + Redis + SSL + 域名 + 监控
- 文档：用户手册、教师指南、运维文档、API 文档

需向用户确认是否立即进入 Phase 7，还是先做其他工作。
