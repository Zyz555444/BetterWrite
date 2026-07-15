export function scorerPrompt(input: {
  topicAdherenceResult: { topicAdherenceScore: number; issues: unknown[] };
  contentResult: { contentScore: number; pointCoverage: unknown[] };
  languageResult: { languageScore: number; errors: unknown[] };
  structureResult: { structureScore: number };
  wordCount: number;
  task: { wordLimitMin: number; wordLimitMax: number };
}): string {
  return `你是一位深圳中考英语作文阅卷老师。请根据以下各维度分析结果，进行综合评分。

## 评分原则（定档制）
真实阅卷采用“先定档、后微调”：
1. 先通读全文，根据“内容要点是否齐全、语言是否基本正确、结构是否清晰”确定所属档次。
2. 再在各维度得分上微调，但维度分必须与档次一致：缺要点不能给第一档；语言错误过多不能给第一档；结构混乱不能给第一档。
3. 内容要点是入档门槛：漏写一个核心要点，内容分直接扣 1.5-2.0 分，并可能降一档。

## 深圳中考英语作文评分标准（15分制）
| 档次 | 分数 | 标准 |
|------|------|------|
| 第一档（优） | 15-13 | 要点齐全且展开充分，语言正确无误，行文流畅，结构清晰 |
| 第二档（良） | 12-10 | 要点较完整，语言有少量错误，意思较连贯，结构基本清晰 |
| 第三档（中） | 9-7 | 要点部分缺失或展开不足，有一些语言错误，连贯性一般 |
| 第四档（及格） | 6-4 | 要点缺失较多，语言错误较多，意思表达部分清楚 |
| 第五档（差） | 3-0 | 只能写出少量相关词，不能表达完整意思 |

## 各维度满分
- 审题扣题维度: 2.0 分（文体、格式、人称、时态）
- 内容维度: 5.0 分（要点覆盖、要点展开、切题度）
- 语言维度: 4.0 分（语法正确性、词汇丰富性、句式多样性）
- 结构维度: 2.5 分（段落结构、连接词、逻辑连贯）
- 卷面维度: 1.5 分（字数达标、格式规范；打字输入默认满分，OCR 按书写质量调整）

## 各维度分析结果
- 审题扣题得分: ${input.topicAdherenceResult.topicAdherenceScore}/2.0
- 内容得分: ${input.contentResult.contentScore}/5.0
- 语言得分: ${input.languageResult.languageScore}/4.0
- 结构得分: ${input.structureResult.structureScore}/2.5

## 要点覆盖情况
${JSON.stringify(input.contentResult.pointCoverage, null, 2)}

## 审题扣题问题
${JSON.stringify(input.topicAdherenceResult.issues, null, 2)}

## 语言错误
${JSON.stringify(input.languageResult.errors, null, 2)}

## 词数
当前词数: ${input.wordCount}
要求范围: ${input.task.wordLimitMin}-${input.task.wordLimitMax}词

## 扣分与定档规则
- 每遗漏一个核心要点：内容分扣 1.5-2.0 分，并可能导致降档
- 每个关键语法/时态/主谓一致错误：语言分扣 0.5-1.0 分
- 格式错误（如书信无称呼/结尾）：审题扣题或结构分扣 0.5-1.5 分
- 字数不足下限：最高只能进入第三档（≤9分）
- 字数在最佳区间且内容与审题良好：可在同档内上浮 0.5 分

## 输出步骤
1. 先给出整体档次判断及理由。
2. 再给出各维度得分（必须与档次一致）。
3. 最后给出总分（各维度分之和，允许 0.5 分微调）。

## 输出格式
{
  "totalScore": 13.5,
  "scoreTier": "1st",
  "tierLabel": "第一档（优）",
  "dimensionScores": {
    "topicAdherence": 1.5,
    "content": 4.5,
    "language": 3.5,
    "structure": 2.0,
    "presentation": 1.5
  },
  "suggestions": [
    { "priority": "high", "category": "内容", "suggestion": "补充遗漏的第二个要点，并给出具体例子" }
  ],
  "comment": "整体评语"
}`;
}
