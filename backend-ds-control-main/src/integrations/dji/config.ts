/**
 * DJI Cloud — leitura de variáveis de ambiente (fundação).
 * Não integra com @config/index para não alterar o schema global de env.
 */

function trimOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const t = value.trim();
  return t.length === 0 ? undefined : t;
}

function parseEnabled(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type DjiEnvConfig = {
  enabled: boolean;
  appId: string | undefined;
  appKey: string | undefined;
  appLicense: string | undefined;
  mqttBrokerUrl: string | undefined;
  mqttUsername: string | undefined;
  mqttPassword: string | undefined;
  webhookSecret: string | undefined;
};

export function getDjiEnvConfig(): DjiEnvConfig {
  return {
    enabled: parseEnabled(process.env.DJI_ENABLED),
    appId: trimOrUndefined(process.env.DJI_APP_ID),
    appKey: trimOrUndefined(process.env.DJI_APP_KEY),
    appLicense: trimOrUndefined(process.env.DJI_APP_LICENSE),
    mqttBrokerUrl: trimOrUndefined(process.env.DJI_MQTT_BROKER_URL),
    mqttUsername: trimOrUndefined(process.env.DJI_MQTT_USERNAME),
    mqttPassword: trimOrUndefined(process.env.DJI_MQTT_PASSWORD),
    webhookSecret: trimOrUndefined(process.env.DJI_WEBHOOK_SECRET),
  };
}

/** Configuração completa DJI (inclui envs adicionais para smoke test / HTTP / MQTT). */
export type DjiConfig = DjiEnvConfig & {
  mqttClientId: string | undefined;
  mqttTopicsRaw: string | undefined;
  httpBaseUrl: string | undefined;
  logLevel: string | undefined;
};

export function getDjiConfig(): DjiConfig {
  const base = getDjiEnvConfig();
  return {
    ...base,
    mqttClientId: trimOrUndefined(process.env.DJI_MQTT_CLIENT_ID),
    mqttTopicsRaw: trimOrUndefined(process.env.DJI_MQTT_TOPICS),
    httpBaseUrl: trimOrUndefined(process.env.DJI_HTTP_BASE_URL),
    logLevel: trimOrUndefined(process.env.DJI_LOG_LEVEL),
  };
}

export type DjiConfigHealth = {
  enabled: boolean;
  appIdConfigured: boolean;
  appKeyConfigured: boolean;
  appLicenseConfigured: boolean;
  mqttBrokerConfigured: boolean;
  mqttUsernameConfigured: boolean;
  mqttPasswordConfigured: boolean;
  webhookSecretConfigured: boolean;
  mqttClientIdConfigured: boolean;
  mqttTopicsConfigured: boolean;
  httpBaseUrlConfigured: boolean;
  logLevelConfigured: boolean;
};

export function getDjiConfigHealth(): DjiConfigHealth {
  const c = getDjiConfig();
  return {
    enabled: c.enabled,
    appIdConfigured: Boolean(c.appId),
    appKeyConfigured: Boolean(c.appKey),
    appLicenseConfigured: Boolean(c.appLicense),
    mqttBrokerConfigured: Boolean(c.mqttBrokerUrl),
    mqttUsernameConfigured: Boolean(c.mqttUsername),
    mqttPasswordConfigured: Boolean(c.mqttPassword),
    webhookSecretConfigured: Boolean(c.webhookSecret),
    mqttClientIdConfigured: Boolean(c.mqttClientId),
    mqttTopicsConfigured: Boolean(c.mqttTopicsRaw),
    httpBaseUrlConfigured: Boolean(c.httpBaseUrl),
    logLevelConfigured: Boolean(c.logLevel),
  };
}

/** Broker URL presente e integração DJI habilitada (mínimo para smoke MQTT). */
export function isDjiMqttConfigured(): boolean {
  const c = getDjiConfig();
  return Boolean(c.enabled && c.mqttBrokerUrl);
}
