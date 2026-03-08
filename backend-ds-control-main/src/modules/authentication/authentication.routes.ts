import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction
} from "fastify";
import z from "zod";

import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { AuthenticationController } from "./authentication.controller";
import {
  LoginWithEmailAndPasswordSchema
} from "./dto/login-with-email-and-password.dto";

export function AuthenticationV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new AuthenticationController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/login",
    schema: {
      body: LoginWithEmailAndPasswordSchema,
      description: "Authenticate a user with their email and password credentials",
      summary: "Login with email and password",
      tags: ["authentication"],
      response: {
        200: z.object({
          accessToken: z.string(),
        }),
      },
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: controller.loginWithEmailAndPassword,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/refresh-token",
    schema: {
      description: "Generate a new access token using a valid refresh token stored in cookies",
      summary: "Refresh access token",
      tags: ["authentication"],
      response: {
        200: z.object({
          accessToken: z.string(),
        }),
      },
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: controller.refreshToken,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST", 
    url: "/logout",
    schema: {
      description: "End the user's session by invalidating their refresh token and clearing authentication cookies",
      summary: "Logout user",
      tags: ["authentication"],
      response: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: controller.logout,
  });

  done();
}
