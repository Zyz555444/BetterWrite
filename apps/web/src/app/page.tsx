import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-serif text-text-primary">BetterWrite</CardTitle>
          <p className="text-text-secondary mt-2">深圳中考英语作文 AI 辅导系统</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-text-tertiary text-center text-sm">
            基于深圳中考评分标准，为学生、教师和学校提供专业写作辅导。
          </p>
          <div className="flex justify-center gap-3">
            <Button>开始使用</Button>
            <Button variant="secondary">了解更多</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
