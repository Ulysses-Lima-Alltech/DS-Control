/**
 * Cliente MQTT DJI — smoke test (singleton em memória, sem boot automático).
 */

import { randomBytes } from "node:crypto";

import mqtt from "mqtt";
import type { MqttClient } from "mqtt";

import { getDjiConfig, isDjiMqttConfigured } from "./config";
import type { DjiMqttConnectionState, DjiMqttConnectionStatus } from "./types";

export type DjiMqttConsumerPlaceholderOptions = {
  brokerUrl?: string;
};

export class DjiMqttConsumerPlaceholder {
  constructor(_options?: DjiMqttConsumerPlaceholderOptions) {}

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

function maskBrokerUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) {
      u.password = "***";
    }
    if (u.username) {
      u.username = "***";
    }
    return u.toString();
  } catch {
    return url.replace(/:[^:@]+@/, ":***@");
  }
}

function parseTopicsConfigured(): string[] {
  const raw = getDjiConfig().mqttTopicsRaw;
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

let mqttSingleton: MqttClient | null = null;

let internalState: DjiMqttConnectionState = "disconnected";
let lastConnectedAt: string | null = null;
let lastError: string | null = null;

function setState(next: DjiMqttConnectionState): void {
  internalState = next;
}

export function getDjiMqttStatus(): DjiMqttConnectionStatus {
  const c = getDjiConfig();
  const brokerUrlMasked = c.mqttBrokerUrl ? maskBrokerUrl(c.mqttBrokerUrl) : null;
  return {
    state: internalState,
    lastConnectedAt,
    lastError,
    brokerUrlMasked,
    topicsConfigured: parseTopicsConfigured(),
  };
}

/**
 * Conecta ao broker MQTT quando DJI_ENABLED e broker URL estão presentes.
 * Não faz subscribe em tópicos. Sem chamada automática no boot do servidor.
 */
export async function connectDjiMqtt(): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}> {
  if (!isDjiMqttConfigured()) {
    setState("disconnected");
    lastError = "DJI disabled or MQTT broker URL missing";
    return { ok: false, skipped: true, reason: lastError };
  }

  if (mqttSingleton?.connected) {
    setState("connected");
    return { ok: true };
  }

  if (internalState === "connecting") {
    return { ok: false, reason: "connect_in_progress" };
  }

  const c = getDjiConfig();
  const brokerUrl = c.mqttBrokerUrl!;

  setState("connecting");
  lastError = null;

  const clientId =
    c.mqttClientId ?? `ds-dji-smoke-${randomBytes(4).toString("hex")}`;

  return new Promise((resolve) => {
    const client = mqtt.connect(brokerUrl, {
      username: c.mqttUsername,
      password: c.mqttPassword,
      clientId,
      reconnectPeriod: 0,
      connectTimeout: 15_000,
    });

    mqttSingleton = client;

    let settled = false;
    const finish = (result: { ok: boolean; skipped?: boolean; reason?: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      if (!client.connected) {
        lastError = "connect_timeout";
        setState("error");
        client.removeAllListeners();
        client.end(true);
        mqttSingleton = null;
        finish({ ok: false, reason: lastError });
      }
    }, 16_000);

    const onEarlyError = (err: Error) => {
      clearTimeout(timeout);
      client.removeListener("connect", onConnect);
      lastError = err.message;
      setState("error");
      client.removeAllListeners();
      client.end(true);
      mqttSingleton = null;
      finish({ ok: false, reason: err.message });
    };

    const onConnect = () => {
      clearTimeout(timeout);
      client.removeListener("error", onEarlyError);
      lastConnectedAt = new Date().toISOString();
      lastError = null;
      setState("connected");
      client.on("error", (err: Error) => {
        lastError = err.message;
        setState("error");
      });
      client.on("reconnect", () => {
        setState("connecting");
      });
      client.on("close", () => {
        if (internalState !== "error") {
          setState("disconnected");
        }
      });
      client.on("offline", () => {
        lastError = lastError ?? "offline";
      });
      finish({ ok: true });
    };

    client.once("connect", onConnect);
    client.once("error", onEarlyError);
  });
}

/** Encerra o cliente MQTT singleton. */
export async function disconnectDjiMqtt(): Promise<{ ok: boolean }> {
  const client = mqttSingleton;
  if (!client) {
    setState("disconnected");
    return { ok: true };
  }

  return new Promise((resolve) => {
    client.end(false, {}, () => {
      mqttSingleton = null;
      setState("disconnected");
      resolve({ ok: true });
    });
  });
}
