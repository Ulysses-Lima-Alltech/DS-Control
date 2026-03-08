import { app } from "@modules/app/app.module";
import { AssistantV1Routes } from "./assistant.routes";

app.log.info("[AssistantModule] - Initializing Assistant Module");

try {
  app.register(AssistantV1Routes, { prefix: '/v1/assistants' });
  app.log.info("[AssistantModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[AssistantModule] - Failed to initialize module: %s", error);
  throw error;
} 