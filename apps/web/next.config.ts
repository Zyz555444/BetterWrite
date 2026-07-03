import type { NextConfig } from 'next';

const securityHeaders = [
  // 强制 HTTPS（1年，含子域名）
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // 禁止被嵌入 iframe，防止点击劫持
  { key: 'X-Frame-Options', value: 'DENY' },
  // 阻止 MIME 嗅探
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // 仅同源引用
  { key: 'Referrer-Policy', value: 'same-origin' },
  // 禁用不需要的浏览器特性
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // 内容安全策略：默认同源；允许内联样式（Tailwind 需要）与必要的外部资源
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    '@betterwrite/shared',
    '@betterwrite/db',
    '@betterwrite/ai',
    '@betterwrite/design-system',
    '@betterwrite/worker',
  ],
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
