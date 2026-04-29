import { PaginatedRequestSchema } from "@common/types/paginated-request.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import { CropSeasonViewModelSchema } from "@models/crop-season.vm";
import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { CropSeasonController } from "./crop-season.controller";
import { CreateCropSeasonSchema } from "./dto/create-crop-season.dto";
import { GetCropSeasonQueryStringSchema } from "./dto/get-all-crop-season.dto";
import { UpdateCropSeasonSchema } from "./dto/update-crop-season.dto";

const CropSeasonParamSchema = z.object({
  id: z.string().uuid(),
});

export function CropSeasonV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new CropSeasonController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "List crop seasons with optional search and status filter",
      summary: "List crop seasons",
      tags: ["crop-seasons"],
      querystring: GetCropSeasonQueryStringSchema,
      response: {
        200: PaginatedRequestSchema(CropSeasonViewModelSchema),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listCropSeasons,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/current",
    schema: {
      description: "Get the current crop season for today's civil date",
      summary: "Get current crop season",
      tags: ["crop-seasons"],
      response: {
        200: z.object({
          message: z.string(),
          cropSeason: CropSeasonViewModelSchema.nullable(),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getCurrentCropSeason,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      description: "Get crop season by ID",
      summary: "Get crop season by ID",
      tags: ["crop-seasons"],
      params: CropSeasonParamSchema,
      response: {
        200: z.object({
          message: z.string(),
          cropSeason: CropSeasonViewModelSchema,
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getCropSeasonById,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      description: "Create a new crop season",
      summary: "Create crop season",
      tags: ["crop-seasons"],
      body: CreateCropSeasonSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.createCropSeason,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    schema: {
      description: "Update an existing crop season",
      summary: "Update crop season",
      tags: ["crop-seasons"],
      params: CropSeasonParamSchema,
      body: UpdateCropSeasonSchema,
      response: {
        200: z.object({
          message: z.string(),
          cropSeason: CropSeasonViewModelSchema,
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.updateCropSeason,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    schema: {
      description: "Delete (inactivate) crop season by ID",
      summary: "Delete crop season",
      tags: ["crop-seasons"],
      params: CropSeasonParamSchema,
    },
    preHandler: [AuthenticationJWT],
    handler: controller.deleteCropSeason,
  });

  done();
}

