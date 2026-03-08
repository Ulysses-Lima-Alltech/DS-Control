import { app } from "@modules/app/app.module";
import { ServiceOrderV1Routes } from "./service-order.routes";

app.log.info("[ServiceOrderModule] - Initializing Service Order Module");

try {
  app.register(ServiceOrderV1Routes, { prefix: '/v1/service-orders' });
  app.log.info("[ServiceOrderModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[ServiceOrderModule] - Failed to initialize module: %s", error);
  throw error;
} 