# Yohaku 设计系统迁移 — 续作计划 (P2 收尾 → P5 验收)

> 本计划是 `yohaku-design-system-migration.md` 的续作,聚焦从当前断点继续执行到全量验收。
> 上游计划已锁定三个核心决策:梅 `#c56473` (light) / 桃 `#f596aa` (dark) accent、完整暗色模式含切换 UI、分阶段提交。

## 摘要

Yohaku 设计系统全项目迁移,已完成 P1(令牌层)与 P2 主体(UI 原语 + 暗色模式基础设施),仅剩 `role-guard.tsx` 一处遗漏。本计划覆盖剩余工作:P2 收尾 → P3 业务组件批量清扫(40 文件 / 914 行 legacy + 23 行硬编码颜色) → P4 移动端令牌对齐 → P5 全量验收。

## 当前状态分析 (Phase 1 探索结论)

### 已完成 ✅

**P1 — 令牌层** (3 文件)
- [yohaku.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/design-system/src/tokens/yohaku.ts):canonical 契约(neutral 1-10 / darkNeutral 反相 / 和色 semantic / 梅桃 accent / role+px fontSize / yohaku easing)
- [colors.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/design-system/src/tokens/colors.ts):ERROR_COLORS 派生自和色(蘇芳/朽葉/縹/梅/若竹)
- [globals.css](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/styles/globals.css):`@theme inline`(paper/sans/serif/mono) + `@theme`(accent/neutral/和色/字号/动画) + `.dark` 反相 + legacy aliases 块(过渡用,P5 移除)

**P2 — UI 原语 + 暗色** (8 文件,大部分完成)
- [layout.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/layout.tsx):Inter via next/font + ThemeProvider
- [theme-provider.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/theme-provider.tsx):next-themes 包装
- [theme-toggle.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/layout/theme-toggle.tsx):Sun/Moon + mounted 防 hydration
- [card.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/ui/card.tsx) / [button.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/ui/button.tsx) / [badge.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/ui/badge.tsx) / [input.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/ui/input.tsx):全部 canonical token
- [dashboard-layout.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/layout/dashboard-layout.tsx):ThemeToggle 接入桌面+移动

### 遗漏 ❌

**P2 收尾** — `role-guard.tsx:50` 仍为 `text-text-secondary`,应改为 `text-neutral-8`

### 待启动 ⏳

**P3 — 业务组件清扫** (40 文件,914 行 legacy + 23 行硬编码颜色)
- `components/charts/` 4 文件:11 行 legacy + 23 行硬编码 fill/stroke(独立项)
- `components/essay/correction-result.tsx` 1 文件:42 行(密度最高,含 2 处 font-bold)
- `components/student/` 6 文件:57 行
- `components/layout/role-guard.tsx` 1 文件:1 行(P2 收尾合并到此)
- `app/**/page.tsx` 28 文件:803 行(占 88%,主战场)

**P4 — 移动端对齐** — [tokens.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/mobile/src/theme/tokens.ts) 完全未 Yohaku 化:仍用浅葱 `#33A6B8`(旧) + Tailwind 通用色,无 neutral 色阶/梅/桃/和色

**P5 — 全量验收** — typecheck/lint/build + grep 残留校验 + 双主题视觉抽检 + legacy aliases 块移除

## 提议变更

### 阶段 A — P2 收尾(单文件,1 commit)

**文件**: `apps/web/src/components/layout/role-guard.tsx`

**变更** (line 50):
```diff
- <div className="animate-pulse text-text-secondary">加载中...</div>
+ <div className="animate-pulse text-neutral-8 text-copy-14">加载中...</div>
```

**理由**: P2 唯一遗漏点,补齐令 UI 原语层 100% canonical。
**验收**: `pnpm --filter @betterwrite/web typecheck` 通过。
**Commit**: `style(web): complete P2 yohaku migration of role-guard`

---

### 阶段 B — P3 业务组件清扫(7 批次,7 commits)

