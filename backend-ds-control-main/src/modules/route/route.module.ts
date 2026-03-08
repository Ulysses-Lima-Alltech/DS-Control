import { app } from "@modules/app/app.module";
import { RouteV1Routes } from "./route.routes";

app.log.info("[RouteModule] - Initializing Route Module");

try {
  app.register(RouteV1Routes, { prefix: '/v1/routes' });
  app.log.info("[RouteModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[RouteModule] - Failed to initialize module: %s", error);
  throw error;
}
