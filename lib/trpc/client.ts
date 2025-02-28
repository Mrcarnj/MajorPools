import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/api/root';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>({
  transformer: superjson,
});