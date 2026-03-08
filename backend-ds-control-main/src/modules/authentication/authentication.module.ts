import { app } from "@modules/app/app.module";
import { AuthenticationV1Routes } from "./authentication.routes";

app.log.info("[AuthenticationModule] - Initializing Authentication Module");

try {
  app.register(AuthenticationV1Routes, { prefix: "/v1/auth" });
  app.log.info("[AuthenticationModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[AuthenticationModule] - Failed to initialize module: %s", error);
  throw error;
}
