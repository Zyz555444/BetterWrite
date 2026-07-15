export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-4 border-t-accent" />
        <p className="text-copy-14 text-neutral-8">加载中...</p>
      </div>
    </div>
  );
}
