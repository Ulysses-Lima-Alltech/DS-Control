import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { BackofficeOnly } from "@middleware/backoffice-only-middleware";
import { UserViewModelSchema } from "@models/user.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { ChangePasswordSchema } from "./dto/change-password.dto";
import { CreateUserSchema } from "./dto/create-user.dto";
import { GetUserQueryStringSchema } from "./dto/get-all-user.dto";
import { RequestPasswordResetSchema } from "./dto/request-password-reset.dto";
import { ResetPasswordSchema } from "./dto/reset-password.dto";
import { UpdateMeSchema } from "./dto/update-me.dto";
import { UpdateUserSchema } from "./dto/update-user.dto";
import { UserController } from "./user.controller";

export function UserV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new UserController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/:id/generate-temporary-password",
    schema: {
      description: "Set a temporary password and require its change on next login (Admin only)",
      summary: "Generate temporary password",
      tags: ["users"],
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [AuthenticationJWT, BackofficeOnly],
    handler: controller.generateTemporaryPassword,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all users with optional search and filters",
      summary: "List users",
      tags: ["users"],
      querystring: GetUserQueryStringSchema,
      response: {
        200: PaginatedRequestSchema(UserViewModelSchema),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listUsers,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get user by ID",
      summary: "Get user by ID",
      tags: ["users"],
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: UserViewModelSchema
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getUserById,
  })

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/register",
    schema: {
      body: CreateUserSchema,
      description: "Create a new user account with email and password",
      summary: "Register new user",
      tags: ["users"],
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createUser,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/reset-password",
    schema: {
      description: "Reset user's password using the reset token and new password",
      summary: "Reset password",
      tags: ["users"],
      body: ResetPasswordSchema,
    },
    handler: controller.resetPassword,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/request-password-reset",
    schema: {
      description: "Request a password reset link to be sent to user's email",
      summary: "Request password reset",
      tags: ["users"],
      body: RequestPasswordResetSchema,
    },
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: controller.requestPasswordReset,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/me",
    schema: {
      description: "Retrieve the authenticated user's profile information",
      summary: "Get current user profile",
      tags: ["users"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getMe,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/me",
    schema: {
      description: "Update the authenticated user's profile information",
      summary: "Update current user profile",
      tags: ["users"],
      body: UpdateMeSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateMe,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/me/password",
    schema: {
      description: "Change the authenticated user's password",
      summary: "Change current user password",
      tags: ["users"],
      body: ChangePasswordSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.changePassword,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update a user by ID (Admin only)",
      summary: "Update user by ID",
      tags: ["users"],
      body: UpdateUserSchema,
      params: z.object({
        id: z.string(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateUser,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete a user by ID (Admin only) - Soft delete",
      summary: "Delete user by ID",
      tags: ["users"],
      params: z.object({
        id: z.string(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteUser,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/:id/activate",
    schema: {
      description: "Activate a user by ID (Admin only)",
      summary: "Activate user by ID",
      tags: ["users"],
      params: z.object({
        id: z.string(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.activateUser,
  });

  done();
}
