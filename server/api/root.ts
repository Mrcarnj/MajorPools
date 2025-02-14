import { router } from '@/lib/trpc/server';
import { golfersRouter } from './routers/golfers';
import { entriesRouter } from './routers/entries';
import { pgaRouter } from './routers/pga';

export const appRouter = router({
  golfers: golfersRouter,
  entries: entriesRouter,
  pga: pgaRouter,
});

export type AppRouter = typeof appRouter;