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

export type DjiConfigHealth = {
  enabled: boolean;
  appIdConfigured: boolean;
  appKeyConfigured: boolean;
  appLicenseConfigured: boolean;
  mqttBrokerConfigured: boolean;
  mqttUsernameConfigured: boolean;
  mqttPasswordConfigured: boolean;
  webhookSecretConfigured: boolean;
};

export function getDjiConfigHealth(): DjiConfigHealth {
  const c = getDjiEnvConfig();
  return {
    enabled: c.enabled,
    appIdConfigured: Boolean(c.appId),
    appKeyConfigured: Boolean(c.appKey),
    appLicenseConfigured: Boolean(c.appLicense),
    mqttBrokerConfigured: Boolean(c.mqttBrokerUrl),
    mqttUsernameConfigured: Boolean(c.mqttUsername),
    mqttPasswordConfigured: Boolean(c.mqttPassword),
    webhookSecretConfigured: Boolean(c.webhookSecret),
  };
}
