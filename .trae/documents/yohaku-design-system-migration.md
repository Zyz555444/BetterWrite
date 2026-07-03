# Yohaku Design System 全项目迁移方案

## Context（背景）

BetterWrite 当前的样式系统只是「Yohaku 风格启发」——使用了浅葱色 `#33A6B8` 作 accent、自定义 `bg-primary/secondary`、`text-primary/secondary` 等 token 名，并大量混用 Tailwind 默认字号（`text-sm/base/lg/xl/2xl/3xl`）。这与 [Innei/Yohaku](https://github.com/Innei/Yohaku) 仓库公开的 canonical 设计契约有显著偏差：

- **Neutral 色阶**：项目用 `bg-bg-{primary,secondary,tertiary,elevated}` + `text-text-{primary,secondary,tertiary,disabled}`，而 canonical 用三层 10 阶 `neutral-1..10`（1-4 表面 / 5-7 边框·图标 / 8-10 正文·标题）。
- **字号**：项目用 Tailwind 默认 `text-xs..5xl`（canonical 明确禁止），缺少 role+px token（`text-copy-14`、`text-title-20` 等）。
- **强调色**：项目用浅葱 `#33A6B8`，canonical 仓库静态默认为梅 `#c56473`。
- **语义色**：项目用 Tailwind 通用色（`#16A34A` success、`#DC2626` error），canonical 用和色（若竹 `#5e9f7e`、蘇芳 `#a64953`、縹 `#3d6896`、朽葉 `#a87a3d`）。
- **暗色模式**：Web 端完全未实现（canonical 通过 neutral 色阶自动反相 + 暗色 accent 桃 `#f596aa`）。
- **阴影**：项目 `card.tsx` 等用了 `shadow-sm`，canonical 禁止硬阴影，改用 `ring-1 ring-border`。
- **字体**：声明了 Inter / Noto Serif SC 但未通过 `next/font` 实际加载；canonical 要求 `html { font-size: 14px }` + `letter-spacing: 0.01em`。

迁移规模：Web 端约 429 处 `text-text-*`、82 处 `bg-bg-*`、390 处 Tailwind 默认字号，分布在 ~44 个文件；移动端 `tokens.ts` 需对齐色值；`packages/design-system/src/tokens/yohaku.ts` 被误标，实为旧 schema，需重写。

## 锁定的设计决策（来自用户）

1. **强调色**：梅 `#c56473`（浅色模式，canonical 仓库默认）/ 桃 `#f596aa`（暗色模式）。
2. **暗色模式**：完整实现，含 `next-themes` 主题 Provider、切换 UI、全组件双主题测试。
3. **迁移方式**：分阶段提交（P1 基础 → P2 UI 原语+暗色 → P3 组件清扫 → P4 移动端 → P5 验收）。

## Token 映射表（旧 → canonical Yohaku）

### 颜色

| 旧 token | 旧值 | 新 token | 新值（浅色） | 备注 |
|---|---|---|---|---|
| `bg-bg-primary` / `--color-bg-primary` | `#fefefb` | `bg-paper` | `var(--surface-paper)` `#fefefb` | 页面背景，运行时可覆盖 |
| `bg-bg-secondary` | `#f8f8f5` | `bg-neutral-2` | `#f0efeb` | 卡片背景 |
| `bg-bg-tertiary` | `#f3f3f0` | `bg-neutral-3` | `#e3e1db` | 微填充 / hover |
| `bg-bg-elevated` | `#ffffff` | `bg-neutral-1` | `#f9f8f5` | 提升面（暗色自动反相） |
| `text-text-primary` | `#1a1a1a` | `text-neutral-10` | `#141312` | 标题、最高强调 |
| `text-text-secondary` | `#4a4a4a` | `text-neutral-8` | `#403f3a` | 正文次级 |
| `text-text-tertiary` | `#8a8a8a` | `text-neutral-7` | `#5c5a55` | 次级文本/说明 |
| `text-text-disabled` | `#bfbfbf` | `text-neutral-6` | `#787670` | 禁用态（n-5 禁用于文本） |
| `border-border` | `#e8e8e3` | `ring-border` / `border-border` | `rgba(24,24,27,0.1)` | canonical 用 `ring-border` 表达分割 |
| `border-border-hover` | `#d4d4cf` | `border-neutral-4` | `#d0cec6` | hover 边框 |
| `bg-accent-light` | `#e8f6f8` | `bg-accent/10` | — | 改用透明度叠加 |
| `bg-accent-dark` | `#f596aa` | `bg-accent`（暗色自动切换） | 桃 `#f596aa` | 暗色 accent 由主题注入 |
| `--color-accent` | `#33a6b8` | `--color-accent` | 梅 `#c56473` | **强调色更换** |
| `--color-accent-hover` | `#2a8f9f` | （移除，用 `hover:opacity-90`） | — | canonical 用透明度 |
| `--color-success` | `#16a34a` | `--color-success` | 若竹 `#5e9f7e` | 和色 |
| `--color-warning` | `#ca8a04` | `--color-warning` | 朽葉 `#a87a3d` | 和色 |
| `--color-error` | `#dc2626` | `--color-error` | 蘇芳 `#a64953` | 和色 |
| `--color-info` | `#2563eb` | `--color-info` | 縹 `#3d6896` | 和色 |

### 字号（role + px）

| 旧 | 新 | 说明 |
|---|---|---|
| `text-xs` (12) | `text-label-12` | meta / 小标签 |
| `text-sm` (14) | `text-copy-14` | **默认正文** |
| `text-base` (16) | `text-copy-16` | 大正文 |
| `text-lg` (18) | **逐处判断**：上下文偏正文→`text-copy-16`；偏标题→`text-title-20` | canonical 无 18px，需人工判断 |
| `text-xl` (20) | `text-title-20` | 区块标题 |
| `text-2xl` (24) | `text-title-24` | 子 H1 |
| `text-3xl` (30→28) | `text-title-28` | 页面 H1 |
| `text-4xl` (36) | `text-display-36` | hero |
| `text-5xl` (48) | `text-display-48` | OG / 大标题 |
| 图标 `w-4 h-4` 等 | `text-icon-sm/md/lg` | 仅用于 `<i>` / 图标元素 |

### 其他

| 旧 | 新 | 说明 |
|---|---|---|
| `shadow-sm/md/lg/xl` | `ring-1 ring-border`（或 `ring-1 ring-neutral-3`） | canonical 禁止硬阴影 |
| `font-semibold` / `font-bold`（CJK 上） | `font-medium` | CJK 禁合成粗体 |
| `rounded-lg` 卡片 | `rounded-lg`（保留） | canonical 卡片用 8px |
| `ease-yohaku` | `ease-yohaku`（保留） | `cubic-bezier(0.22, 1, 0.36, 1)` 已对齐 |

## 分阶段实施

### Phase 1 — Token 基础（design-system + globals.css）

**目标**：建立 canonical Yohaku token 契约，为后续清扫奠基。此阶段不触碰业务组件。

**关键文件**：
- `packages/design-system/src/tokens/yohaku.ts` — 重写为 canonical schema（导出 neutral 1-10、和色、梅/桃 accent、role+px 字号、ease）
- `apps/web/src/styles/globals.css` — 重写 `@theme` 块：
  - 引入 neutral 1-10 色阶（浅色暖米白 R>G>B；暗色纯灰 R=G=B，由 `:where(.dark)` 块覆盖）
  - accent 梅 `#c56473`，暗色 accent 桃 `#f596aa`（通过 `--color-accent` 在 `.dark` 下重定义）
  - 语义色和色：info 縹、success 若竹、warning 朽葉、error 蘇芳
  - 字号 token：`--text-caption-10` … `--text-display-48`，含 `--line-height`；清除 Tailwind 默认（`--text-xs/sm/base/lg/xl/2xl/3xl: initial`）
  - `--font-sans`（Inter → CJK 回退链）、`--font-serif`（Noto Serif CJK SC → Source Han Serif → SongTi SC…）、`--font-mono`
  - `@custom-variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *))`
  - `--color-paper: var(--surface-paper, #fefefb)`
  - `--color-border: rgba(24,24,27,0.1)`
  - `html { font-size: 14px; letter-spacing: 0.01em }`
  - 暗色 neutral 反相块（`:where(.dark) { --color-neutral-1: #141312; … --color-neutral-10: #f9f8f5; --surface-paper: rgb(28,28,30); --color-border: rgba(255,255,255,0.1) }`）
- `apps/web/src/app/layout.tsx` — 加 `next/font/google`（Inter sans + Noto Serif SC serif），通过 `variable` 注入 CSS 变量，绑到 `<html className={sans.variable + ' ' + serif.variable}>`
- `packages/design-system/package.json` — `exports` 增加 `"./tokens.css"`（可选，若要让 design-system 包导出 CSS）

**注意**：`apps/web/AGENTS.md` 标注 Next.js 16 canary 有 breaking changes。`next/font/google` API 需先查 `node_modules/next/dist/docs/` 确认调用方式未变。

**验收**：`pnpm --filter @betterwrite/web typecheck && pnpm --filter @betterwrite/web build` 通过；浏览器打开任意页面，背景应为 `#fefefb` 暖白、accent 为梅色 `#c56473`、Inter 字体加载、`html` 计算字号 14px。

### Phase 2 — UI 原语 + 暗色模式基础设施

**目标**：把基础组件和暗色切换接通，让后续业务组件有现成的原语可用。

**关键文件**：
- 安装 `next-themes`（若与 Next 16 canary 不兼容，回退方案：自写 `ThemeProvider` + `<script>` 注入 localStorage class，详见下方「风险」）
- `apps/web/src/app/layout.tsx`：
  - 包裹 `<ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>`
  - `<html lang="zh-CN" suppressHydrationWarning>` 防止暗色闪烁
- `apps/web/src/components/ui/card.tsx` — `border-border bg-bg-elevated shadow-sm` → `bg-neutral-1 ring-1 ring-border`；`text-lg font-semibold` → `text-title-20 font-medium`
- `apps/web/src/components/ui/button.tsx` — `text-sm/xs/base` → `text-copy-14/label-12/copy-16`；`bg-bg-secondary text-text-primary border-border` → `bg-neutral-2 text-neutral-10 ring-1 ring-border`；`text-text-secondary` → `text-neutral-8`；`bg-error` → `bg-error`（保留，色值已在 P1 改为蘇芳）
- `apps/web/src/components/ui/{badge,input}.tsx` — 同样映射
- `apps/web/src/components/layout/theme-toggle.tsx`（新增）— 用 `next-themes` 的 `useTheme()`，按钮放 `dashboard-layout.tsx` 顶栏；图标用 `lucide-react` 的 `Sun` / `Moon`
- `apps/web/src/components/layout/dashboard-layout.tsx` — 顶栏接入 `theme-toggle`；自身 legacy token 一并迁移
- `apps/web/src/components/layout/role-guard.tsx` — legacy token 迁移

**验收**：`pnpm typecheck && pnpm lint && pnpm build` 通过；点击主题切换按钮，`<html>` class 在 `light`/`dark` 间切换，基础组件（Card/Button/Input/Badge）在双主题下显示正常。

### Phase 3 — 业务组件清扫（按目录分批提交）

**目标**：把所有 `text-text-*`、`bg-bg-*`、Tailwind 默认字号替换为 canonical token。

**执行顺序**（按依赖与风险从低到高）：
1. `apps/web/src/components/charts/`（4 文件，recharts 配色也要换成和色）
2. `apps/web/src/components/essay/`（1 文件）
3. `apps/web/src/components/student/`（6 文件，含用户当前打开的 `checklist-guard.tsx`）
4. `apps/web/src/app/login/` + `register/`（独立页）
5. `apps/web/src/app/student/`（学生端页面）
6. `apps/web/src/app/teacher/`（教师端，文件最多——`resources/[type]/page.tsx`、`students/[id]/page.tsx`、`correction-result` 等是重灾区）
7. `apps/web/src/app/admin/` + `school/`
8. `apps/web/src/app/page.tsx`（首页）

**模式**：对每个文件，按上面映射表机械替换；`text-lg`（18px）逐处人工判断（偏正文→`text-copy-16`，偏标题→`text-title-20`）；移除 `font-semibold`/`font-bold` 在中文文本上 → `font-medium`；`shadow-*` → `ring-1 ring-border`；图表 `fill`/`stroke` 颜色换成和色。

**代表文件**（仅举几例，不逐一列举）：
- `apps/web/src/components/student/checklist-guard.tsx`（用户当前打开）：`text-base`→`text-title-20`、`text-sm`→`text-copy-14`、`bg-accent border-accent text-white`→`bg-accent text-white`、`border-border bg-bg-primary group-hover:border-border-hover`→`ring-1 ring-border bg-neutral-1 group-hover:ring-neutral-4`、`text-text-primary/text-secondary`→`text-neutral-10/text-neutral-8`、`text-success/text-error`→保留（和色已注入）、`bg-success/10`→保留、`bg-bg-secondary text-text-tertiary`→`bg-neutral-2 text-neutral-7`
- `apps/web/src/app/teacher/resources/[type]/page.tsx`（42+39 处，重灾区）
- `apps/web/src/components/essay/correction-result.tsx`（18+18 处）

**验收**：`grep -rE "text-text-|bg-bg-|text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b" apps/web/src` 应只剩注释或第三方代码（理想为 0）；每批 `pnpm --filter @betterwrite/web build` 通过；关键页面双主题视觉抽检。

### Phase 4 — 移动端对齐

**目标**：移动端 `tokens.ts` 的 hex 值对齐 canonical Yohaku，复用现有 `useColorScheme()` 暗色切换。

**关键文件**：
- `apps/mobile/src/theme/tokens.ts`：
  - `colors`：`accent` → `#c56473`（梅）；`bgPrimary`→`#fefefb`、`bgSecondary`→`#f0efeb`、`bgTertiary`→`#e3e1db`、`bgElevated`→`#f9f8f5`；`textPrimary`→`#141312`、`textSecondary`→`#403f3a`、`textTertiary`→`#5c5a55`、`textDisabled`→`#787670`；`border`→`rgba(24,24,27,0.1)`、`borderHover`→`#d0cec6`；`success`→`#5e9f7e`（若竹）、`warning`→`#a87a3d`（朽葉）、`error`→`#a64953`（蘇芳）、`info`→`#3d6896`（縹）
  - `darkColors`：`accent`→`#f596aa`（桃）；neutral 阶反相为纯灰（`bgPrimary`→`rgb(28,28,30)`、`bgSecondary`→`#1c1c1e`、…、`textPrimary`→`#f9f8f5`、…）；语义色暗色微调
- `apps/mobile/src/components/ui/*`（Button/Badge/Card/Input/Loading/Empty）— 检查是否有硬编码 hex，统一走 `tokens.ts`
- 移动端字号 token 是否要改 role+px？**不改**——RN 用 StyleSheet 数值，无 Tailwind 类名；保留 `fontSizes` 但可考虑加 `copy14/title20` 别名（可选，不强求）

**验收**：`pnpm --filter @betterwrite/mobile typecheck && lint` 通过；移动端双主题视觉抽检。

### Phase 5 — 全量验收

- `pnpm -r typecheck && pnpm -r lint && pnpm -r build` 全绿
- grep 校验：`grep -rE "text-text-|bg-bg-(primary|secondary|tertiary|elevated)|text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b|shadow-(sm|md|lg|xl)" apps/web/src apps/mobile/src` 应为 0（排除 `node_modules`、`.next`、`dist`）
- 视觉抽检（浅色 + 暗色）：
  - 登录/注册页
  - 学生端 dashboard、作文编辑器、自查卡（`checklist-guard`）
  - 教师端 班级概览、批改中心、数据分析（图表配色）、学生管理、教学资源
- 字体加载校验：DevTools Network 有 Inter / Noto Serif SC woff2；`getComputedStyle(html).fontSize === '14px'`
- 暗色闪烁校验：硬刷新暗色主题页面，无白屏闪烁

## 复用的现有工具/模式

- `cn()` 工具：`apps/web/src/lib/utils`（已在 card.tsx/button.tsx 使用）
- `class-variance-authority` (cva)：button.tsx 已用，主题切换按钮可复用同样模式
- 移动端 `createThemedStyles(isDark)`：`apps/mobile/src/theme/styles.ts:23`，P4 直接复用，仅换 hex 值
- 移动端 `useTheme()` / `useColorScheme()`：`apps/mobile/src/theme/dark-mode.ts:10`，已实现，无需重写
- `@betterwrite/design-system` 的 `getErrorColor()`：`packages/design-system/src/tokens/colors.ts`，ERROR_COLORS 的 hex 值需对齐和色（tense→蘇芳、spelling→朽葉 等），保留结构

## 风险与缓解

1. **Next.js 16 canary breaking changes**（AGENTS.md 警告）：
   - `next/font/google` 与 `next-themes` 的 API 可能与训练数据不同
   - 缓解：P1/P2 开工前先读 `node_modules/next/dist/docs/` 确认 `next/font` 与 `app/layout` 用法；若 `next-themes` 不兼容，回退自写 `ThemeProvider`（localStorage + `useLayoutEffect` 注入 `<html class>` + 内联 `<script>` 防 FOUC）
2. **`text-lg`（18px）无 canonical 对应**：需逐处人工判断，不能纯 code-mod。集中在 P3 的学生/教师页面。
3. **暗色 neutral 自动反相**：canonical 在 `.dark` 下把 `--color-neutral-1..10` 整体翻转。需确保组件用 `bg-neutral-2`（而非硬编码浅色）才能自动跟随。P3 清扫时若发现硬编码 `bg-white` 也要一并改成 `bg-neutral-1`。
4. **recharts 图表配色**：图表 `fill`/`stroke` 多为硬编码 hex，需在 P3 charts 目录专门处理，换成和色变量。
5. **大文件改动量**：`teacher/resources/[type]/page.tsx`（81 处）建议拆成单独提交，便于 review。

## 验证命令汇总

```bash
# 类型/构建/检查
pnpm -r typecheck
pnpm -r lint
pnpm -r build

# 残留旧 token 扫描（期望 0）
grep -rE "text-text-|bg-bg-(primary|secondary|tertiary|elevated)" apps/web/src apps/mobile/src --include="*.tsx" --include="*.ts"
grep -rE "\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b" apps/web/src --include="*.tsx"
grep -rE "\bshadow-(sm|md|lg|xl)\b" apps/web/src --include="*.tsx"

# 字体/字号校验（浏览器 DevTools）
# getComputedStyle(document.documentElement).fontSize  === '14px'
# getComputedStyle(document.body).fontFamily 包含 'Inter'
```
