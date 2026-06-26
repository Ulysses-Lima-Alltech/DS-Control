import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";

import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { MobileOfflineController } from "./mobile-offline.controller";

export function MobileOfflineV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new MobileOfflineController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/bootstrap",
    schema: {
      description: "Bootstrap authenticated mobile data for offline usage",
      summary: "Mobile offline bootstrap",
      tags: ["mobile-offline"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.bootstrap,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/sync",
    schema: {
      description: "Incremental mobile offline sync metadata placeholder",
      summary: "Mobile offline incremental sync",
      tags: ["mobile-offline"],
      querystring: z.object({
        since: z.string().optional(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.sync,
  });

  done();
}
