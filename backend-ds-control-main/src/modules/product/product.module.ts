import { app } from "@modules/app/app.module";
import { ProductV1Routes } from "./product.routes";

app.log.info("[ProductModule] - Initializing Product Module");

try {
  app.register(ProductV1Routes, { prefix: '/v1/products' });
  app.log.info("[ProductModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[ProductModule] - Failed to initialize module: %s", error);
  throw error;
} 