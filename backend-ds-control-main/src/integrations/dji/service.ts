import { getDjiConfigHealth, type DjiConfigHealth } from "./config";
import { DjiIntegrationRepository } from "./repository";
import type { DjiTestEventPayload } from "./types";

export class DjiIntegrationService {
  constructor(private readonly repository = new DjiIntegrationRepository()) {}

  getHealth(): DjiConfigHealth {
    return getDjiConfigHealth();
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
}
