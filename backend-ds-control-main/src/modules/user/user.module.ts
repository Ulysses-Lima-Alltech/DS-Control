import { app } from "@modules/app/app.module";
import { UserV1Routes } from "./user.routes";

app.log.info("[UserModule] - Initializing User Module");

try {
  app.register(UserV1Routes, { prefix: '/v1/users' });
  app.log.info("[UserModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[UserModule] - Failed to initialize module: %s", error);
  throw error;
}
