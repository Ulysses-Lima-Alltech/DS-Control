import { app } from "@modules/app/app.module";
import { ContractV1Routes } from "./contract.routes";

app.log.info("[ContractModule] - Initializing Contract Module");

try {
  app.register(ContractV1Routes, { prefix: '/v1/contracts' });
  app.log.info("[ContractModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[ContractModule] - Failed to initialize module: %s", error);
  throw error;
} 