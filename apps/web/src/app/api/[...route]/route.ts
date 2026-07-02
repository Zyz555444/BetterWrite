import app from '@/lib/api/routes';

const handler = app.fetch;

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
