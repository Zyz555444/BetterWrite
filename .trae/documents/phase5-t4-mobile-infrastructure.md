# Phase 5 — T4 移动端基础设施 实现计划

## Summary

为移动端搭建基础设施层,涵盖 6 个模块:API 客户端(Bearer token 注入)、API 方法集合(对照 web fetcher + 移动端独有路由)、认证状态管理(Zustand + SecureStore 持久化)、离线草稿存储(AsyncStorage)、推送通知注册(expo-notifications)、以及 4 个 RN SVG 图表组件(从 web 端口移植)。本任务为 T5/T6/T7 页面开发提供全部底层能力。

## Current State Analysis

**已完成(T1–T3):**
- T1: `apiTokens` + `deviceTokens` 表已建,迁移 `0003_black_gabe_jones.sql` 已生成
- T2: 5 个移动端 API 路由已实现于 `apps/web/src/lib/api/routes.ts`:
  - `POST /auth/token` — 移动端登录,返回 Bearer token + user
  - `GET /auth/tokens` — 列出当前用户活跃 token
  - `POST /auth/device-token` — upsert 推送 token
  - `POST /essays/ocr` — OCR 识别(STUDENT 权限)
  - `POST /notifications/test` — 测试推送
  - middleware.ts 已支持 Bearer token 分支(优先于 cookie session)
- T3: theme(tokens/styles/dark-mode)、6 个 UI 组件、4 个路由布局已就位
- `apps/mobile/package.json` 已包含全部依赖:expo-secure-store、expo-notifications、expo-constants、expo-device、react-native-svg、zustand、AsyncStorage

**参考实现:**
- `apps/web/src/lib/api/fetcher.ts` — 30+ 方法,`request<T>` + `ApiResponse<T>` 模式,`credentials: 'include'`
- `apps/web/src/lib/auth-store.ts` — Zustand,login/logout/fetchMe,`normalizeUser()` 映射
- `apps/web/src/components/charts/*.tsx` — 4 个纯 SVG 图表(无第三方依赖),使用 CSS vars
- `apps/mobile/src/components/ui/Button.tsx` — 已确立 `colors: ThemeColors` prop 注入模式

**关键差异(web → mobile):**
- 认证:cookie session → Bearer token(SecureStore 持久化)
- API_BASE:`NEXT_PUBLIC_API_URL` env → Expo Constants `extra.apiUrl`
- 图表:HTML `<svg>` + CSS vars → react-native-svg + token 常量
- 草稿:仅云端 → AsyncStorage 离线 fallback + 云端同步
- 推送:无 → expo-notifications + Expo Push API

## Proposed Changes

### 1. App.json 配置 — `apps/mobile/app.json` (MODIFY)

在 `expo` 对象中添加 `extra` 字段,提供 API_BASE 配置:

```json
"extra": {
  "apiUrl": "http://localhost:3000"
}
```

理由:Expo 标准做法,通过 `expo-constants` 读取,无需环境变量;开发用 localhost,生产构建时通过 EAS Update 或 `app.json` 覆盖。

### 2. API 客户端 — `apps/mobile/src/lib/api/client.ts` (NEW)

核心 `request<T>(path, options)` 函数,封装 fetch:

- **API_BASE 读取**:`Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3000'`
- **Bearer token 注入**:从 SecureStore 读取 `@betterwrite/token`,设置 `Authorization: Bearer xxx` header
- **Content-Type**:默认 `application/json`(与 web 一致)
- **401 处理**:检测 `res.status === 401` → 清除 SecureStore token → 抛出 `AuthError`(自定义类,含 `isAuthError = true` 标识)
- **错误透传**:非 2xx 时解析 `{ success, error }` 并抛出 `Error(error ?? '请求失败')`
- **返回值**:直接返回 `await res.json() as T`(T 通常是 `ApiResponse<U>`)
- 导出 `AuthError` 类供 auth store 识别

日志前缀:`[APIClient]`(与 web `[API /xxx]` 区分,标识移动端来源)

### 3. API Fetcher — `apps/mobile/src/lib/api/fetcher.ts` (NEW)

**类型定义(文件顶部重新定义,与 web 一致):**
- `AuthUserResponse`、`Essay`、`EssayTask`、`Correction`、`CorrectionDetail`、`StudentListItem`、`StudentDetail`、`ImportResult`、`TeachingResourceWithCreator`
- 复用 `@betterwrite/shared` 的 `ClassAnalytics`、`StudentAnalytics`、`TeachingResource`、`Achievement`、`AiAssistantResult`、`AiConversation`、`DailyQuote`、`ErrorBookGroup`、`ErrorBookItem`、`EssayDraft`、`PracticeExercise`、`QuestionBankItem`、`StudentProgress`

