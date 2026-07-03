# Yohaku 设计系统迁移 — 收官计划 (B4 提交 → P5 验收)

> 本计划是 `yohaku-migration-resume-p2-to-p5.md` 的接力续作,聚焦从当前断点(B4 工作树完成但未提交)一路执行到 P5 全量验收。
> 上游三锁决策不变:梅 `#c56473` (light) / 桃 `#f596aa` (dark)、完整暗色模式含切换 UI、分阶段提交。

## 摘要

Yohaku 设计系统迁移已推进至 B4(教师业务页面 10 个文件已在工作树完成 legacy 替换,未提交)。本计划覆盖剩余工作:B4 提交 → B5 学生业务页面(13 文件,~155 处 legacy) → B6 鉴权/管理员/学校/首页(5 文件,~31 处) → C 移动端令牌对齐 → D P5 全量验收 + legacy aliases 块移除 + 收官提交(同步落盘 P1/P2 未提交的基础设施变更)。

## 当前状态分析 (Phase 1 探索结论)

### 已提交(committed) ✅

最近 4 个 Yohaku 提交(HEAD 起回溯):
- `e59f587 style(web): migrate student components to yohaku` (B3)
- `54e6b0f style(web): migrate essay correction-result to yohaku` (B2)
- `e305cf0 style(web): migrate charts to yohaku with 和色 series palette` (B1)
- `f91ab7c style(web): complete P2 yohaku migration of role-guard` (阶段 A)

### 工作树已完成但未提交 ⏳

**B4 — teacher/ 业务页面 (10 文件)**:legacy 类已全部替换为 canonical token,经 Grep 验证残留 = 0。
- `apps/web/src/app/teacher/dashboard/page.tsx`
- `apps/web/src/app/teacher/analytics/page.tsx`
- `apps/web/src/app/teacher/analytics/student/[id]/page.tsx`
- `apps/web/src/app/teacher/essays/page.tsx`
- `apps/web/src/app/teacher/essays/[id]/page.tsx`
- `apps/web/src/app/teacher/resources/page.tsx`
- `apps/web/src/app/teacher/resources/[type]/page.tsx`
- `apps/web/src/app/teacher/students/page.tsx`
- `apps/web/src/app/teacher/students/[id]/page.tsx`
- `apps/web/src/app/teacher/tasks/page.tsx`

**已知小瑕疵**:`students/page.tsx:86` 与 `students/[id]/page.tsx:96` 因 `shadow-md → ring-1 ring-border` 机械替换,与原有 `border border-border` 共存形成重复边框。P5 视觉抽检时决定保留 `ring-1 ring-border` 并移除 `border border-border`(在 D 阶段处理)。

### 未启动 ❌

**B5 — student/ 业务页面 (13 文件,~155 处 legacy)**:Grep 命中如下(按密度排序):

| 文件 | text-text/bg-bg/etc. | text-xs/sm/base/lg/xl/2xl/3xl | 合计 |
|---|---|---|---|
| `app/student/progress/page.tsx` | 26 | 19 | 45 |
| `app/student/practice/page.tsx` | 22 | 13 | 35 |
| `app/student/practice/[id]/page.tsx` | 17 | 14 | 31 |
| `app/student/practice/mock/page.tsx` | 17 | 14 | 31 |
| `app/student/tasks/[id]/write/page.tsx` | 17 | 10 | 27 |
| `app/student/write/page.tsx` | 16 | 10 | 26 |
| `app/student/dashboard/page.tsx` | 10 | 12 | 22 |
| `app/student/errors/page.tsx` | 13 | 9 | 22 |
| `app/student/assistant/page.tsx` | 10 | 9 | 19 |
| `app/student/essays/[id]/page.tsx` | 11 | 7 | 18 |
| `app/student/essays/page.tsx` | 11 | 5 | 16 |
| `app/student/errors/[type]/page.tsx` | 5 | 4 | 9 |
| `app/student/tasks/page.tsx` | 6 | 4 | 10 |

