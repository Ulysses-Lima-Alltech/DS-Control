/**
 * Esqueleto para futuro consumidor MQTT DJI — sem conexão real.
 */

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
