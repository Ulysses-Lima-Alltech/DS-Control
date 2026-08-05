import { app } from "@modules/app/app.module";
import { MobileOfflineV1Routes } from "./mobile-offline.routes";
import { MobileMeV1Routes } from "./mobile-me.routes";

app.log.info("[MobileOfflineModule] - Initializing Mobile Offline Module");

try {
  app.register(MobileOfflineV1Routes, { prefix: "/v1/mobile/offline" });
  app.register(MobileMeV1Routes, { prefix: "/v1/mobile/me" });
  app.log.info("[MobileOfflineModule] - Module initialized successfully");
} catch (error) {
  app.log.error("[MobileOfflineModule] - Failed to initialize module: %s", error);
  throw error;
}
