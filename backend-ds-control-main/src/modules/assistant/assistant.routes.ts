import type {
    FastifyInstance,
    FastifyPluginOptions,
    HookHandlerDoneFunction,
} from "fastify";

import { PaginatedRequestQueryStringSchema, PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { AssistantViewModelSchema } from "@models/assistant.vm";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { AssistantController } from "./assistant.controller";
import { CreateAssistantSchema } from "./dto/create-assistant.dto";
import { UpdateAssistantSchema } from "./dto/update-assistant.dto";

// Extended query string schema for assistant search and filters
const AssistantSearchQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter assistants by name"),
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Filter by assistant status (active = not deleted, inactive = deleted)"),
});

export function AssistantV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new AssistantController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List all assistants with optional search and status filter",
      summary: "List assistants",
      tags: ["assistants"],
      querystring: AssistantSearchQueryStringSchema,
      response: { 
        200: PaginatedRequestSchema(AssistantViewModelSchema),
      }
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listAssistants,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: CreateAssistantSchema,
      description: "Create a new assistant",
      summary: "Create assistant",
      tags: ["assistants"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createAssistant,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get assistant by ID",
      summary: "Get assistant by ID",
      tags: ["assistants"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getAssistantById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update an assistant by ID",
      summary: "Update assistant by ID",
      tags: ["assistants"],
      body: UpdateAssistantSchema,
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateAssistant,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete an assistant by ID (soft delete)",
      summary: "Delete assistant by ID",
      tags: ["assistants"],
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteAssistant,
  });

  done();
} 