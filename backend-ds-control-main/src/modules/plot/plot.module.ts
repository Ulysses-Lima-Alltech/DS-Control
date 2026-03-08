import { app } from "@modules/app/app.module";

import { PlotV1Routes } from "./plot.routes";

app.log.info("[PlotModule] - Initializing Plot Module");

try {
  app.register(PlotV1Routes, { prefix: '/v1/plots' });
  app.log.info("[PlotModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[PlotModule] - Failed to initialize module: %s", error);
  throw error;
} 