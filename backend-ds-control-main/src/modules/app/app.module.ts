import type { FastifyCookieOptions } from "@fastify/cookie";
import cookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyRedis from "@fastify/redis";
import fastifySchedule from "@fastify/schedule";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";

import Fastify from "fastify";
import Logger from "pino";

import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransform,
  fastifyZodOpenApiTransformObject,
  serializerCompiler,
  validatorCompiler,
  type FastifyZodOpenApiTypeProvider,
} from "fastify-zod-openapi";

import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { env } from "@config/index";
import { ScheduleCronJobs } from "@infra/jobs";
import Redis from "ioredis";
import { AppRoutes } from "./app.routes";

const logger = Logger({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "yyyy-dd-mm HH:MM:ss.l o",
      ignore: "pid,hostname",
    },
  },
});

const app = Fastify({
  loggerInstance: logger,
  bodyLimit: 20 * 1024 * 1024,
  requestTimeout: 10 * 1000 * 60,
  keepAliveTimeout: 10 * 1000 * 60,
}).withTypeProvider<FastifyZodOpenApiTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifyZodOpenApiPlugin);
app.register(fastifyRedis, {
  url: env.REDIS_URL,
});

app.register(fastifyRateLimit, {
  max: 1000,
  timeWindow: "1 minute",
  redis: new Redis(env.REDIS_URL),
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({
    statusCode: HTTP_STATUS_CODES.TOO_MANY_REQUESTS,
    error: "Too Many Requests",
    message: "Rate limit exceeded. Please try again later.",
  }),
});

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "DS Drones",
      description: "DS Drones API",
      version: "0.0.1",
    },
    servers: [],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Bearer token for authentication",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  transform: fastifyZodOpenApiTransform,
  transformObject: fastifyZodOpenApiTransformObject,
});

app.register(fastifySwaggerUI, {
  routePrefix: "/documentation",
});

app.register(fastifyCors, {
  origin: (_, callback) => {
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

app.register(cookie, {
  secret: env.COOKIES_SECRET,
  parseOptions: {},
} as FastifyCookieOptions);

app.register(fastifySchedule);
app.register(ScheduleCronJobs);
app.register(AppRoutes);

app.listen(
  { port: env.HTTP_PORT || 3000, host: "0.0.0.0" },
  (error: Error | null, address: string) => {
    if (error) {
      app.log.error(error);
      process.exit(1);
    }

    app.log.info(`Server listening at ${address}`);
  },
);

export { app };
