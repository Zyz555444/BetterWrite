import type { EssayTaskInput } from './corrector.js';

export function contentPrompt(essay: string, task: EssayTaskInput): string {
  return `你是一位深圳中考英语作文阅卷老师。请严格按照深圳中考英语作文评分标准，分析以下作文的内容维度。

## 题目要求
${task.title}
${task.requirements}

## 评分要点
${task.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## 学生作文
${essay}

## 分析要求
请从以下维度分析并返回严格的JSON格式结果：
1. 要点覆盖: 检查每个评分要点是否被覆盖
2. 要点展开: 每个要点是否有具体描述、例子或细节支持
3. 切题度: 作文是否紧密围绕主题
4. 内容得分: 按深圳中考15分制中内容维度(30%权重)评分，满分4.5分

## 输出格式
{
  "pointCoverage": [
    { "point": "要点1", "status": "fully", "evidence": "原文中的对应句子" }
  ],
  "expansionScore": 4.0,
  "relevanceScore": 4.5,
  "contentScore": 4.0,
  "comment": "内容维度的评语"
}`;
}
