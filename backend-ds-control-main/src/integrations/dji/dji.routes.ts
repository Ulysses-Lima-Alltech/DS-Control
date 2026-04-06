import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { AuthenticationJWT } from "@middleware/authentication-jwt-middleware";
import type {
  FastifyInstance,
  FastifyPluginOptions,
  HookHandlerDoneFunction,
} from "fastify";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import z from "zod";

import { DjiIntegrationService } from "./service";

const DjiHealthResponseSchema = z.object({
  enabled: z.boolean(),
  appIdConfigured: z.boolean(),
  appKeyConfigured: z.boolean(),
  appLicenseConfigured: z.boolean(),
  mqttBrokerConfigured: z.boolean(),
  mqttUsernameConfigured: z.boolean(),
  mqttPasswordConfigured: z.boolean(),
  webhookSecretConfigured: z.boolean(),
  mqttClientIdConfigured: z.boolean(),
  mqttTopicsConfigured: z.boolean(),
  httpBaseUrlConfigured: z.boolean(),
  logLevelConfigured: z.boolean(),
});

const DjiTestResponseSchema = z.object({
  success: z.literal(true),
  id: z.string().uuid(),
});

const DjiMqttStatusSchema = z.object({
  state: z.enum(["disconnected", "connecting", "connected", "error"]),
  lastConnectedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  brokerUrlMasked: z.string().nullable(),
  topicsConfigured: z.array(z.string()),
});

const DjiHttpPreviewSchema = z.object({
  baseUrl: z.string().nullable(),
  baseUrlMasked: z.string().nullable(),
  logLevel: z.string().nullable(),
});

const DjiConnectionStatusResponseSchema = z.object({
  config: DjiHealthResponseSchema,
  mqtt: DjiMqttStatusSchema,
  http: DjiHttpPreviewSchema,
});

const DjiConnectSmokeResponseSchema = z.object({
  success: z.boolean(),
  attemptEventId: z.string().uuid(),
  resultEventId: z.string().uuid(),
  mqtt: DjiMqttStatusSchema,
  reason: z.string().optional(),
});

const DjiDisconnectSmokeResponseSchema = z.object({
  success: z.literal(true),
  eventId: z.string().uuid(),
  mqtt: DjiMqttStatusSchema,
});

export function DjiIntegrationRoutes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  const service = new DjiIntegrationService();

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/health",
    schema: {
      description: "DJI integration foundation — status de configuração por variáveis de ambiente",
      summary: "DJI integration health",
      tags: ["integrations-dji"],
      response: {
        200: DjiHealthResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const body = service.getHealth();
      return reply.status(HTTP_STATUS_CODES.OK).send(body);
    },
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/test",
    schema: {
      description:
        "DJI integration foundation — grava um evento de teste em integration_events (sem chamada DJI real)",
      summary: "DJI integration test event",
      tags: ["integrations-dji"],
      response: {
        200: DjiTestResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const result = await service.createTestEvent();
      return reply.status(HTTP_STATUS_CODES.OK).send(result);
    },
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/connection-status",
    schema: {
      description:
        "Smoke test — configuração + estado MQTT em memória + preview HTTP (sem consumo de dados reais)",
      summary: "DJI connection status",
      tags: ["integrations-dji"],
      response: {
        200: DjiConnectionStatusResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const body = service.getConnectionHealth();
      return reply.status(HTTP_STATUS_CODES.OK).send(body);
    },
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/connect",
    schema: {
      description:
        "Smoke test — tenta conexão MQTT manual, registra integration_events (source=smoke_test); não inicia automaticamente no boot",
      summary: "DJI MQTT smoke connect",
      tags: ["integrations-dji"],
      response: {
        200: DjiConnectSmokeResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const result = await service.connectSmokeTest();
      return reply.status(HTTP_STATUS_CODES.OK).send(result);
    },
  });

  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "POST",
    url: "/disconnect",
    schema: {
      description: "Smoke test — encerra MQTT singleton e grava evento de disconnect em integration_events",
      summary: "DJI MQTT smoke disconnect",
      tags: ["integrations-dji"],
      response: {
        200: DjiDisconnectSmokeResponseSchema,
      },
    },
    preHandler: [AuthenticationJWT],
    handler: async (_, reply) => {
      const result = await service.disconnectSmokeTest();
      return reply.status(HTTP_STATUS_CODES.OK).send(result);
    },
  });

  done();
}
