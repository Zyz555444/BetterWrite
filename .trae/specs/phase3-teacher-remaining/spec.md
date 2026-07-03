# Phase 3 教师端剩余功能 Spec

## Why
Phase 3 教师端目前只完成了「班级概览 / 作文任务 / 批改中心」三个基础模块，缺少数据分析、学生管理、教学资源三大模块。教师无法查看班级整体水平与学生个人成长曲线，无法管理学生名单，也无法沉淀范文库与句型库等教学资源。本变更补齐这三块，让教师端形成可日常使用的闭环。

## What Changes
- **新增数据库表**：`teaching_resources`（范文库/句型模板/连接词/错误案例统一存储）、`student_tags`（学生分层标签）
- **新增 API 路由**：
  - `/api/teacher/analytics/class/:classId` 班级报告
  - `/api/teacher/analytics/student/:studentId` 学生个人报告
  - `/api/teacher/students` 学生列表（筛选、搜索）
  - `/api/teacher/students/:id` 学生详情
  - `/api/teacher/students/import` 批量导入
  - `/api/teacher/students/:id/tags` 更新学生标签
  - `/api/teacher/resources` 教学资源 CRUD（含按类型筛选）
  - `/api/teacher/resources/:id` 单条资源操作
- **新增前端页面**：
  - `/teacher/analytics` 数据分析首页（班级报告）
  - `/teacher/analytics/student/[id]` 学生个人报告
  - `/teacher/students` 学生管理列表
  - `/teacher/students/[id]` 学生详情
  - `/teacher/resources` 教学资源首页
  - `/teacher/resources/[type]` 按类型浏览（sample/sentence/connector/errorcase）
- **新增前端组件**：雷达图、进步曲线、词云、Excel/CSV 导出
- **侧边栏导航更新**：在教师导航项中补充「数据分析」「教学资源」（学生管理已存在）
- **详细日志**：所有新增 API 与前端交互均加结构化日志，与既有模块保持一致

## Impact
- Affected specs: Phase 3 教师端开发实施计划
- Affected code:
  - 数据库：`packages/db/src/schema/`（新增 teaching_resources.ts、student_tags.ts，更新 index.ts）
  - 共享类型：`packages/shared/src/types/`（新增 TeachingResource、StudentTag 类型）
  - API：`apps/web/src/lib/api/routes.ts`（新增 8 个路由）
  - API 客户端：`apps/web/src/lib/api/fetcher.ts`（新增方法）
  - 布局：`apps/web/src/components/layout/dashboard-layout.tsx`（补充导航项）
  - 页面：`apps/web/src/app/teacher/`（新增 5 个页面目录）
  - 组件：`apps/web/src/components/`（新增图表与导出组件）

## ADDED Requirements

### Requirement: 班级数据分析
系统 SHALL 提供班级数据分析页面，展示平均分趋势、分数分布、高频错误统计、体裁表现对比，并支持导出 Excel。

#### Scenario: 教师查看班级报告
- **WHEN** 教师访问 `/teacher/analytics` 并选择某个任教班级
- **THEN** 页面展示该班级近 10 次任务的平均分折线图、分数段分布柱状图、高频错误 Top10、各体裁平均分对比
- **AND** 页面提供「导出 Excel」按钮，点击后下载包含明细数据的 .xlsx 文件

#### Scenario: 班级无数据
- **WHEN** 所选班级尚无任何已批改作文
- **THEN** 各图表区域显示空状态提示「暂无数据」，不报错

### Requirement: 学生个人报告
系统 SHALL 提供学生个人报告页，展示能力雷达图、分数进步曲线、错误类型分布、近期作文列表。

#### Scenario: 查看学生报告
- **WHEN** 教师从学生列表点击某学生进入详情
- **THEN** 页面展示该学生四维能力（内容/语言/结构/卷面）雷达图、近 20 篇作文分数曲线、错误类型饼图、近期作文卡片列表

### Requirement: 学生管理列表
系统 SHALL 提供学生列表，支持按班级筛选、按姓名/学号搜索、显示分层标签。

#### Scenario: 搜索与筛选
- **WHEN** 教师在学生管理页选择班级并输入关键词
- **THEN** 列表实时过滤显示匹配学生，每行展示姓名、学号、班级、标签、近期平均分、作文数

#### Scenario: 更新学生标签
- **WHEN** 教师在某学生行点击标签编辑
- **THEN** 弹出选择框，可从「优秀/良好/待提升/需关注」中选择，保存后立即生效

### Requirement: 学生批量导入
系统 SHALL 支持通过 CSV 批量导入学生，格式为 `name,email,studentNo`。

#### Scenario: 批量导入成功
- **WHEN** 教师上传符合格式的 CSV 文件并选择目标班级
- **THEN** 系统为每行创建学生账号并加入班级，返回成功数与失败明细

#### Scenario: CSV 格式错误
- **WHEN** 上传的 CSV 表头不匹配或字段缺失
- **THEN** 返回 400 错误，提示具体缺失字段，不执行任何导入

### Requirement: 教学资源管理
系统 SHALL 提供教学资源库，分四类：范文库、句型模板库、连接词库、错误案例库，支持增删改查与按体裁/难度筛选。

#### Scenario: 新增范文
- **WHEN** 教师在范文库点击「新增」并填写标题、体裁、难度、正文、亮点点评
- **THEN** 资源保存成功并出现在列表中

#### Scenario: 按类型浏览
- **WHEN** 教师点击教学资源页的某个分类卡片
- **THEN** 跳转到该分类列表页，支持搜索与分页

#### Scenario: 资源去重校验
- **WHEN** 教师尝试新增与已有资源标题（同类型下）完全相同的资源
- **THEN** 返回 409 错误提示「该类型下已存在同名资源」

### Requirement: 结构化日志
所有新增 API 路由与前端关键交互 SHALL 打印结构化日志，前缀为 `[API /xxx]` 或 `[TeacherXxx]`，包含 user id、关键参数、返回数量、耗时。

#### Scenario: API 日志
- **WHEN** 教师请求 `/api/teacher/analytics/class/:classId`
- **THEN** 服务端打印 `[API /teacher/analytics/class] user=xxx classId=yyy essays=12 duration=45ms`

## MODIFIED Requirements

### Requirement: 教师端侧边栏导航
原导航包含「班级概览 / 作文任务 / 批改中心 / 学生管理」，现补充「数据分析」「教学资源」两项，顺序为：班级概览 → 作文任务 → 批改中心 → 数据分析 → 学生管理 → 教学资源。