**通用替换规则** (适用于所有批次):
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
| `border-border-hover` | `ring-1 ring-border` | |
| `bg-accent-hover` | `hover:opacity-90` | 与原 `bg-accent` 配合 |
| `bg-accent-light` | `bg-accent/10` | |
| `bg-accent-dark` | `bg-accent` | 暗色自动反相 |
| `shadow-sm`/`shadow`/`shadow-md`/`shadow-lg` | `ring-1 ring-border` | Yohaku 禁硬阴影 |
| `text-xs` | `text-label-12` | |
| `text-sm` | `text-copy-14` | |
| `text-base` | `text-copy-16` | |
| `text-lg` | `text-copy-16` 或 `text-title-20` | **按上下文判断**:正文用 copy-16,标题用 title-20 |
| `text-xl` | `text-title-20` | |
| `text-2xl` | `text-title-24` | |
| `text-3xl` | `text-title-28` | |
| CJK 上的 `font-bold`/`font-semibold` | `font-medium` | CJK 不允许粗体 |
| `neutral-50..950` | `neutral-1..10` | Yohaku 色阶 |
| `w-4 h-4`(图标) | `text-icon-md` | 仅图标场景 |

**特殊规则 — recharts 硬编码颜色** (仅 charts/ 批次):
| 旧 CSS 变量 | 新和色语义 | 用途 |
|---|---|---|
| `var(--border)` | `var(--color-border)` | 网格线 |
| `var(--accent)` | `var(--color-accent)` | 主数据系列 |
| `var(--text-secondary)` | `var(--color-neutral-8)` | 次要数据系列 |
| `var(--text-tertiary)` | `var(--color-neutral-7)` | 空状态/网格 |
| `var(--bg-elevated)` | `var(--color-neutral-1)` | 卡片表面 |
| 硬编码 `"white"` | `var(--color-paper)` | 高对比文本 |
| 系列色 `s.color` / `{color}` | 派生自和色数组 `[#3d6896, #5e9f7e, #a87a3d, #a64953, #c56473]` | 多系列图表 |

#### 批次 B1 — charts/ (4 文件)

**文件**: [bar-chart.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/charts/bar-chart.tsx) / [line-chart.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/charts/line-chart.tsx) / [pie-chart.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/charts/pie-chart.tsx) / [radar-chart.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/charts/radar-chart.tsx)

**变更要点**:
1. 通用 legacy 替换(11 行)
2. recharts `stroke="var(--border)"` → `stroke="var(--color-border)"`(7 处)
3. `fill="var(--text-tertiary)"` → `fill="var(--color-neutral-7)"`(3 处)
4. `fill="var(--text-secondary)"` → `fill="var(--color-neutral-8)"`(4 处)
5. `fill="var(--accent)"` / `stroke="var(--accent)"` → `var(--color-accent)` (3 处)
6. `stroke="var(--bg-elevated)"` → `stroke="var(--color-neutral-1)"` (pie-chart.tsx)
7. `fill="white"` → `fill="var(--color-paper)"` (pie-chart.tsx)
8. 在每个 chart 文件顶部新增 `const SERIES_COLORS = ['#3d6896', '#5e9f7e', '#a87a3d', '#a64953', '#c56473'];`(和色数组),将 `s.color` / `{color}` 替换为按 index 取值

**Commit**: `style(web): migrate charts to yohaku with 和色 series palette`

#### 批次 B2 — essay/ (1 文件,密度最高)

**文件**: [correction-result.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/essay/correction-result.tsx)

**变更要点** (42 行):
1. 通用 legacy 替换
2. line 53、60 的 `font-bold` → `font-medium` (CJK)
3. `bg-accent-light` → `bg-accent/10`
4. `text-5xl` → `text-display-36` 或 `text-display-48`(按视觉判断)
5. 留意 `text-lg` 在该文件的出现(按上下文判断 copy-16 / title-20)

**Commit**: `style(web): migrate essay correction-result to yohaku`

#### 批次 B3 — student/ (6 文件)

**文件**: [ai-assistant-panel.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/student/ai-assistant-panel.tsx) (18 行) / [checklist-guard.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/student/checklist-guard.tsx) (11) / [achievement-badge.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/student/achievement-badge.tsx) (9) / [daily-quote.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/student/daily-quote.tsx) (8) / [error-card.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/student/error-card.tsx) (6) / [practice-card.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/student/practice-card.tsx) (5)

