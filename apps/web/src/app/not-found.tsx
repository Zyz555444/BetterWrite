import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-title-24 font-medium text-neutral-10">404</h1>
      <p className="text-copy-14 text-neutral-8">页面不存在或已被移除</p>
      <Link
        href="/"
        className="rounded-md bg-accent px-4 py-2 text-copy-14 text-white hover:bg-accent/90"
      >
        返回首页
      </Link>
    </div>
  );
}
