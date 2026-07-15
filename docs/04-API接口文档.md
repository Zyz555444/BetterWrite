# BetterWrite — API 接口文档

> **版本**: v1.0  
> **Base URL**: `https://api.betterwrite.cn/v1`  
> **认证方式**: Bearer Token (JWT)  
> **内容类型**: `application/json`

---

## 目录

1. [通用规范](#1-通用规范)
2. [认证接口](#2-认证接口)
3. [用户管理](#3-用户管理)
4. [学校管理](#4-学校管理)
5. [班级管理](#5-班级管理)
6. [作文任务](#6-作文任务)
7. [作文批改](#7-作文批改)
8. [数据分析](#8-数据分析)
9. [AI 助手](#9-ai-助手)
10. [错题本](#10-错题本)
11. [系统管理](#11-系统管理)

---

## 1. 通用规范

### 1.1 请求头

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 1.2 通用响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 1.3 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "认证已过期，请重新登录",
    "details": {}
  }
}
```

### 1.4 错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 未认证或Token过期 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 422 | 请求参数验证失败 |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `AI_PROVIDER_ERROR` | 502 | AI服务异常 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 2. 认证接口

### 2.1 登录

```
POST /auth/login
```

**请求体:**
```json
{
  "email": "teacher@school.com",
  "password": "securePassword123"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "teacher@school.com",
      "name": "张老师",
      "role": "teacher",
      "schoolId": "uuid",
      "avatarUrl": "https://..."
    },
    "token": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresAt": "2026-07-03T09:47:00Z"
  }
}
```

### 2.2 刷新Token

```
POST /auth/refresh
```

### 2.3 登出

```
POST /auth/logout
```

### 2.4 修改密码

```
PUT /auth/password
```

**请求体:**
```json
{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword123"
}
```

---

## 3. 用户管理

### 3.1 获取当前用户

```
GET /users/me
```

### 3.2 更新个人信息

```
PUT /users/me
```

**请求体:**
```json
{
  "name": "新名字",
  "avatarUrl": "https://..."
}
```

### 3.3 获取用户列表（按角色）

```
GET /users?role=student&schoolId=uuid&classId=uuid&page=1&pageSize=20
```

**权限**: super_admin, school_admin, teacher

### 3.4 创建用户

```
POST /users
```

**权限**: super_admin, school_admin, teacher

**请求体:**
```json
{
  "email": "student@school.com",
  "password": "tempPassword123",
  "name": "李同学",
  "role": "student",
  "schoolId": "uuid",
  "studentNo": "20250101"
}
```

### 3.5 批量导入用户

```
POST /users/batch-import
```

**权限**: super_admin, school_admin, teacher

**请求体**: `multipart/form-data` (Excel/CSV文件)

### 3.6 更新用户

```
PUT /users/:id
```

### 3.7 删除/停用用户

```
DELETE /users/:id          # 软删除
PUT /users/:id/activate    # 启用
PUT /users/:id/deactivate  # 停用
```

---

## 4. 学校管理

### 4.1 获取学校列表

```
GET /schools?region=福田&page=1&pageSize=20
```

**权限**: super_admin

### 4.2 创建学校

```
POST /schools
```

**权限**: super_admin

**请求体:**
```json
{
  "name": "深圳市福田区实验中学",
  "region": "福田",
  "contactName": "王校长",
  "contactPhone": "13800138000"
}
```

### 4.3 更新学校

```
PUT /schools/:id
```

**权限**: super_admin, school_admin(仅本校)

### 4.4 获取学校统计

```
GET /schools/:id/stats
```

**响应:**
```json
{
  "totalTeachers": 45,
  "totalStudents": 1200,
  "totalClasses": 30,
  "totalEssays": 5600,
  "averageScore": 10.5,
  "activeRate": 0.85
}
```

---

## 5. 班级管理

### 5.1 获取班级列表

```
GET /classes?schoolId=uuid&grade=初三&teacherId=uuid
```

**权限**: super_admin, school_admin, teacher

### 5.2 创建班级

```
POST /classes
```

**权限**: super_admin, school_admin

**请求体:**
```json
{
  "schoolId": "uuid",
  "name": "初三(1)班",
  "grade": "初三",
  "teacherId": "uuid",
  "academicYear": "2025-2026"
}
```

### 5.3 更新班级

```
PUT /classes/:id
```

### 5.4 班级成员管理

```
POST /classes/:id/enrollments     # 添加学生/教师
DELETE /classes/:id/enrollments/:userId  # 移除成员
GET /classes/:id/enrollments      # 成员列表
```

### 5.5 批量导入学生到班级

```
POST /classes/:id/enrollments/batch
```

---

## 6. 作文任务

### 6.1 获取任务列表

```
GET /tasks?classId=uuid&status=published&page=1&pageSize=20
```

**权限**: super_admin, school_admin, teacher, student

### 6.2 创建任务

```
POST /tasks
```

**权限**: super_admin, school_admin, teacher

**请求体:**
```json
{
  "classId": "uuid",
  "title": "My School Life",
  "topicType": "letter",
  "topicCategory": "school_life",
  "requirements": "假定你是李华，请给学弟学妹写一封建议信...",
  "keyPoints": [
    "从学习方面给出建议",
    "从兴趣爱好方面给出建议",
    "表达祝福"
  ],
  "referenceEssay": "Dear younger schoolmates...",
  "wordLimitMin": 75,
  "wordLimitMax": 100,
  "timeLimitMinutes": 15,
  "dueDate": "2026-07-10T23:59:59Z"
}
```

### 6.3 AI辅助出题

```
POST /tasks/ai-generate
```

**请求体:**
```json
{
  "topicCategory": "social_issues",
  "topicType": "argumentation",
  "difficulty": "medium",
  "keywords": ["AI", "education"]
}
```

**响应:**
```json
{
  "title": "AI in the Classroom",
  "topicType": "argumentation",
  "requirements": "越来越多的学校开始使用AI辅助教学...",
  "keyPoints": ["AI的优势", "AI的弊端", "你的观点"],
  "referenceEssay": "With the development of..."
}
```

### 6.4 更新/删除任务

```
PUT /tasks/:id
DELETE /tasks/:id
```

### 6.5 发布/关闭任务

```
PUT /tasks/:id/publish
PUT /tasks/:id/close
```

---

## 7. 作文批改

### 7.1 提交作文

```
POST /essays
```

**权限**: student

**请求体:**
```json
{
  "taskId": "uuid",
  "content": "Dear younger schoolmates, I'm writing to share some advice...",
  "submitType": "typed"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "wordCount": 85,
    "submittedAt": "2026-07-02T10:00:00Z"
  },
  "message": "作文已提交，正在排队批改中..."
}
```

### 7.2 获取作文列表

```
GET /essays?taskId=uuid&studentId=uuid&status=completed&page=1&pageSize=20
```

### 7.3 获取作文详情（含批改结果）

```
GET /essays/:id
```

**响应:**
```json
{
  "id": "uuid",
  "taskId": "uuid",
  "studentId": "uuid",
  "studentName": "李同学",
  "content": "Dear younger schoolmates...",
  "wordCount": 85,
  "status": "completed",
  "totalScore": 13.5,
  "scoreTier": "1st",
  "correction": {
    "id": "uuid",
    "contentScore": 4.0,
    "languageScore": 5.0,
    "structureScore": 2.5,
    "presentationScore": 1.5,
    "totalScore": 13.5,
    "scoreTier": "1st",
    "errors": [
      {
        "type": "subject_verb",
        "original": "He go to school",
        "corrected": "He goes to school",
        "explanation": "第三人称单数主语he，谓语动词go需加es",
        "position": { "start": 45, "end": 58 }
      }
    ],
    "errorStats": {
      "subject_verb": 1,
      "spelling": 1
    },
    "highlights": [
      {
        "sentence": "Not only is it beautiful, but also educational.",
        "type": "inversion",
        "comment": "倒装结构使用恰当，增加了句式多样性"
      }
    ],
    "sentenceAnalysis": [
      { "original": "Dear...", "comment": "开头格式正确", "isHighlight": false }
    ],
    "revisedEssay": "Dear younger schoolmates...",
    "suggestions": [
      {
        "priority": "high",
        "category": "语法",
        "suggestion": "注意第三人称单数动词变化，如he/she/it后的动词需加s/es"
      }
    ],
    "aiProvider": "openai",
    "aiModel": "gpt-4o"
  },
  "teacherReview": "整体不错，继续保持！",
  "teacherScore": 14.0,
  "submitType": "ocr",
  "ocrImageUrl": "https://cdn.betterwrite.cn/essays/xxx.jpg",
  "ocrConfidence": 0.95,
  "handwriting": {
    "neatnessScore": 1.2,
    "letterFormScore": 1.0,
    "alignmentScore": 1.3,
    "correctionMarks": 2,
    "overallScore": 1.2,
    "comment": "字迹总体较工整"
  },
  "submittedAt": "2026-07-02T10:00:00Z",
  "correctedAt": "2026-07-02T10:00:15Z"
}
```

### 7.4 查询批改状态

```
GET /essays/:id/status
```

**响应:**
```json
{
  "status": "correcting",
  "progress": "语言分析完成，正在进行内容分析...",
  "estimatedTimeLeft": 5
}
```

### 7.5 教师添加评语/调整分数

```
PUT /essays/:id/review
```

**权限**: teacher, school_admin

**请求体:**
```json
{
  "teacherReview": "整体不错，但需要注意连接词的使用。继续加油！",
  "teacherScore": 14.0
}
```

### 7.6 OCR提交（手写作文拍照上传 + 书写质量评估）

```
POST /essays/ocr
```

**请求体**: `multipart/form-data`
- `image`: 作文图片文件（支持 JPG/PNG/HEIC，建议分辨率 ≥ 1200px 宽）
- `taskId`: 任务ID

**响应:**
```json
{
  "success": true,
  "data": {
    "essayId": "uuid",
    "recognizedText": "Dear younger schoolmates...",
    "ocrConfidence": 0.95,
    "handwriting": {
      "neatnessScore": 1.2,
      "neatnessLabel": "较工整",
      "letterFormScore": 1.0,
      "letterFormLabel": "基本规范",
      "alignmentScore": 1.3,
      "alignmentLabel": "对齐良好",
      "correctionMarks": 2,
      "overallScore": 1.2,
      "comment": "字迹总体较工整，建议注意字母a的闭合书写"
    },
    "wordCount": 102,
    "status": "pending"
  }
}
```

**书写质量评分说明:**

| 维度 | 分值范围 | 评分项 |
|------|----------|--------|
| `neatnessScore` | 0-1.5 | 字母大小一致性、笔画清晰度 |
| `letterFormScore` | 0-1.5 | 字母规范性（闭合、倾斜、形态） |
| `alignmentScore` | 0-1.5 | 行对齐度、行间距均匀性 |
| `correctionMarks` | 整数 | 涂改次数（>3处开始扣分） |
| `overallScore` | 0-1.5 | 综合书写质量分（替代卷面分） |

### 7.7 导出作文

```
GET /essays/export?taskId=uuid&format=pdf|excel
```

---

## 8. 数据分析

### 8.1 班级数据概览

```
GET /analytics/class/:classId
```

**响应:**
```json
{
  "totalStudents": 45,
  "totalEssays": 230,
  "averageScore": 10.5,
  "scoreDistribution": {
    "first": 8,     // 13-15分人数
    "second": 18,   // 10-12分人数
    "third": 12,    // 7-9分人数
    "fourth": 5,    // 4-6分人数
    "fifth": 2      // 0-3分人数
  },
  "trend": [
    { "date": "2026-06-01", "avgScore": 9.8 },
    { "date": "2026-06-08", "avgScore": 10.2 },
    { "date": "2026-06-15", "avgScore": 10.5 }
  ],
  "topErrors": [
    { "type": "tense", "count": 45, "percentage": 0.32 },
    { "type": "subject_verb", "count": 38, "percentage": 0.27 }
  ]
}
```

### 8.2 学生个人报告

```
GET /analytics/student/:studentId
```

**响应:**
```json
{
  "studentId": "uuid",
  "studentName": "李同学",
  "totalEssays": 12,
  "averageScore": 11.5,
  "scoreTrend": [10, 10.5, 11, 12, 11.5, 13],
  "radarData": {
    "content": 4.0,
    "language": 4.5,
    "structure": 2.5,
    "presentation": 1.5
  },
  "weakPoints": [
    { "type": "tense", "frequency": "high", "trend": "improving" }
  ],
  "strongPoints": [
    { "type": "vocabulary", "level": "intermediate" }
  ],
  "level": "improving",  // basic/improving/advanced
  "rank": { "class": 5, "total": 45 }
}
```

### 8.3 学校数据概览

```
GET /analytics/school/:schoolId
```

**权限**: super_admin, school_admin

### 8.4 系统全局数据

```
GET /analytics/system
```

**权限**: super_admin

---

## 9. AI 助手

### 9.1 AI润色

```
POST /ai/polish
```

**请求体:**
```json
{
  "text": "I think this is a good idea because it can help us learn better.",
  "mode": "polish"  // polish | upgrade | expand
}
```

**响应:**
```json
{
  "original": "I think this is a good idea because it can help us learn better.",
  "result": "I believe this is an excellent approach, as it can significantly enhance our learning efficiency.",
  "changes": [
    {
      "type": "vocabulary",
      "original": "good",
      "replaced": "excellent"
    },
    {
      "type": "sentence_structure",
      "original": "can help us learn better",
      "replaced": "can significantly enhance our learning efficiency"
    }
  ]
}
```

### 9.2 句型升级

```
POST /ai/upgrade-sentence
```

**请求体:**
```json
{
  "sentence": "We should protect the environment.",
  "targetLevel": "advanced"
}
```

### 9.3 同义词推荐

```
POST /ai/synonyms
```

**请求体:**
```json
{
  "word": "important",
  "context": "It is important to protect the environment."
}
```

### 9.4 语法检查

```
POST /ai/grammar-check
```

**请求体:**
```json
{
  "text": "He go to school every day."
}
```

---

## 10. 错题本

### 10.1 获取错题列表

```
GET /error-book?type=tense&page=1&pageSize=20
```

### 10.2 获取错题统计

```
GET /error-book/stats
```

**响应:**
```json
{
  "totalErrors": 45,
  "resolvedErrors": 20,
  "byType": {
    "tense": { "count": 12, "resolved": 5 },
    "subject_verb": { "count": 8, "resolved": 3 },
    "spelling": { "count": 6, "resolved": 4 }
  },
  "trend": "decreasing"  // increasing/stable/decreasing
}
```

### 10.3 标记错题已解决

```
PUT /error-book/:id/resolve
```

### 10.4 AI生成针对性练习

```
POST /error-book/generate-practice
```

**请求体:**
```json
{
  "errorTypes": ["tense", "subject_verb"],
  "count": 5
}
```

---

## 11. 系统管理

### 11.1 API配置管理

```
GET /admin/api-configs
POST /admin/api-configs
PUT /admin/api-configs/:id
DELETE /admin/api-configs/:id
```

**权限**: super_admin

### 11.2 API调用日志

```
GET /admin/api-logs?provider=openai&dateFrom=2026-07-01&dateTo=2026-07-02
```

**权限**: super_admin

### 11.3 系统公告

```
GET /announcements?targetRole=teacher
POST /admin/announcements
PUT /admin/announcements/:id
DELETE /admin/announcements/:id
```

### 11.4 评分标准配置

```
GET /admin/scoring-config
PUT /admin/scoring-config
```

**权限**: super_admin

**请求体:**
```json
{
  "weights": {
    "content": 0.30,
    "language": 0.40,
    "structure": 0.20,
    "presentation": 0.10
  },
  "deductionRules": {
    "grammarError": 0.5,
    "missingKeyPoint": 1.0,
    "formatError": 1.0,
    "wordCountBelow": { "threshold": 70, "action": "downgrade_tier" }
  },
  "tiers": [
    { "tier": "1st", "min": 13, "max": 15 },
    { "tier": "2nd", "min": 10, "max": 12.5 },
    { "tier": "3rd", "min": 7, "max": 9.5 },
    { "tier": "4th", "min": 4, "max": 6.5 },
    { "tier": "5th", "min": 0, "max": 3.5 }
  ]
}
```

### 11.5 题库管理

```
GET /question-bank?category=school_life&type=letter&page=1&pageSize=20
POST /question-bank
PUT /question-bank/:id
DELETE /question-bank/:id
```

---

## 附录：WebSocket 事件

### 批改进度推送

```
连接: wss://api.betterwrite.cn/ws?token=<jwt>

事件: essay:status
数据: {
  "essayId": "uuid",
  "status": "correcting",
  "progress": "正在分析语言维度...",
  "estimatedTimeLeft": 5
}

事件: essay:completed
数据: {
  "essayId": "uuid",
  "totalScore": 13.5,
  "scoreTier": "1st"
}
```