**B6 — 鉴权/管理员/学校/首页 (5 文件,~31 处 legacy)**:

| 文件 | text-text/bg-bg/etc. | text-xs/sm/base/lg/xl/2xl/3xl | 合计 |
|---|---|---|---|
| `app/register/page.tsx` | 12 | 11 | 23 |
| `app/login/page.tsx` | 6 | 6 | 12 |
| `app/page.tsx`(首页) | 3 | 2 | 5 |
| `app/admin/dashboard/page.tsx` | 5 | 3 | 8 |
| `app/school/dashboard/page.tsx` | 5 | 3 | 8 |

**C — P4 移动端令牌对齐**:[apps/mobile/src/theme/tokens.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/mobile/src/theme/tokens.ts) 当前 accent 仍为浅葱 `#33A6B8`(旧),无 neutral 1-10 色阶,无和色 semantic,dark neutral 为暖灰(非纯灰)。

**D — P5 全量验收 + 收官提交**:typecheck/lint/build + grep 残留 + 移除 globals.css 中 legacy aliases 块 + 视觉抽检 + 最终提交。

### 同时未提交的非 Yohaku 工作树变更(超出本计划范围)

`git status` 显示大量与本任务无关的 Modified/Untracked 文件(Phase 3 教师端功能 + T4 移动端基础设施未提交):
- `apps/mobile/src/{components/charts,lib/api,lib/auth,lib/notifications,lib/storage}/*`
- `apps/web/src/lib/api/*`(rate-limiter、routes、fetcher 等)
- `apps/web/src/lib/auth.ts`、`apps/web/src/lib/hooks/use-essay-draft.ts`
- `apps/web/src/instrumentation.ts`(untracked,Next.js instrumentation hook)
- `apps/web/next.config.ts`、`apps/web/package.json`
- `apps/worker/*`
- `packages/{ai,db,shared}/*`

**决策**:本计划严格 `git add <specific-files>` 暂存 Yohaku 相关文件,**绝不**`git add -A` 或 `git add .`,避免误把上述未提交工作卷入 Yohaku 提交。

### P1/P2 基础设施在工作树未提交(需在 D 阶段收官)

