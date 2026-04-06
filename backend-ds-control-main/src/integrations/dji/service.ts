import { getDjiHttpClientConfigPreview } from "./client";
import { getDjiConfigHealth, type DjiConfigHealth } from "./config";
import { connectDjiMqtt, disconnectDjiMqtt, getDjiMqttStatus } from "./mqtt";
import { DjiIntegrationRepository } from "./repository";
import type {
  DjiMqttConnectionStatus,
  DjiSmokeMqttConnectAttemptPayload,
  DjiSmokeMqttConnectResultPayload,
  DjiSmokeMqttDisconnectPayload,
  DjiTestEventPayload,
} from "./types";

export type DjiConnectionHealthPayload = {
  config: DjiConfigHealth;
  mqtt: DjiMqttConnectionStatus;
  http: ReturnType<typeof getDjiHttpClientConfigPreview>;
};

export class DjiIntegrationService {
  constructor(private readonly repository = new DjiIntegrationRepository()) {}

  getHealth(): DjiConfigHealth {
    return getDjiConfigHealth();
  }

  getConnectionHealth(): DjiConnectionHealthPayload {
    return {
      config: getDjiConfigHealth(),
      mqtt: getDjiMqttStatus(),
      http: getDjiHttpClientConfigPreview(),
    };
  }

  async createTestEvent(): Promise<{ id: string; success: true }> {
    const payload: DjiTestEventPayload = {
      kind: "dji_foundation_test",
      message: "placeholder",
      createdAt: new Date().toISOString(),
    };

    const { id } = await this.repository.insertIntegrationEvent({
      provider: "dji",
      rawPayload: payload as unknown as Record<string, unknown>,
      source: "test",
    });

    return { id, success: true };
  }

  async connectSmokeTest(): Promise<{
    success: boolean;
    attemptEventId: string;
    resultEventId: string;
    mqtt: DjiMqttConnectionStatus;
    reason?: string;
  }> {
    const attemptPayload: DjiSmokeMqttConnectAttemptPayload = {
      kind: "dji_smoke_mqtt_connect_attempt",
      createdAt: new Date().toISOString(),
    };

    const { id: attemptEventId } = await this.repository.insertIntegrationEvent({
      provider: "dji",
      rawPayload: attemptPayload as unknown as Record<string, unknown>,
      source: "smoke_test",
    });

    const mqttResult = await connectDjiMqtt();

    const resultPayload: DjiSmokeMqttConnectResultPayload = {
      kind: "dji_smoke_mqtt_connect_result",
      createdAt: new Date().toISOString(),
      ok: mqttResult.ok,
      skipped: mqttResult.skipped,
      reason: mqttResult.reason,
    };

    const { id: resultEventId } = await this.repository.insertIntegrationEvent({
      provider: "dji",
      rawPayload: resultPayload as unknown as Record<string, unknown>,
      source: "smoke_test",
    });

    return {
      success: mqttResult.ok,
      attemptEventId,
      resultEventId,
      mqtt: getDjiMqttStatus(),
      reason: mqttResult.reason,
    };
  }

  async disconnectSmokeTest(): Promise<{
    success: boolean;
    eventId: string;
    mqtt: DjiMqttConnectionStatus;
  }> {
    await disconnectDjiMqtt();

    const disconnectPayload: DjiSmokeMqttDisconnectPayload = {
      kind: "dji_smoke_mqtt_disconnect",
      createdAt: new Date().toISOString(),
    };

    const { id: eventId } = await this.repository.insertIntegrationEvent({
      provider: "dji",
      rawPayload: disconnectPayload as unknown as Record<string, unknown>,
      source: "smoke_test",
    });

    return {
      success: true,
      eventId,
      mqtt: getDjiMqttStatus(),
    };
  }
}
