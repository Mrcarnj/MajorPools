import { router } from '@/lib/trpc/server';

export const appRouter = router({});

export type AppRouter = typeof appRouter;