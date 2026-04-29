import { app } from "@modules/app/app.module";
import { CropSeasonV1Routes } from "./crop-season.routes";

app.log.info("[CropSeasonModule] - Initializing Crop Season Module");

try {
  app.register(CropSeasonV1Routes, { prefix: "/v1/crop-seasons" });
  app.log.info("[CropSeasonModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[CropSeasonModule] - Failed to initialize module: %s", error);
  throw error;
}

