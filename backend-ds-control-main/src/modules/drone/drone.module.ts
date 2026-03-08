import { app } from "@modules/app/app.module";
import { DroneV1Routes } from "./drone.routes";

app.log.info("[DroneModule] - Initializing Drone Module");

try {
  app.register(DroneV1Routes, { prefix: '/v1/drones' });
  app.log.info("[DroneModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[DroneModule] - Failed to initialize module: %s", error);
  throw error;
} 