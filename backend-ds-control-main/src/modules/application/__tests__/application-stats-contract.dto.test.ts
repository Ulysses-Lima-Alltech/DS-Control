import { describe, expect, it } from "vitest";

import { ApplicationEvolutionItemSchema, ApplicationEvolutionQueryStringSchema } from "../dto/stats-evolution.dto";
import { ApplicationStatsQueryStringSchema } from "../dto/stats.dto";
import { TopFarmStatsSchema, TopFarmsStatsQueryStringSchema } from "../dto/stats-top-farms.dto";

describe("ApplicationStatsQueryStringSchema (filtros compartilhados /stats)", () => {
  it("aceita query vazia: campos opcionais ausentes e invalidApplication vira false após transform", () => {
    const parsed = ApplicationStatsQueryStringSchema.parse({});
    expect(parsed.invalidApplication).toBe(false);
    expect(parsed.search).toBeUndefined();
  });

  it("aceita filtros parciais sem exigir demais campos", () => {
    const pilotId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const parsed = ApplicationStatsQueryStringSchema.parse({ pilotId });
    expect(parsed.pilotId).toBe(pilotId);
    expect(parsed.farmId).toBeUndefined();
  });

  it("transforma invalidApplication de string para boolean", () => {
    expect(ApplicationStatsQueryStringSchema.parse({ invalidApplication: "true" }).invalidApplication).toBe(true);
    expect(ApplicationStatsQueryStringSchema.parse({ invalidApplication: "false" }).invalidApplication).toBe(false);
  });

  it("valida intervalo de datas quando ambas presentes", () => {
    const parsed = ApplicationStatsQueryStringSchema.parse({
      startDate: "2024-01-15",
      endDate: "2024-03-20",
    });
    expect(parsed.startDate).toBe("2024-01-15");
    expect(parsed.endDate).toBe("2024-03-20");
  });

  it("rejeita data em formato inválido", () => {
    expect(() =>
      ApplicationStatsQueryStringSchema.parse({
        startDate: "15-01-2024",
        endDate: "2024-03-20",
      }),
    ).toThrow();
  });
});

describe("TopFarmsStatsQueryStringSchema — GET /stats/top-farms", () => {
  it("aplica limit padrão 5 com query vazia", () => {
    const parsed = TopFarmsStatsQueryStringSchema.parse({});
    expect(parsed.limit).toBe(5);
  });

  it("coage limit numérico a partir de string (como query HTTP)", () => {
    const parsed = TopFarmsStatsQueryStringSchema.parse({ limit: "3" });
    expect(parsed.limit).toBe(3);
  });

  it("rejeita limit fora do intervalo 1–20", () => {
    expect(() => TopFarmsStatsQueryStringSchema.parse({ limit: 0 })).toThrow();
    expect(() => TopFarmsStatsQueryStringSchema.parse({ limit: 21 })).toThrow();
  });

  it("preserva filtros compartilhados junto com limit", () => {
    const farmId = "11111111-2222-3333-4444-555555555555";
    const parsed = TopFarmsStatsQueryStringSchema.parse({
      limit: 10,
      farmId,
      startDate: "2024-06-01",
      endDate: "2024-06-30",
    });
    expect(parsed.limit).toBe(10);
    expect(parsed.farmId).toBe(farmId);
    expect(parsed.startDate).toBe("2024-06-01");
    expect(parsed.endDate).toBe("2024-06-30");
  });
});

describe("ApplicationEvolutionQueryStringSchema — GET /stats/evolution", () => {
  it("aplica months padrão 6 com query vazia", () => {
    const parsed = ApplicationEvolutionQueryStringSchema.parse({});
    expect(parsed.months).toBe(6);
  });

  it("coage months a partir de string e saneia para inteiro", () => {
    expect(ApplicationEvolutionQueryStringSchema.parse({ months: "12" }).months).toBe(12);
    expect(ApplicationEvolutionQueryStringSchema.parse({ months: 1 }).months).toBe(1);
  });

  it("rejeita months fora de 1–24", () => {
    expect(() => ApplicationEvolutionQueryStringSchema.parse({ months: 0 })).toThrow();
    expect(() => ApplicationEvolutionQueryStringSchema.parse({ months: 25 })).toThrow();
  });

  it("combina months com os mesmos filtros do dashboard", () => {
    const customerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const parsed = ApplicationEvolutionQueryStringSchema.parse({
      months: 3,
      customerId,
      search: "soja",
    });
    expect(parsed.months).toBe(3);
    expect(parsed.customerId).toBe(customerId);
    expect(parsed.search).toBe("soja");
  });
});

describe("Schemas de resposta (contrato JSON)", () => {
  it("TopFarmStatsSchema aceita farmId nulo e números", () => {
    const row = TopFarmStatsSchema.parse({
      farmId: null,
      farmName: "Fazenda não informada",
      applicationsCount: 2,
      totalAreaHectares: 15.5,
    });
    expect(row.farmId).toBeNull();
    expect(row.totalAreaHectares).toBe(15.5);
  });

  it("TopFarmStatsSchema aceita UUID em farmId", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const row = TopFarmStatsSchema.parse({
      farmId: id,
      farmName: "Fazenda A",
      applicationsCount: 1,
      totalAreaHectares: 0,
    });
    expect(row.farmId).toBe(id);
  });

  it("ApplicationEvolutionItemSchema valida item de série temporal", () => {
    const item = ApplicationEvolutionItemSchema.parse({
      yearMonth: "2024-08",
      applicationsCount: 42,
    });
    expect(item.yearMonth).toBe("2024-08");
    expect(item.applicationsCount).toBe(42);
  });
});
