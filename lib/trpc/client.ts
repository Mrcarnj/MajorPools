import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/api/root';
import superjson from 'superjson';

// In tRPC v11, transformer is not passed directly to createTRPCReact
export const trpc = createTRPCReact<AppRouter>();