**变更**: 通用 legacy 替换 + 图标尺寸规范化

**Commit**: `style(web): migrate student components to yohaku`

#### 批次 B4 — teacher/ 业务页面 (11 文件,约 424 行)

**文件** (按密度排序):
- `app/teacher/resources/[type]/page.tsx` (97)
- `app/teacher/students/page.tsx` (66)
- `app/teacher/students/[id]/page.tsx` (53)
- `app/teacher/dashboard/page.tsx` (46)
- `app/teacher/tasks/page.tsx` (46)
- `app/teacher/analytics/page.tsx` (39)
- `app/teacher/analytics/student/[id]/page.tsx` (36)
- `app/teacher/essays/page.tsx` (27)
- `app/teacher/essays/[id]/page.tsx` (14)
- `app/teacher/resources/page.tsx` (12)
- `app/teacher/students/[id]/page.tsx` (合并上方)

**变更**: 通用 legacy 替换;CJK font-bold → font-medium;`shadow-*` → ring

**Commit**: `style(web): migrate teacher pages to yohaku`

#### 批次 B5 — student/ 业务页面 (13 文件,约 320 行)

**文件** (按密度排序):
- `app/student/practice/[id]/page.tsx` (31)
- `app/student/practice/mock/page.tsx` (31)
- `app/student/practice/page.tsx` (35)
- `app/student/progress/page.tsx` (45)
- `app/student/write/page.tsx` (26)
- `app/student/tasks/[id]/write/page.tsx` (27)
- `app/student/assistant/page.tsx` (19)
- `app/student/essays/[id]/page.tsx` (18)
- `app/student/essays/page.tsx` (16)
- `app/student/dashboard/page.tsx` (22)
- `app/student/errors/page.tsx` (22)
- `app/student/errors/[type]/page.tsx` (9)
- `app/student/tasks/page.tsx` (10)

**Commit**: `style(web): migrate student pages to yohaku`

#### 批次 B6 — 其他业务页面 (4 文件,约 59 行)

**文件**:
- `app/register/page.tsx` (23)
- `app/login/page.tsx` (12)
- `app/admin/dashboard/page.tsx` (8)
- `app/school/dashboard/page.tsx` (8)
- `app/page.tsx` (5) — 首页

**Commit**: `style(web): migrate auth/admin/school/home pages to yohaku`

#### 批次 B7 — dashboard-layout 图标尺寸收尾

**文件**: [dashboard-layout.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/layout/dashboard-layout.tsx)

**变更**:
1. 17 处 `w-4 h-4`(navItem.icon 内)→ `text-icon-md` (从 lucide 图标移除 className,在父 Link 上加 `text-icon-md` 或保留 w-4 h-4 兼容写法 — **决策见下**)
2. 2 处 `w-5 h-5`(Menu/X)→ `text-icon-lg`

**决策**: 由于 lucide 图标通过 `className="w-4 h-4"` 控制尺寸已是 RN 通用模式,且 `text-icon-md` 在 Tailwind 中实际生成 `font-size` 而非 `width/height`,对 lucide SVG 不生效。**保留 `w-4 h-4`** 是正确的,跳过此批次。

**结论**: 批次 B7 取消,改为合并到 B3 student components 的图标检查中(若发现 `text-icon-*` 误用再修)。

**Commit**: 不需要独立 commit

---

### 阶段 C — P4 移动端对齐(1 文件,1 commit)

**文件**: [apps/mobile/src/theme/tokens.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/mobile/src/theme/tokens.ts)

