import { db } from '@infra/database';
import { userTokens } from '@infra/database/schema';
import { app } from '@modules/app/app.module';
import { lt } from 'drizzle-orm';
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler';

async function deleteTokens() {
  
  const tokens = await db
  .delete(userTokens)
  .where(
    lt(userTokens.expiresAt, new Date()),
  );

  return tokens;
}

const task = new AsyncTask(
  'clean-up-user-tokens-task',
  async () => {
    const tokens = await deleteTokens();
    app.log.info('[CLEAN UP TOKENS] Deleted tokens %s', JSON.stringify(tokens, null, 2));
  },
  (error) => {
    app.log.error('[CLEAN UP TOKENS] Error cleaning up user tokens %s', error);
  }
);

export const CleanUpTokensTask = new SimpleIntervalJob(
  {
    hours: 1,
    runImmediately: false,
  },
  task
);
