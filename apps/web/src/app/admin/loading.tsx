import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-neutral-20" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-20" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 animate-pulse rounded bg-neutral-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-neutral-20" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="h-10 w-full animate-pulse rounded bg-neutral-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