**变更**:
1. 重写 `colors` 对象:
   ```typescript
   export const colors = {
     // Accent
     accent: '#c56473',           // 梅 ume
     accentDark: '#f596aa',       // 桃 momo(暗色用)

     // Neutral 1-10(浅色暖米白)
     neutral1: '#f9f8f5',
     neutral2: '#f0efeb',
     neutral3: '#e3e1db',
     neutral4: '#d0cec6',
     neutral5: '#a8a69f',
     neutral6: '#787670',
     neutral7: '#5c5a55',
     neutral8: '#403f3a',
     neutral9: '#24231f',
     neutral10: '#141312',

     // Surface
     paper: '#fefefb',
     border: '#e3e1db',

     // Semantic 和色
     info: '#3d6896',       // 縹 hanada
     success: '#5e9f7e',    // 若竹 wakatake
     warning: '#a87a3d',    // 朽葉 kuchiba
     error: '#a64953',      // 蘇芳 suoh
   };
   ```
2. 重写 `darkColors` 对象:
   ```typescript
   export const darkColors = {
     accent: '#f596aa',       // 桃 momo
     accentDark: '#c56473',   // 梅(备用)

     // Neutral 反相纯灰
     neutral1: '#1c1c1e',
     neutral2: '#2c2c2e',
     neutral3: '#3a3a3c',
     neutral4: '#48484a',
     neutral5: '#545458',
     neutral6: '#787878',
     neutral7: '#9a9a9c',
     neutral8: '#bcbcbc',
     neutral9: '#e0e0e0',
     neutral10: '#f5f5f5',

     paper: 'rgb(28, 28, 30)',
     border: 'rgba(255, 255, 255, 0.1)',

     info: '#3d6896',
     success: '#5e9f7e',
     warning: '#a87a3d',
     error: '#a64953',
   };
   ```
3. **保留 legacy 字段映射**(过渡期,避免 break):
   ```typescript
   // Legacy aliases(过渡,与 web 端同步在 P5 移除)
   bgPrimary: colors.paper,
   bgSecondary: colors.neutral2,
   bgTertiary: colors.neutral3,
   bgElevated: colors.neutral1,
   textPrimary: colors.neutral10,
   textSecondary: colors.neutral8,
   textTertiary: colors.neutral7,
   textDisabled: colors.neutral6,
   borderHover: colors.neutral4,
   ```
4. **保留 RN fontSizes**(不强加 role+px,与上游计划一致)
5. **保留 `useColorScheme()` hook** — 无需改逻辑,仅 token 值变化即生效

**验收**:
- `pnpm --filter @betterwrite/mobile typecheck` 通过
- 视觉抽检(若 expo 可启动):梅色 accent、neutral 暖色阶

**Commit**: `style(mobile): align tokens to yohaku canonical (梅/桃/和色/neutral)`

---

### 阶段 D — P5 全量验收(无新文件,5 步)

#### D1 — 代码质量门禁
```powershell
pnpm -r typecheck
pnpm -r lint
pnpm -r build
```
**要求**: 全部 0 error。warn 允许但需记录。

#### D2 — Legacy 残留 grep 校验
用 Grep 工具(非 shell)在 `apps/web/src/` 搜索:
- `pattern`: `text-text-|bg-bg-|border-border-hover|bg-accent-(hover|light|dark)|text-(xs|sm|base|lg|xl|2xl|3xl)\b|shadow-(sm|md|lg)\b|font-(bold|semibold)`
- **要求**: 命中数 = 0(允许在 legacy-aliases CSS 块内的 `--color-bg-*` 注释)
- 若仍有命中,逐个修复或确认是否为误报(如第三方库 className)

#### D3 — Legacy aliases 块移除
**文件**: [globals.css](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/styles/globals.css)

**变更**: 删除文件末尾标记为 `/* Legacy aliases — remove after P3 sweep */` 的整块代码:
- `--color-bg-primary/secondary/tertiary/elevated`
- `--color-text-primary/secondary/tertiary/disabled`
- `--color-border-hover`
- `--color-accent-hover/light/dark`

**验收**: 删除后 `pnpm --filter @betterwrite/web build` 通过(确认无残留引用)

#### D4 — 双主题视觉抽检
启动 `pnpm --filter @betterwrite/web dev`,访问以下路由,在 light/dark 切换下检查:
- `/login` — 表单 focus 状态、按钮 hover
- `/student/dashboard` — 卡片表面、图标、文字层级
- `/teacher/analytics` — 图表和色系列、网格线
- `/teacher/students` — 表格 hover、Badge 颜色
- `/student/essays/[id]` — correction-result 字号层级