P1 令牌层(packages/design-system/src/tokens/*)+ P2 UI 原语(layout.tsx、theme-provider.tsx、theme-toggle.tsx、button.tsx、card.tsx、badge.tsx、input.tsx、dashboard-layout.tsx)在工作树已就位但从未提交。前序 B1-B3 提交引用了这些未提交令牌,工作树一致即可开发,但历史链不严谨。

**决策**:在 D 阶段收官提交时,把这些 P1/P2 基础设施文件一并纳入"移除 legacy aliases"提交,使仓库自洽。

## 提议变更

### 通用替换规则(适用于 B5、B6 所有文件)

继承自上游计划,此处摘录核心映射表:

| 旧模式 | 新模式 | 说明 |
|---|---|---|
| `text-text-primary` | `text-neutral-10` | |
| `text-text-secondary` | `text-neutral-8` | |
| `text-text-tertiary` | `text-neutral-7` | |
| `text-text-disabled` | `text-neutral-6` | |
| `bg-bg-primary` | `bg-paper` | |
| `bg-bg-secondary` | `bg-neutral-2` | |
| `bg-bg-tertiary` | `bg-neutral-3` | |
| `bg-bg-elevated` | `bg-neutral-1` | |
| `border border-border-hover` | `ring-1 ring-neutral-4` | |
| `bg-accent-hover` | `hover:opacity-90`(配合 `bg-accent`) | |
| `bg-accent-light` | `bg-accent/10` | |
| `bg-accent-dark` | `bg-accent`(暗色自动反相) | |
| `shadow-sm`/`shadow`/`shadow-md`/`shadow-lg` | `ring-1 ring-border` | Yohaku 禁硬阴影 |
| `text-xs` | `text-label-12` | |
| `text-sm` | `text-copy-14` | |
| `text-base` | `text-copy-16` 或 `text-title-20` | **按上下文判断**:CardTitle/标题用 title-20,正文用 copy-16 |
| `text-lg` | `text-copy-16` 或 `text-title-20` | 同上 |
| `text-xl` | `text-title-20` | |
| `text-2xl` | `text-title-24` | |
| `text-3xl` | `text-title-28` | |
| `text-4xl`/`text-5xl` | `text-display-36`/`text-display-48` | 按视觉判断 |
| CJK 上的 `font-bold`/`font-semibold` | `font-medium` | CJK 不允许合成粗体 |
| `neutral-50..950` | `neutral-1..10` | Yohaku 色阶 |

**重要**:Edit 工具 `replace_all` 在并行调用同一文件时不可靠(详见前序总结)。B5/B6 文件密度高,采用以下策略:
1. 单文件内多个相同字符串的替换:用更精确的上下文 + `replace_all: true` 串行执行
2. 13 文件 B5 批次:用 Agent 子任务并行处理(每文件独立,无并发冲突)
3. 每批完成后用 Grep 验证残留 = 0,再 `pnpm --filter @betterwrite/web typecheck`

---

### 阶段 B4-Commit — 教师 10 文件提交(无新代码改动)

**操作**:
```powershell
git add apps/web/src/app/teacher/dashboard/page.tsx `
        apps/web/src/app/teacher/analytics/page.tsx `
        apps/web/src/app/teacher/analytics/student/[id]/page.tsx `
        apps/web/src/app/teacher/essays/page.tsx `
        apps/web/src/app/teacher/essays/[id]/page.tsx `
        apps/web/src/app/teacher/resources/page.tsx `
        apps/web/src/app/teacher/resources/[type]/page.tsx `
        apps/web/src/app/teacher/students/page.tsx `
        apps/web/src/app/teacher/students/[id]/page.tsx `
        apps/web/src/app/teacher/tasks/page.tsx
git commit -m "style(web): migrate teacher pages to yohaku"
```

**理由**:工作树已就位,只需精准暂存 + 提交。PowerShell 不支持 `&&`,分两步。

**验收**:`git show --stat HEAD` 显示 10 文件,无其他文件卷入。

---

### 阶段 B5 — student/ 业务页面迁移(13 文件)

**执行策略**:委派 Agent 子任务并行处理(每文件独立)。给 Agent 的指令需明确:
1. 严格按通用替换规则表执行
2. `text-base`/`text-lg` 按上下文判断(CardTitle → `text-title-20`,正文 → `text-copy-16`)
3. `font-bold` 在 CJK 上 → `font-medium`
4. CJK 标题 `font-serif` 保留(是衬线字体选择,非粗体)
5. **Edit 工具**:同文件多 replace_all 必须串行;若 replace_all 不生效,改用带上下文的精确 Edit
6. 完成后 Grep 自检 `text-text-|bg-bg-|font-(bold|semibold)|shadow-(sm|md|lg)\b|text-(xs|sm|base|lg|xl|2xl|3xl)\b` 命中 = 0

**关键文件迁移要点**:

**`app/student/dashboard/page.tsx`**(22 处):
- L89 `border border-error/30 bg-error/10 p-3 text-sm text-error` → `ring-1 ring-error/30 bg-error/10 p-3 text-copy-14 text-error`(border → ring)
- L94 `text-2xl font-serif font-bold text-text-primary` → `text-title-24 font-serif font-medium text-neutral-10`
- L108 `text-3xl font-bold text-text-primary` → `text-title-28 font-medium text-neutral-10`
- L118、L132、L156 三处 `CardTitle className="text-base"` → `text-title-20`(标题上下文)
- L103 `CardTitle className="text-sm font-medium text-text-secondary"` → `text-copy-14 font-medium text-neutral-8`(副标题非标题,保留 copy)
- 其余 `text-text-*` → `text-neutral-*`、`text-sm` → `text-copy-14`

**`app/student/progress/page.tsx`**(45 处,密度最高):
- 全文 `text-text-*` → `text-neutral-*`、`text-sm` → `text-copy-14`、`text-xs` → `text-label-12`
- 所有 `font-bold` → `font-medium`(CJK)
- `text-2xl`/`text-3xl` 数值显示 → `text-title-24`/`text-title-28`
- CardTitle `text-base` → `text-title-20`

**`app/student/practice/[id]/page.tsx`、`app/student/practice/mock/page.tsx`、`app/student/practice/page.tsx`**(共 97 处):
- 同规则;若存在 `bg-bg-primary` 用于页面背景 → `bg-paper`
- `border border-border` → `ring-1 ring-border`(若与 shadow 同元素,合并为单一 ring)

**其余 8 文件**:统一机械替换,无特殊上下文判断。

**验收**:
```powershell
pnpm --filter @betterwrite/web typecheck
```
Grep 残留 = 0(允许 globals.css 中 legacy aliases 块的注释)。

**Commit**: `style(web): migrate student pages to yohaku`

```powershell
git add apps/web/src/app/student/dashboard/page.tsx `
        apps/web/src/app/student/practice/page.tsx `
        "apps/web/src/app/student/practice/[id]/page.tsx" `
        apps/web/src/app/student/practice/mock/page.tsx `
        apps/web/src/app/student/progress/page.tsx `
        apps/web/src/app/student/write/page.tsx `
        "apps/web/src/app/student/tasks/[id]/write/page.tsx" `
        apps/web/src/app/student/tasks/page.tsx `
        apps/web/src/app/student/assistant/page.tsx `
        apps/web/src/app/student/essays/page.tsx `
        "apps/web/src/app/student/essays/[id]/page.tsx" `
        apps/web/src/app/student/errors/page.tsx `
        "apps/web/src/app/student/errors/[type]/page.tsx"
git commit -m "style(web): migrate student pages to yohaku"
```

---

### 阶段 B6 — 鉴权/管理员/学校/首页迁移(5 文件)

**执行策略**:同 B5,Agent 并行处理。

**`app/login/page.tsx`**(12 处):
- L29 `bg-bg-primary` → `bg-paper`(页面背景)
- L32 `CardTitle className="text-2xl font-serif text-text-primary"` → `text-title-24 font-serif font-medium text-neutral-10`
- L33 `text-text-secondary text-sm` → `text-neutral-8 text-copy-14`
- L38、L52 label `text-sm font-medium text-text-primary` → `text-copy-14 font-medium text-neutral-10`
- L65 `text-error text-sm` → `text-error text-copy-14`
- L70 `text-text-secondary text-sm` → `text-neutral-8 text-copy-14`

**`app/register/page.tsx`**(23 处):
- 同规则,密度最高,需重点检查 `font-bold` 是否在 CJK 上(若有 → `font-medium`)
- CardTitle `text-2xl` → `text-title-24`
- label `text-sm` → `text-copy-14`

**`app/page.tsx`**(首页,5 处):
- L10 `CardTitle className="text-3xl font-serif text-text-primary"` → `text-title-28 font-serif font-medium text-neutral-10`
- L11 `text-text-secondary mt-2` → `text-neutral-8 mt-2`
- L14 `text-text-tertiary text-center text-sm` → `text-neutral-7 text-center text-copy-14`

**`app/admin/dashboard/page.tsx`、`app/school/dashboard/page.tsx`**(各 8 处):
- 同规则;`text-2xl` → `text-title-24`,所有 `text-text-*` → `text-neutral-*`

**验收**:
```powershell
pnpm --filter @betterwrite/web typecheck
pnpm --filter @betterwrite/web lint
```
Grep 残留 = 0(除 globals.css 的 legacy aliases 块)。

**Commit**: `style(web): migrate auth/admin/school/home pages to yohaku`

```powershell
git add apps/web/src/app/page.tsx `
        apps/web/src/app/login/page.tsx `
        apps/web/src/app/register/page.tsx `
        apps/web/src/app/admin/dashboard/page.tsx `
        apps/web/src/app/school/dashboard/page.tsx
git commit -m "style(web): migrate auth/admin/school/home pages to yohaku"
```

---

### 阶段 C — 移动端令牌对齐(1 文件)

**文件**: [apps/mobile/src/theme/tokens.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/mobile/src/theme/tokens.ts)

**变更**:完全重写 `colors` 与 `darkColors` 对象为 canonical Yohaku 值,并保留 legacy 字段名映射以避免破坏 StyleSheet 引用。

新 `colors` 对象:
```typescript
export const colors = {
  // Accent — 梅 ume (light)
  accent: '#c56473',
  accentHover: '#a85568',      // 梅加深 8%(hover 反馈)
  accentLight: '#f4dce0',      // 梅 5% mix(柔和填充)
  accentDark: '#f596aa',       // 桃 momo(暗色用,字段保留)

  // Neutral 1-10 — 暖米白
  neutral1: '#f9f8f5',
  neutral2: '#f0efeb',
  neutral3: '#e3e1db',
  neutral4: '#d0cec6',
  neutral5: '#a8a69f',         // n-5 NEVER for text
  neutral6: '#787670',
  neutral7: '#5c5a55',
  neutral8: '#403f3a',
  neutral9: '#24231f',
  neutral10: '#141312',

  // Surface
  paper: '#fefefb',
  border: '#e3e1db',

  // Semantic — 和色
  info: '#3d6896',              // 縹 hanada
  success: '#5e9f7e',            // 若竹 wakatake
  warning: '#a87a3d',           // 朽葉 kuchiba
  error: '#a64953',              // 蘇芳 suoh

  // ── Legacy aliases(过渡,与 web 同步在 P5 后单独清理)
  bgPrimary: '#fefefb',
  bgSecondary: '#f0efeb',
  bgTertiary: '#e3e1db',
  bgElevated: '#f9f8f5',
  textPrimary: '#141312',
  textSecondary: '#403f3a',
  textTertiary: '#5c5a55',
  textDisabled: '#787670',
  borderHover: '#d0cec6',
} as const;
```

新 `darkColors` 对象:
```typescript
export const darkColors = {
  // Accent — 桃 momo (dark)
  accent: '#f596aa',
  accentHover: '#f7a8ba',
  accentLight: '#3d2a30',       // 桃加深为深底
  accentDark: '#c56473',        // 梅(字段保留)

  // Neutral 反相纯灰(R=G=B)
  neutral1: '#141312',
  neutral2: '#1c1c1e',
  neutral3: '#242426',
  neutral4: '#2c2c2e',
  neutral5: '#5a5a5e',
  neutral6: '#7a7a7e',
  neutral7: '#9a9a9e',
  neutral8: '#b8b8bc',
  neutral9: '#d8d8dc',
  neutral10: '#f9f8f5',

  paper: 'rgb(28, 28, 30)',
  border: 'rgba(255, 255, 255, 0.1)',

  // Semantic(暗色不变,和色饱和度本身已适配)
  info: '#3d6896',
  success: '#5e9f7e',
  warning: '#a87a3d',
  error: '#a64953',

  // Legacy aliases(同上)
  bgPrimary: 'rgb(28, 28, 30)',
  bgSecondary: '#1c1c1e',
  bgTertiary: '#242426',
  bgElevated: '#2c2c2e',
  textPrimary: '#f9f8f5',
  textSecondary: '#b8b8bc',
  textTertiary: '#9a9a9e',
  textDisabled: '#7a7a7e',
  borderHover: '#3a3a3c',
} as const;
```

**保留**:`spacing`、`radius`、`fontSizes`、`fontWeights`、`lineHeights` 不动(RN 端用 Tailwind 默认尺寸的语义,非 web 的 role+px 体系)。

**验收**:
```powershell
pnpm --filter @betterwrite/mobile typecheck
```

**Commit**: `style(mobile): align tokens to yohaku canonical (梅/桃/和色/neutral)`

```powershell
git add apps/mobile/src/theme/tokens.ts
git commit -m "style(mobile): align tokens to yohaku canonical (梅/桃/和色/neutral)"
```

---

### 阶段 D — P5 全量验收与收官(4 步,2 commits)

#### D1 — 代码质量门禁

```powershell
pnpm -r typecheck
pnpm -r lint
pnpm -r build
```

**要求**:全部 0 error。Warn 允许但需逐条记录。

#### D2 — Legacy 残留 grep 终检

用 Grep 工具在 `apps/web/src/` 搜索:

**Pattern 1**:`text-text-|bg-bg-|border-border-hover|bg-accent-(hover|light|dark)|shadow-(sm|md|lg)\b|font-(bold|semibold)`

**Pattern 2**:`text-(xs|sm|base|lg|xl|2xl|3xl)\b`

**要求**:除 `apps/web/src/styles/globals.css`(legacy aliases 块注释,将在 D3 移除)外,业务文件命中 = 0。

**B4 已知瑕疵处理**:若 D2 在 `students/page.tsx` 或 `students/[id]/page.tsx` 命中 `border border-border`(因前述 shadow 替换副作用),在该元素上移除 `border border-border`,保留 `ring-1 ring-border`,作为 D 阶段的微调提交。

#### D3 — 移除 globals.css 中 legacy aliases 块

**文件**: [apps/web/src/styles/globals.css](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/styles/globals.css)

**变更**:删除第 98-114 行的整块 legacy aliases(从注释 `/* ─── Legacy aliases ───` 到 `--color-accent-dark: #f596aa;` 结束):

```css
  /* ──────────────────────────────────────────────────────────────────
   * Legacy aliases — keep existing bg-bg-* / text-text-* / accent-*
   * classes functional during P3 sweep. Removed once P3 completes and
   * grep confirms zero legacy class usage.
   * ────────────────────────────────────────────────────────────────── */
  --color-bg-primary: var(--surface-paper);
  --color-bg-secondary: var(--color-neutral-2);
  --color-bg-tertiary: var(--color-neutral-3);
  --color-bg-elevated: var(--color-neutral-1);
  --color-text-primary: var(--color-neutral-10);
  --color-text-secondary: var(--color-neutral-8);
  --color-text-tertiary: var(--color-neutral-7);
  --color-text-disabled: var(--color-neutral-6);
  --color-border-hover: var(--color-neutral-4);
  --color-accent-hover: var(--color-accent);
  --color-accent-light: color-mix(in srgb, var(--color-accent) 10%, transparent);
  --color-accent-dark: #f596aa;
```

#### D4 — 收官提交(P1/P2 基础设施 + legacy aliases 移除)

**Stage 范围**(严格按文件清单):

P1 令牌层(3 文件):
- `packages/design-system/src/tokens/yohaku.ts`
- `packages/design-system/src/tokens/colors.ts`
- `packages/design-system/src/tokens/index.ts`

P2 UI 原语与暗色基础设施(8 文件):
- `apps/web/src/app/layout.tsx`
- `apps/web/src/styles/globals.css`(含 D3 移除 legacy aliases)
- `apps/web/src/components/theme-provider.tsx`(untracked → 新增)
- `apps/web/src/components/layout/theme-toggle.tsx`(untracked → 新增)
- `apps/web/src/components/layout/dashboard-layout.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/input.tsx`

**B4 瑕疵微调**(若 D2 触发):
- `apps/web/src/app/teacher/students/page.tsx`
- `apps/web/src/app/teacher/students/[id]/page.tsx`

```powershell
git add packages/design-system/src/tokens/yohaku.ts `
        packages/design-system/src/tokens/colors.ts `
        packages/design-system/src/tokens/index.ts `
        apps/web/src/app/layout.tsx `
        apps/web/src/styles/globals.css `
        apps/web/src/components/theme-provider.tsx `
        apps/web/src/components/layout/theme-toggle.tsx `
        apps/web/src/components/layout/dashboard-layout.tsx `
        apps/web/src/components/ui/button.tsx `
        apps/web/src/components/ui/card.tsx `
        apps/web/src/components/ui/badge.tsx `
        apps/web/src/components/ui/input.tsx

# 若 D2 触发 B4 瑕疵微调, 追加:
# git add apps/web/src/app/teacher/students/page.tsx
# git add "apps/web/src/app/teacher/students/[id]/page.tsx"

git commit -m "chore(yohaku): commit P1/P2 foundation and remove legacy aliases"
```

**理由**:把这些从未提交的基础设施文件与"移除 legacy aliases"合并为一个语义内聚的提交——legacy aliases 块依赖 P1/P2 令牌存在,二者天然耦合;且让仓库自此自洽(B1-B3 提交链中引用的令牌自此全部进入版本控制)。

#### D5 — 双主题视觉抽检(手动)

启动 `pnpm --filter @betterwrite/web dev`,在 light/dark 切换下访问:

| 路由 | 检查项 |
|---|---|
| `/` | 首页卡片标题字号、欢迎文案层级 |
| `/login`、`/register` | 表单 focus ring(梅色)、按钮 hover 反馈、暗色背景纯灰 |
| `/student/dashboard` | 卡片表面 paper、stat 数值 title-28、BarChart 主色 |
| `/student/progress` | 45 处替换后字号体系、ring 边框 |
| `/student/practice/[id]` | 练习卡片、按钮交互 |
| `/teacher/dashboard` | 班级概览标题 title-24、stat title-28、状态 Badge 和色 |
| `/teacher/analytics` | 图表和色系列(梅/縹/若竹/朽葉/蘇芳)、网格线 neutral |
| `/teacher/students` | 表格 hover、Badge 颜色、ring 替代 shadow |
| `/teacher/essays/[id]` | correction-result 字号层级 display-48/title-24/copy-14 |

**通过判据**:
- 无 FOUC(首屏闪烁)
- 字号严格 role+px 体系(无 text-sm/base/lg 残留)
- 无硬阴影(全部 ring-1 ring-border)
- accent 出现频率 ≤5%(克制原则)
- 暗色 neutral 是纯灰(R=G=B),非暖色
- 暗色 accent 为桃 `#f596aa`

#### D6 — 移动端令牌视觉抽检(可选)

若 expo 可启动,检查 accent 为梅色(浅色)/桃色(暗色),neutral 为暖米白(浅色)/纯灰(暗色),semantic 用和色。

---

## 假设与决策

### 假设

1. `next-themes@^0.4.6` 已在 `apps/web/package.json`(工作树状态)就位。
2. Tailwind v4 `@theme` / `@theme inline` / `@custom-variant dark` 已在 globals.css 工作树就位。
3. `useColorScheme()` hook 在 mobile 已存在(无需新增逻辑,仅 token 值变化即生效)。
4. lucide-react 图标尺寸通过 `className="w-4 h-4"` 控制,与 `text-icon-*` 令牌不冲突(后者仅生成 `font-size`,对 lucide SVG 不生效)。
5. P1/P2 基础设施文件虽未提交,但工作树已就位且与 B1-B3 提交引用一致。

### 决策

1. **严格按文件清单 `git add`**:绝不使用 `git add -A` 或 `git add .`,避免卷入 Phase 3 教师端功能 + T4 移动端基础设施等未提交工作。
2. **B5 委派 Agent 并行**:13 文件相似度高但单文件密度大(45-9 处不等),并行处理显著降低墙钟时间;每文件独立无并发冲突。
3. **B6 同样委派 Agent 并行**:5 文件密度小且模式简单。
4. **`text-base`/`text-lg` 按上下文判断**:CardTitle/独立标题 → `text-title-20`,正文段落/列表项 → `text-copy-16`;不机械统一。
5. **CJK `font-bold`/`font-semibold` → `font-medium`**:严格执行,但 `font-serif`(衬线字体选择)保留。
6. **`border border-border` 与 `shadow-*` 同元素**:统一为 `ring-1 ring-border`,移除原 `border border-border`(避免重复边框)。
7. **legacy aliases 块在 D3 移除**:而非 P3 期间逐文件移除——避免迁移期间 app breakage。
8. **mobile 保留 legacy 字段映射**:与 web 端策略一致,过渡期保留 `bgPrimary/textPrimary` 等字段名指向 canonical token,P5 之后单独清理。
9. **P1/P2 基础设施并入 D4 收官提交**:与"移除 legacy aliases"语义耦合(aliases 依赖 P1/P2 令牌),且让仓库自此自洽。
10. **不清理 `apps/mobile/src/` legacy className**:mobile 用 StyleSheet 而非 Tailwind 类名,引用 `colors.accent` 等字段名,token 值变化即生效。

### 风险与缓解

| 风险 | 缓解 |
|---|---|
| Edit replace_all 并行不可靠 | Agent 内部串行 replace_all,辅以 Grep 自检 |
| B5 委派 Agent 误改其他文件 | 指令明确"仅修改指定 13 文件",Agent 完成后 Grep 验证残留范围 |
| `pnpm -r build` 超时(Next.js 16 canary) | 单独跑 `pnpm --filter @betterwrite/web build` |
| 暗色模式在某些页面未触发 | D5 视觉抽检覆盖关键路由,逐页排查 |
| B4 已知瑕疵(students border 重复)在 D2 触发 | 在 D4 收官提交中微调,作为同一提交的一部分 |
| `pnpm -r typecheck` 跨包失败 | 先跑 `pnpm --filter @betterwrite/web typecheck` 与 `pnpm --filter @betterwrite/mobile typecheck`,再升级到 `-r` |
| 误暂存非 Yohaku 工作树变更 | 严格按文件清单 `git add`,提交后 `git show --stat HEAD` 验证 |

## 验证步骤(总览)

```powershell
# B4 提交后
git show --stat HEAD  # 验证仅 10 个 teacher 文件

# B5 完成后
pnpm --filter @betterwrite/web typecheck
git show --stat HEAD  # 验证仅 13 个 student 文件

# B6 完成后
pnpm --filter @betterwrite/web typecheck
pnpm --filter @betterwrite/web lint
git show --stat HEAD  # 验证仅 5 个 auth/admin/school/home 文件

# C 完成后
pnpm --filter @betterwrite/mobile typecheck
git show --stat HEAD  # 验证仅 tokens.ts

# D 阶段
pnpm -r typecheck
pnpm -r lint
pnpm -r build
# D2: Grep 残留 = 0(除 globals.css 中的 legacy 块,将在 D3 移除)
# D4: git show --stat HEAD 验证 P1/P2 + globals.css 文件清单
# D5: 手动 dev 服务双主题视觉抽检
```

## 执行顺序总览

1. **阶段 B4-Commit** — 精准暂存 10 个 teacher 文件 → commit
2. **阶段 B5** — 委派 Agent 并行迁移 13 个 student 文件 → typecheck → Grep 验证 → 暂存 → commit
3. **阶段 B6** — 委派 Agent 并行迁移 5 个 auth/admin/school/home 文件 → typecheck → lint → Grep 验证 → 暂存 → commit
4. **阶段 C** — 重写 `apps/mobile/src/theme/tokens.ts` → mobile typecheck → 暂存 → commit
5. **阶段 D1** — `pnpm -r typecheck/lint/build` 全绿
6. **阶段 D2** — Grep 残留校验 = 0;若 students border 重复触发,标记微调
7. **阶段 D3** — 删除 globals.css 第 98-114 行 legacy aliases 块
8. **阶段 D4** — 暂存 P1/P2 基础设施(11 文件)+ globals.css(+ B4 微调 2 文件若触发)→ commit `chore(yohaku): commit P1/P2 foundation and remove legacy aliases`
9. **阶段 D5** — 启动 dev 服务,双主题视觉抽检 9 个关键路由
10. **阶段 D6** — (可选)expo 启动,移动端令牌视觉抽检

总计 5 个新 commits(B4-Commit、B5、B6、C、D4),完成全项目 Yohaku 化。
