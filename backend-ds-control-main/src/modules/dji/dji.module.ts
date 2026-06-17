import { app } from "@modules/app/app.module";
import { DjiV1Routes } from "./dji.routes";

app.log.info("[DjiModule] - Initializing DJI Module");

try {
  app.register(DjiV1Routes, { prefix: "/v1/dji" });
  app.log.info("[DjiModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[DjiModule] - Failed to initialize module: %s", error);
  throw error;
}