**方法清单(对照 web fetcher,删除移动端不适用项):**

| 分类 | 方法 | 路由 | 说明 |
|------|------|------|------|
| **认证(移动端独有)** | `loginWithToken(email, password, platform, deviceName)` | POST /auth/token | 返回 `{ token, user }` |
| | `listTokens()` | GET /auth/tokens | 列出活跃 token |
| | `registerDeviceToken(token, platform)` | POST /auth/device-token | 上报推送 token |
| **认证(通用)** | `register(body)` | POST /auth/register | 注册(复用 web) |
| | `logout()` | POST /auth/logout | 清除服务端 session(token 模式下空操作,但保持调用一致性) |
| | `me()` | GET /auth/me | 获取当前用户 |
| **通知(移动端独有)** | `sendTestNotification()` | POST /notifications/test | 测试推送 |
| **OCR(移动端独有)** | `submitOcr(imageBase64, taskId?)` | POST /essays/ocr | OCR 识别 |
| **作文** | `submitEssay`、`listMyEssays`、`getEssay`、`getCorrection` | 同 web | 完全一致 |
| **任务** | `listTasks`、`getTask`、`createTask` | 同 web | 完全一致 |
| **教师** | `getTeacherDashboard`、`listTeacherClasses`、`listTeacherEssays`、`getClassAnalytics`、`getStudentAnalytics`、`listStudents`、`getStudentDetail`、`importStudents`、`updateStudentTag` | 同 web | 完全一致(删除 `exportClassAnalytics`,web 专用 CSV 下载) |
| **教学资源** | `listResources`、`getResource`、`createResource`、`updateResource`、`deleteResource` | 同 web | 完全一致 |
| **错题本** | `getErrorBookGroups`、`syncErrorBook`、`generateErrorPractice`、`getErrorBookByType`、`masterError` | 同 web | 完全一致 |
| **学生进度** | `getStudentProgress`、`getAchievements` | 同 web | 完全一致 |
| **AI 助手** | `aiPolish`、`aiUpgrade`、`aiSynonym`、`aiGrammar`、`getAiHistory` | 同 web | 完全一致 |
| **题库/练习** | `getQuestionBank`、`getQuestion`、`submitPractice`、`submitPracticeDeep`、`getPracticeHistory` | 同 web | 完全一致 |
| **学生仪表盘** | `getStudentDashboard` | 同 web | 完全一致 |
| **草稿** | `getDraft`、`saveDraft`、`deleteDraft` | 同 web | 与本地 draft-storage 配合(云端同步) |

实现要点:
- 所有方法调用 `client.ts` 的 `request<T>` 函数
- `body: JSON.stringify(...)` 与 web 一致
- query 参数构造(URLSearchParams)与 web 一致

### 4. 认证 Store — `apps/mobile/src/lib/auth/store.ts` (NEW)

Zustand store,结构对照 web `auth-store.ts`,增加 token 持久化:

```typescript
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleType;
  schoolId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;  // 是否已从 SecureStore 恢复
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}
```

**SecureStore 键:**
- `@betterwrite/token` — Bearer token 字符串
- `@betterwrite/user` — user 对象 JSON 序列化

**方法逻辑:**
- `login(email, password)`:
  1. 调用 `fetcher.loginWithToken(email, password, Platform.OS, Device.deviceName ?? 'unknown')`
  2. 成功后 `SecureStore.setItem('token', ...)` + `SecureStore.setItem('user', JSON.stringify(user))`
  3. set `{ user, token, isLoading: false }`
  4. 失败时 set error 并 throw
- `logout()`:
  1. `SecureStore.deleteItem('token')` + `SecureStore.deleteItem('user')`
  2. set `{ user: null, token: null }`
  3. 不调用后端(无 revoke token 路由,token 自然过期)
- `fetchMe()`:
  1. 调用 `fetcher.me()`
  2. 成功 → set user + 同步 SecureStore
  3. 失败(401 AuthError)→ 触发 logout 状态重置
- `restoreSession()`:
  1. 从 SecureStore 读取 token + user
  2. 若有 token → set user(乐观恢复)+ 调用 fetchMe 验证
  3. 若无 token → set `{ user: null, token: null, isHydrated: true }`
  4. 用于 app 启动时(`_layout.tsx` 中调用,T5 实现)
- `normalizeUser()` — 与 web 一致,处理 `userId` → `id` 映射

平台/设备名:`Platform.OS`(ios/android)、`Device.deviceName`(expo-device)

### 5. 离线草稿存储 — `apps/mobile/src/lib/storage/draft-storage.ts` (NEW)

