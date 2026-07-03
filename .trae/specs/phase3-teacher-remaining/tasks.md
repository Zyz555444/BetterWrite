# Tasks

- [x] Task 1: 数据库 schema 扩展
  - [x] SubTask 1.1: 新增 `packages/db/src/schema/teaching_resources.ts`，字段含 id、type(sample/sentence/connector/errorcase)、title、topicType、difficulty、content、highlights、createdBy、createdAt、updatedAt
  - [x] SubTask 1.2: 新增 `packages/db/src/schema/student_tags.ts`，字段含 id、studentId、tag(excellent/good/improving/attention)、updatedBy、updatedAt，并加唯一索引 (studentId)
  - [x] SubTask 1.3: 在 `packages/db/src/schema/index.ts` 导出新表，并补充与 users/essays 的 relations
  - [x] SubTask 1.4: 运行 `pnpm db:generate` 生成迁移文件并执行 `pnpm db:migrate`

- [x] Task 2: 共享类型与常量扩展
  - [x] SubTask 2.1: 在 `packages/shared/src/constants/essay.ts` 新增 `TeachingResourceType`、`StudentTag` 常量与类型
  - [x] SubTask 2.2: 在 `packages/shared/src/types/essay.ts` 新增 `TeachingResource`、`StudentTagRecord`、`ClassAnalytics`、`StudentAnalytics` 类型
  - [x] SubTask 2.3: 在 `packages/shared/src/utils/index.ts` 新增 `calculateScoreDistribution`、`calculateErrorStats` 工具函数

- [x] Task 3: API 路由 — 数据分析
  - [x] SubTask 3.1: 新增 `GET /api/teacher/analytics/class/:classId`，返回平均分趋势、分数段分布、高频错误 Top10、体裁对比；含结构化日志
  - [x] SubTask 3.2: 新增 `GET /api/teacher/analytics/student/:studentId`，返回四维能力、进步曲线、错误分布、近期作文；含结构化日志
  - [x] SubTask 3.3: 新增 `GET /api/teacher/analytics/class/:classId/export`，返回 CSV/Excel 流（使用 `xlsx` 库或手写 CSV）

- [x] Task 4: API 路由 — 学生管理
  - [x] SubTask 4.1: 新增 `GET /api/teacher/students`，支持 classId 筛选与 keyword 搜索，返回学生列表含标签与统计；含日志
  - [x] SubTask 4.2: 新增 `GET /api/teacher/students/:id`，返回学生详情含近期作文与能力概览；含日志
  - [x] SubTask 4.3: 新增 `POST /api/teacher/students/import`，接收 CSV 文本与 classId，批量创建账号并入班；含日志
  - [x] SubTask 4.4: 新增 `PATCH /api/teacher/students/:id/tags`，更新学生分层标签；含日志

- [x] Task 5: API 路由 — 教学资源
  - [x] SubTask 5.1: 新增 `GET /api/teacher/resources`，支持 type/topicType/difficulty 筛选与分页；含日志
  - [x] SubTask 5.2: 新增 `POST /api/teacher/resources`，创建资源（含同类型同名去重校验）；含日志
  - [x] SubTask 5.3: 新增 `GET /api/teacher/resources/:id`、`PATCH /api/teacher/resources/:id`、`DELETE /api/teacher/resources/:id`；含日志

- [x] Task 6: API 客户端 fetcher 扩展
  - [x] SubTask 6.1: 在 `apps/web/src/lib/api/fetcher.ts` 新增 `getClassAnalytics`、`getStudentAnalytics`、`exportClassAnalytics`、`listStudents`、`getStudentDetail`、`importStudents`、`updateStudentTag`、`listResources`、`getResource`、`createResource`、`updateResource`、`deleteResource` 方法及对应 TS 类型

- [x] Task 7: 前端页面 — 数据分析
  - [x] SubTask 7.1: 创建 `apps/web/src/app/teacher/analytics/page.tsx`，含班级选择器、平均分趋势折线图、分数分布柱状图、高频错误列表、体裁对比；含前端日志
  - [x] SubTask 7.2: 创建 `apps/web/src/app/teacher/analytics/student/[id]/page.tsx`，含能力雷达图、进步曲线、错误分布饼图、近期作文列表；含前端日志
  - [x] SubTask 7.3: 新增图表组件 `apps/web/src/components/charts/`（LineChart、BarChart、RadarChart、PieChart），基于 recharts 或纯 SVG

- [x] Task 8: 前端页面 — 学生管理
  - [x] SubTask 8.1: 创建 `apps/web/src/app/teacher/students/page.tsx`，含班级筛选、关键词搜索、学生表格、标签编辑弹窗；含前端日志
  - [x] SubTask 8.2: 创建 `apps/web/src/app/teacher/students/[id]/page.tsx`，含学生基本信息、能力概览、近期作文列表、标签；含前端日志
  - [x] SubTask 8.3: 在学生管理页增加「批量导入」入口与 CSV 上传弹窗（含模板下载与校验提示）

- [x] Task 9: 前端页面 — 教学资源
  - [x] SubTask 9.1: 创建 `apps/web/src/app/teacher/resources/page.tsx`，含四个分类卡片入口；含前端日志
  - [x] SubTask 9.2: 创建 `apps/web/src/app/teacher/resources/[type]/page.tsx`，含资源列表、筛选、搜索、新增按钮；含前端日志
  - [x] SubTask 9.3: 新增资源新增/编辑弹窗组件与资源详情查看组件

- [x] Task 10: 布局与导航更新
  - [x] SubTask 10.1: 在 `apps/web/src/components/layout/dashboard-layout.tsx` 的 navItems 中补充「数据分析」「教学资源」两项，插入到教师导航正确位置

- [x] Task 11: 验证与联调
  - [x] SubTask 11.1: 启动开发服务器，登录教师账号，逐一访问 5 个新页面，确认无运行时错误
  - [x] SubTask 11.2: 创建测试数据（学生、作文、批改、教学资源），验证图表与列表数据正确
  - [x] SubTask 11.3: 验证 CSV 导入与导出流程
  - [x] SubTask 11.4: 检查所有日志在服务端与浏览器控制台正确输出

# Task Dependencies
- Task 2 依赖 Task 1（类型需引用 schema 字段）
- Task 3、4、5 依赖 Task 1、2（需要表与类型）
- Task 6 依赖 Task 3、4、5（fetcher 方法对应 API 路由）
- Task 7、8、9 依赖 Task 6（页面调用 fetcher）
- Task 10 可与 Task 7-9 并行
- Task 11 依赖所有前置任务完成