**检查项**:
- 无 FOUC(首屏闪烁)
- 字号严格 role+px 体系
- 无硬阴影(全部 ring)
- accent 出现频率 ≤5%(克制原则)
- 暗色 neutral 是纯灰(R=G=B),非暖色

#### D5 — 移动端令牌视觉抽检
若 expo 可启动,检查:
- accent 为梅色(浅色)/桃色(暗色)
- neutral 是暖米白(浅色)/纯灰(暗色)
- semantic 用和色

#### D6 — 最终 commit
**Commit**: `chore(yohaku): remove legacy aliases after full migration`

---

## 假设与决策

### 假设
1. `next-themes` 已安装(`apps/web/package.json` 第 33 行确认 `^0.4.6`)
2. Tailwind v4 `@theme` / `@theme inline` / `@custom-variant dark` 已在 globals.css 就位
3. `useColorScheme()` hook 在 mobile 已存在(无需新增)
4. lucide-react 图标尺寸通过 `className="w-4 h-4"` 控制,与 `text-icon-*` 令牌不冲突(后者仅用于装饰性 SVG 或文字场景)

### 决策
1. **分阶段提交**: P2 收尾(1) + P3(6 批次) + P4(1) + P5(1) = 共 9 commits,每批次独立可回滚
2. **`text-lg` 按上下文判断**: 不强制统一为 copy-16 或 title-20,逐个文件按视觉判断(正文 copy-16 / 标题 title-20)
3. **charts 系列色**: 引入和色数组 `[#3d6896, #5e9f7e, #a87a3d, #a64953, #c56473]`,按 index 取色,保证多系列图表视觉一致
4. **legacy aliases 块在 D3 移除**: 而非 P3 期间逐文件移除 — 避免迁移期间 app breakage
5. **mobile 保留 legacy 字段映射**: 与 web 端同步策略,过渡期保留 `bgPrimary/textPrimary` 等字段名指向 canonical token,P5 之后单独清理
6. **不清理 `apps/mobile/src/` legacy className**: Grep 确认 mobile 用 StyleSheet 而非 Tailwind 类名,无 legacy 残留

### 风险
| 风险 | 缓解 |
|---|---|
| P3 期间 app breakage | legacy aliases 块保留至 D3,过渡期令牌仍可用 |
| recharts 类型不兼容和色 CSS 变量 | 验证 `stroke="var(--color-border)"` 字符串字面量类型,必要时 `as any` cast |
| mobile tokens 重写 break 现有 StyleSheet | 保留 legacy 字段映射,仅新增 canonical token |
| 暗色模式在某些页面未触发 | D4 视觉抽检覆盖关键路由 |
| `pnpm -r build` 超时(Next.js 16 canary) | 单独跑 `pnpm --filter @betterwrite/web build` |

## 验证步骤(总览)

```powershell
# 每批次后
pnpm --filter @betterwrite/web typecheck

# P3 完成后
pnpm --filter @betterwrite/web lint
pnpm --filter @betterwrite/web build

# P4 完成后
pnpm --filter @betterwrite/mobile typecheck

# P5 全量
pnpm -r typecheck
pnpm -r lint
pnpm -r build
# + Grep 残留校验(D2)
# + 视觉抽检(D4/D5)
```

## 执行顺序总览

1. **阶段 A** — P2 收尾:role-guard.tsx:50 修复 → typecheck → commit
2. **阶段 B1** — charts/ 4 文件 → typecheck → commit
3. **阶段 B2** — essay/correction-result.tsx → typecheck → commit
4. **阶段 B3** — student/ 6 文件 → typecheck → commit
5. **阶段 B4** — teacher/ 11 页面 → typecheck → commit
6. **阶段 B5** — student/ 13 页面 → typecheck → commit
7. **阶段 B6** — auth/admin/school/home 5 页面 → typecheck → commit
8. **阶段 C** — mobile tokens.ts → typecheck → commit
9. **阶段 D** — P5 验收:typecheck/lint/build → grep 残留 → 移除 aliases 块 → 视觉抽检 → final commit
