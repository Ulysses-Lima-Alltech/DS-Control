import { app } from "@modules/app/app.module";
import { FarmV1Routes } from "./farm.routes";

app.log.info("[FarmModule] - Initializing Farm Module");

try {
  app.register(FarmV1Routes, { prefix: '/v1/farms' });
  app.log.info("[FarmModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[FarmModule] - Failed to initialize module: %s", error);
  throw error;
} 