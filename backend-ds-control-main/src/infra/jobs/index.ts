import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from "fastify";
import { CleanUpTokensTask } from "./tasks/clean-up-tokens.task";

export function ScheduleCronJobs(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  app.scheduler.addSimpleIntervalJob(CleanUpTokensTask);

  done();
}
