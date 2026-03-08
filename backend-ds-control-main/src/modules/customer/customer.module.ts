import { app } from "@modules/app/app.module";
import { CustomerV1Routes } from "./customer.routes";

app.log.info("[CustomerModule] - Initializing Customer Module");

try {
  app.register(CustomerV1Routes, { prefix: '/v1/customers' });
  app.log.info("[CustomerModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[CustomerModule] - Failed to initialize module: %s", error);
  throw error;
}
