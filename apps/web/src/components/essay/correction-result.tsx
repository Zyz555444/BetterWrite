'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CorrectionDetail } from '@/lib/api/fetcher';
import { formatScore, getErrorTypeLabel } from '@betterwrite/shared';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

interface CorrectionResultProps {
  correction: CorrectionDetail;
  originalEssay: string;
}

const _dimensionLabels: Record<string, string> = {
  content: '内容',
  language: '语言',
  structure: '结构',
  presentation: '卷面',
};

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export function CorrectionResultView({ correction, originalEssay }: CorrectionResultProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'revised'>('overview');

  const radarData = [
    { subject: '内容', A: (correction.contentScore / 4.5) * 100, fullMark: 100 },
    { subject: '语言', A: (correction.languageScore / 6) * 100, fullMark: 100 },
    { subject: '结构', A: (correction.structureScore / 3) * 100, fullMark: 100 },
    { subject: '卷面', A: (correction.presentationScore / 1.5) * 100, fullMark: 100 },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-accent/10 ring-1 ring-accent/20">
          <CardContent className="p-6 text-center">
            <p className="text-copy-14 text-neutral-8 mb-1">总分</p>
            <p className="text-display-48 font-medium text-accent">
              {formatScore(correction.totalScore)}
            </p>
            <p className="text-copy-14 text-neutral-8 mt-1">/ 15 分</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-copy-14 text-neutral-8 mb-1">评级</p>
            <p className="text-title-24 font-medium text-neutral-10">{correction.scoreTier}</p>
            <p className="text-copy-14 text-neutral-8 mt-1">深圳中考评分标准</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <Card>
          <CardHeader>
            <CardTitle className="text-title-20">维度得分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { key: 'content', label: '内容', score: correction.contentScore, max: 4.5 },
                { key: 'language', label: '语言', score: correction.languageScore, max: 6 },
                { key: 'structure', label: '结构', score: correction.structureScore, max: 3 },
                {
                  key: 'presentation',
                  label: '卷面',
                  score: correction.presentationScore,
                  max: 1.5,
                },
              ].map((dim) => (
                <div key={dim.key}>
                  <div className="flex justify-between text-copy-14 mb-1">
                    <span className="text-neutral-8">{dim.label}</span>
                    <span className="font-medium text-neutral-10">
                      {formatScore(dim.score)} / {dim.max}
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${Math.min(100, (dim.score / dim.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title-20">能力雷达</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--color-neutral-8)', fontSize: 12 }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="得分"
                    dataKey="A"
                    stroke="var(--color-accent)"
                    fill="var(--color-accent)"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {correction.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-title-20 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent" />
              改进建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {correction.suggestions.map((item) => (
                <li key={`${item.category}:${item.suggestion}`} className="flex items-start gap-3">
                  <Badge
                    variant={
                      item.priority === 'high'
                        ? 'destructive'
                        : item.priority === 'medium'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {priorityLabels[item.priority]}
                  </Badge>
                  <div>
                    <p className="text-copy-14 font-medium text-neutral-10">{item.category}</p>
                    <p className="text-copy-14 text-neutral-8">{item.suggestion}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderErrors = () => (
    <div className="space-y-4">
      {correction.errors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="text-neutral-10 font-medium">未发现明显语言错误</p>
            <p className="text-neutral-8 text-copy-14 mt-1">继续保持！</p>
          </CardContent>
        </Card>
      ) : (
        correction.errors.map((error) => (
          <Card key={`${error.original}:${error.corrected}`} className="border-l-4 border-l-error">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-error mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">{getErrorTypeLabel(error.type)}</Badge>
                  </div>
                  <p className="text-neutral-10">
                    <span className="line-through text-error/70">{error.original}</span>
                    <span className="mx-2 text-neutral-7">→</span>
                    <span className="text-success font-medium">{error.corrected}</span>
                  </p>
                  <p className="text-copy-14 text-neutral-8 mt-2">{error.explanation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {correction.highlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-title-20 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              亮点表达
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {correction.highlights.map((highlight) => (
                <li key={highlight.sentence} className="p-3 bg-neutral-2 rounded-md">
                  <p className="text-neutral-10 font-medium">&ldquo;{highlight.sentence}&rdquo;</p>
                  <p className="text-copy-14 text-neutral-8 mt-1">
                    {highlight.type}: {highlight.comment}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderRevised = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-title-20">AI 修改版</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-neutral-2 rounded-md text-neutral-10 leading-relaxed whitespace-pre-wrap">
            {correction.revisedEssay}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-title-20">原文</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-neutral-2 rounded-md text-neutral-10 leading-relaxed whitespace-pre-wrap">
            {originalEssay}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('overview')}
        >
          总评
        </Button>
        <Button
          variant={activeTab === 'errors' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('errors')}
        >
          错误与亮点
        </Button>
        <Button
          variant={activeTab === 'revised' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('revised')}
        >
          修改对比
        </Button>
      </div>
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'errors' && renderErrors()}
      {activeTab === 'revised' && renderRevised()}
    </div>
  );
}
