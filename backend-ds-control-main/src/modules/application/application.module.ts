import { app } from "@modules/app/app.module";
import { ApplicationV1Routes } from "./application.routes";

app.log.info("[ApplicationModule] - Initializing Application Module");

try {
  app.register(ApplicationV1Routes, { prefix: '/v1/applications' });
  app.log.info("[ApplicationModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[ApplicationModule] - Failed to initialize module: %s", error);
  throw error;
} 