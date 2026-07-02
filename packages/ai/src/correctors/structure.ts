import type { EssayTaskInput } from './corrector.js';

export function structurePrompt(essay: string, task: EssayTaskInput): string {
  return `你是一位深圳中考英语作文阅卷老师。请严格按照深圳中考英语作文评分标准，分析以下作文的结构维度。

## 题目类型
${task.topicType}

## 字数要求
${task.wordLimitMin}-${task.wordLimitMax}词

## 学生作文
${essay}

## 分析要求
1. 段落结构: 是否具备清晰的三段式结构
2. 逻辑连贯: 连接词使用是否恰当
3. 格式规范: 书信/演讲稿等格式是否正确
4. 字数控制: 是否达标（80词底线，100-125词为佳）

## 输出格式
{
  "paragraphStructure": {
    "hasOpening": true,
    "hasBody": true,
    "hasClosing": true,
    "openingQuality": "good",
    "bodyParagraphs": 2,
    "closingQuality": "good"
  },
  "connectiveUsage": {
    "usedConnectives": ["First of all", "Besides"],
    "missingTypes": ["总结词"],
    "score": 3.0
  },
  "formatCheck": {
    "type": "letter",
    "hasGreeting": true,
    "hasClosing": true,
    "hasSignature": true,
    "isCorrect": true
  },
  "wordCount": 102,
  "wordCountScore": 3.0,
  "structureScore": 2.5,
  "comment": "结构维度的评语"
}`;
}
