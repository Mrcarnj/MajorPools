import { router } from '@/lib/trpc/server';
import { golfersRouter } from './routers/golfers';
import { entriesRouter } from './routers/entries';

export const appRouter = router({
  golfers: golfersRouter,
  entries: entriesRouter,
});

export type AppRouter = typeof appRouter;