使用 AsyncStorage,作为云端 `/api/student/drafts` 的离线 fallback:

```typescript
export interface LocalDraft {
  taskId: string;
  content: string;
  wordCount: number;
  durationMs: number;
  savedAt: string;  // ISO timestamp
}

export async function saveLocalDraft(taskId: string, body: { content: string; wordCount: number; durationMs: number }): Promise<void>
export async function getLocalDraft(taskId: string): Promise<LocalDraft | null>
export async function removeLocalDraft(taskId: string): Promise<void>
export async function listLocalDrafts(): Promise<LocalDraft[]>
```

- 键格式:`@betterwrite/draft/{taskId}`
- `listLocalDrafts` 通过 `getAllKeys()` 过滤前缀实现
- 使用场景(T6 页面):写作时先调 `saveLocalDraft`(即时本地),再调 `fetcher.saveDraft`(云端同步);网络异常时仅本地保存

### 6. 推送通知 — `apps/mobile/src/lib/notifications/push.ts` (NEW)

```typescript
export async function registerForPushNotifications(): Promise<string | null>
export async function sendTestNotification(): Promise<void>
```

**`registerForPushNotifications` 逻辑:**
1. 检查 `Device.isDevice`(模拟器返回 null + 警告)
2. Android: 设置通知渠道(`Notifications.setNotificationChannelAsync`)
3. 调用 `Notifications.requestPermissionsAsync()`
4. 调用 `Notifications.getExpoPushTokenAsync()`(项目 ID 从 app.json 读取,可配置)
5. 调用 `fetcher.registerDeviceToken(token, Platform.OS)` 上报后端
6. 返回 token 或 null
7. 日志前缀 `[Push]`

**`sendTestNotification`:** 直接调用 `fetcher.sendTestNotification()`

**注意:** 通知前台/后台 handler 配置(`Notifications.setNotificationHandler`)留到 T8 细化,T4 仅实现注册 + 上报 + 测试发送。

### 7. RN SVG 图表组件 — `apps/mobile/src/components/charts/` (NEW, 5 files)

4 个组件从 web 端口移植,算法逻辑完全保留,只替换渲染层:

**通用替换规则:**
| web (HTML SVG) | mobile (react-native-svg) |
|----------------|--------------------------|
| `<svg>` | `<Svg>` |
| `<g>` | `<G>` |
| `<polygon>` | `<Polygon>` |
| `<line>` | `<Line>` |
| `<circle>` | `<Circle>` |
| `<rect>` | `<Rect>` |
| `<path>` | `<Path>` |
| `<text>` | `<Text>` |
| `var(--accent)` 等 CSS vars | `colors.accent` 等(从 useTheme 获取) |
| `currentColor` | `colors.accent` |
| `<title>` tooltip | 移除(RN 不支持) |
| `className` | 移除(用 style prop) |
| `width="100%"` | `style={{ width: '100%' }}` 或 `width={null}` + 父容器控制 |

**`RadarChart.tsx`:**
- props: `{ data: Array<{ label, value, max? }>, size?: number }`
- 内部 `const { colors } = useTheme()`
- 保留:cx/cy/radius 计算、`pointAt(index, ratio)` 函数、4 级网格、数据多边形、轴标签
- 移除:`<title>` tooltip
- 空数据状态:用 `<View>` + `<Text>` 替代 div

**`LineChart.tsx`:**
- props: `{ data: Array<{ label, value }>, height?: number, color?: string }`
- color 默认 `colors.accent`(替代 `currentColor`)
- 保留:padding 常量、maxVal/minVal 计算、stepX、linePath/areaPath、yTicks、labelStep
- 空数据状态:同上

**`BarChart.tsx`:**
- props: `{ data: Array<{ label, value }>, height?: number, color?: string }`
- color 默认 `colors.accent`
- 保留:padding、niceMax、slotWidth/barWidth、yTicks
- 空数据状态:同上

**`PieChart.tsx`:**
- props: `{ data: Array<{ label, value, color? }>, size?: number }`
- DEFAULT_COLORS 数组中 `var(--xxx)` → `colors.xxx`
- SVG 部分:保留 cumulativeAngle、path 构造、largeArc、label 定位
- **legend 部分:** 用 RN 原生组件替代 HTML:
  ```tsx
  <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
    <View>
      <Svg>...</Svg>
    </View>
    <View style={{ flex: 1, gap: 6 }}>
      {slices.map(s => (
        <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 12, height: 12, backgroundColor: s.color }} />
          <Text style={{ flex: 1, color: colors.textPrimary }}>{s.label}</Text>
          <Text style={{ color: colors.textSecondary }}>{s.value} · {s.percentage}%</Text>
        </View>
      ))}
    </View>
  </View>
  ```
