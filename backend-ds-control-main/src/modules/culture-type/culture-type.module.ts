import { app } from "@modules/app/app.module";
import { CultureTypeV1Routes } from "./culture-type.routes";

app.log.info("[CultureTypeModule] - Initializing Culture Type Module");

try {
  app.register(CultureTypeV1Routes, { prefix: '/v1/culture-types' });
  app.log.info("[CultureTypeModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[CultureTypeModule] - Failed to initialize module: %s", error);
  throw error;
} 