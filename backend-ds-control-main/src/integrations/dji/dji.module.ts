import { app } from "@modules/app/app.module";

import { DjiIntegrationRoutes } from "./dji.routes";

app.log.info("[DjiIntegrationModule] - Initializing DJI integration foundation");

try {
  app.register(DjiIntegrationRoutes, { prefix: "/v1/integrations/dji" });
  app.log.info("[DjiIntegrationModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[DjiIntegrationModule] - Failed to initialize module: %s", error);
  throw error;
}