- 响应式:`flexDirection` 在小屏上 `'column'`,大屏 `'row'`(简化:固定 `'column'` 适配移动端)

**`index.ts`:** barrel export 4 个图表

## Assumptions & Decisions

1. **API_BASE**:Expo Constants `extra.apiUrl`,开发默认 `http://localhost:3000`。需修改 app.json 添加 extra 字段。
2. **类型复用**:Essay/Correction 等 API 响应类型在 mobile fetcher 重新定义(与 web 一致),不跨 app 导入,不提取到 shared(避免扩大 T4 范围)。@betterwrite/shared 已有类型继续复用。
3. **401 处理**:client.ts 抛 `AuthError`,auth store 在 `fetchMe`/`restoreSession` 中 catch 并触发 logout 状态重置。
4. **logout 不调后端**:移动端 logout 仅清除 SecureStore(无 revoke token 路由),token 自然过期。如需即时撤销,后续可加路由。
5. **图表 colors 注入**:内部使用 `useTheme()` hook,无需调用方传入。与 UI 组件(colors prop)模式略有差异,因为图表更自包含、调用方通常无 colors 上下文。
6. **PieChart 布局**:固定 `flexDirection: 'column'`(移动端优先),legend 在图表下方。
7. **推送通知**:T4 仅实现注册 + 上报 + 测试发送;前台 handler、通知点击跳转留到 T8。
8. **离线草稿**:AsyncStorage 仅作离线 fallback,联网时优先 `fetcher.saveDraft` 同步云端。不实现自动同步队列(T8 细化)。
9. **不修改 web 代码**:所有改动限于 `apps/mobile/`。
10. **Biome 规范**:LF 行尾、显式类型注解(noImplicitAnyLet)、`'use client'` 指令移除(RN 不需要)。

## Verification Steps

1. **TypeScript**: `pnpm --filter @betterwrite/mobile typecheck` 通过
2. **Biome**: `pnpm --filter @betterwrite/mobile lint` 通过(必要时 `pnpm exec biome check --write apps/mobile/src` 规范化)
3. **手动对照检查**:
   - fetcher.ts 方法签名与 web fetcher 逐一对照(确保参数/返回类型一致)
   - 4 个图表组件算法与 web 版本逐行对照(三角函数、padding、坐标计算)
   - client.ts 正确注入 Bearer token + 处理 401
   - auth store 的 SecureStore 持久化逻辑(login 写入 / logout 清除 / restoreSession 读取)
   - draft-storage 键格式 `@betterwrite/draft/{taskId}`
   - push.ts 正确获取 ExpoPushToken 并上报
4. **不启动 Expo**(需模拟器/真机,留给 T9 集成验证)

## 文件清单(10 NEW + 1 MODIFY)

| # | 文件 | 类型 | 说明 |
|---|------|------|------|
| 1 | `apps/mobile/app.json` | MODIFY | 添加 `expo.extra.apiUrl` |
| 2 | `apps/mobile/src/lib/api/client.ts` | NEW | fetch 封装 + Bearer token 注入 + 401 处理 |
| 3 | `apps/mobile/src/lib/api/fetcher.ts` | NEW | 30+ API 方法(对照 web + 移动端独有) |
| 4 | `apps/mobile/src/lib/auth/store.ts` | NEW | Zustand + SecureStore 持久化 |
| 5 | `apps/mobile/src/lib/storage/draft-storage.ts` | NEW | AsyncStorage 离线草稿 |
| 6 | `apps/mobile/src/lib/notifications/push.ts` | NEW | expo-notifications 注册 + 上报 |
| 7 | `apps/mobile/src/components/charts/RadarChart.tsx` | NEW | RN SVG 雷达图 |
| 8 | `apps/mobile/src/components/charts/LineChart.tsx` | NEW | RN SVG 折线图 |
| 9 | `apps/mobile/src/components/charts/BarChart.tsx` | NEW | RN SVG 柱状图 |
| 10 | `apps/mobile/src/components/charts/PieChart.tsx` | NEW | RN SVG 饼图 |
| 11 | `apps/mobile/src/components/charts/index.ts` | NEW | barrel export |

## 依赖关系

T4 是 T5(认证页面)、T6(学生页面)、T7(教师页面)的前置依赖:
- T5 login 页面 → auth store + fetcher.loginWithToken
- T6 学生页面 → fetcher(全部学生方法)+ charts + draft-storage + push
- T7 教师页面 → fetcher(全部教师方法)+ charts
- T8 原生能力 → push.ts(完善)+ OCR(依赖 fetcher.submitOcr)+ draft-storage(自动同步)
