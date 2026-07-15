type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function emit(level: LogLevel, message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === 'production') {
    // 生产环境可在此处接入 Sentry 等监控服务
    return;
  }
  const prefix = `[BetterWrite][${level.toUpperCase()}] ${message}`;
  switch (level) {
    case 'info':
      console.info(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'error':
      console.error(prefix, ...args);
      break;
    case 'debug':
      console.debug(prefix, ...args);
      break;
  }
}

export const clientLogger = {
  info: (message: string, ...args: unknown[]) => emit('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => emit('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => emit('error', message, ...args),
  debug: (message: string, ...args: unknown[]) => emit('debug', message, ...args),
};
