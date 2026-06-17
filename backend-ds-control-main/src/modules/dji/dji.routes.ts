import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import { z } from "zod";
import { DjiController } from "./dji.controller";
import { DjiFlightsQuerySchema, DjiRecordNumberParamsSchema, ImportDjiFlightsFromS3Schema } from "./dto/dji.dto";

export function DjiV1Routes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const controller = new DjiController();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/flights/import-from-s3",
    schema: {
      body: ImportDjiFlightsFromS3Schema,
      description: "Import DJI flights from S3 flight-index.json",
      summary: "Import DJI flights from S3",
      tags: ["dji"],
      response: {
        200: z.object({
          date: z.string(),
          totalFlights: z.number(),
          created: z.number(),
          updated: z.number(),
          errors: z.array(z.object({
            recordNumber: z.string().nullable(),
            metadataS3Key: z.string().nullable(),
            message: z.string(),
          })),
        }),
      },
    },
    preHandler: [AuthenticationJWT],
    handler: controller.importFlightsFromS3,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/flights",
    schema: {
      querystring: DjiFlightsQuerySchema,
      description: "List DJI flights by date",
      summary: "List DJI flights",
      tags: ["dji"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.listFlights,
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/flights/:recordNumber",
    schema: {
      params: DjiRecordNumberParamsSchema,
      description: "Get DJI flight by recordNumber",
      summary: "Get DJI flight",
      tags: ["dji"],
    },
    preHandler: [AuthenticationJWT],
    handler: controller.getFlightByRecordNumber,
  });

  done();
}
