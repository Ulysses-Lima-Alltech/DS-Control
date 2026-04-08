import { describe, expect, it, vi, beforeEach } from "vitest";

const chain = vi.hoisted(() => {
  const c: {
    from: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  c.from.mockImplementation(() => c);
  c.leftJoin.mockImplementation(() => c);
  c.where.mockImplementation(() => c);
  c.groupBy.mockImplementation(() => c);
  c.orderBy.mockImplementation(() => c);
  c.limit.mockResolvedValue([]);
  return c;
});

const db = vi.hoisted(() => ({
  select: vi.fn(() => chain),
}));

vi.mock("@modules/app/app.module", () => ({
  app: {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock("@infra/database", () => ({
  db,
}));

import { ApplicationService } from "../services/application.service";

describe("ApplicationService.getTopFarmsStats", () => {
  let service: ApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    chain.limit.mockResolvedValue([]);
    service = new ApplicationService();
  });

  it("usa limit padrão 5 quando filtros não definem limit", async () => {
    await service.getTopFarmsStats(undefined);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("respeita limit explícito", async () => {
    await service.getTopFarmsStats({ limit: 3 } as Parameters<ApplicationService["getTopFarmsStats"]>[0]);
    expect(chain.limit).toHaveBeenCalledWith(3);
  });

  it("retorna estrutura mapeada com números e aceita fazenda sem id (null)", async () => {
    chain.limit.mockResolvedValue([
      {
        farmId: null,
        farmName: "Fazenda não informada",
        applicationsCount: "2",
        totalAreaHectares: "100.5",
      },
    ]);

    const rows = await service.getTopFarmsStats({ limit: 5 } as Parameters<ApplicationService["getTopFarmsStats"]>[0]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      farmId: null,
      farmName: "Fazenda não informada",
      applicationsCount: 2,
      totalAreaHectares: 100.5,
    });
  });

  it("ordena por área aplicada via SQL (orderBy chamado na query)", async () => {
    chain.limit.mockResolvedValue([
      {
        farmId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        farmName: "A",
        applicationsCount: "1",
        totalAreaHectares: "50",
      },
    ]);

    await service.getTopFarmsStats({});

    expect(chain.orderBy).toHaveBeenCalledTimes(1);
  });

  it("aplica intervalo de datas e filtros compartilhados sem lançar (where é composto)", async () => {
    await service.getTopFarmsStats({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      pilotId: "11111111-2222-3333-4444-555555555555",
      serviceOrderStatus: "open",
    } as Parameters<ApplicationService["getTopFarmsStats"]>[0]);

    expect(chain.where).toHaveBeenCalled();
    expect(db.select).toHaveBeenCalled();
  });

  it("mantém ordenação decrescente de área quando o mock retorna linhas como o banco ordenaria", async () => {
    chain.limit.mockResolvedValue([
      {
        farmId: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
        farmName: "Maior",
        applicationsCount: "1",
        totalAreaHectares: "300",
      },
      {
        farmId: "aaaaaaaa-bbbb-cccc-dddd-222222222222",
        farmName: "Menor",
        applicationsCount: "2",
        totalAreaHectares: "50",
      },
    ]);

    const rows = await service.getTopFarmsStats({ limit: 2 } as Parameters<ApplicationService["getTopFarmsStats"]>[0]);

    expect(rows[0]!.totalAreaHectares).toBeGreaterThanOrEqual(rows[1]!.totalAreaHectares);
  });
});

describe("ApplicationService.getApplicationsEvolution", () => {
  let service: ApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    chain.limit.mockResolvedValue([]);
    service = new ApplicationService();
  });

  it("usa months padrão 6", async () => {
    await service.getApplicationsEvolution(undefined);
    expect(chain.limit).toHaveBeenCalledWith(6);
  });

  it("respeita months explícito (saneado pelo schema na rota; aqui valor numérico)", async () => {
    await service.getApplicationsEvolution({ months: 12 } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);
    expect(chain.limit).toHaveBeenCalledWith(12);
  });

  it("com granularity day limita buckets a no máximo 90", async () => {
    await service.getApplicationsEvolution({
      granularity: "day",
      months: 90,
    } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);
    expect(chain.limit).toHaveBeenCalledWith(90);
  });

  it("com granularity year limita buckets a no máximo 40", async () => {
    await service.getApplicationsEvolution({
      granularity: "year",
      months: 100,
    } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);
    expect(chain.limit).toHaveBeenCalledWith(40);
  });

  it("retorna array vazio quando não há linhas agregadas", async () => {
    chain.limit.mockResolvedValue([]);
    const rows = await service.getApplicationsEvolution({});
    expect(rows).toEqual([]);
  });

  it("granularity month retorna buckets YYYY-MM em ordem ASC", async () => {
    chain.limit.mockResolvedValue([
      { date: "2024-03-01", applicationsCount: "1" },
      { date: "2024-01-01", applicationsCount: "2" },
    ]);

    const rows = await service.getApplicationsEvolution({
      granularity: "month",
      months: 6,
    } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);

    expect(rows.map((r) => r.date)).toEqual(["2024-01-01", "2024-03-01"]);
    expect(rows[0]!.applicationsCount).toBe(2);
    expect(rows[1]!.applicationsCount).toBe(1);
  });

  it("granularity year retorna buckets YYYY em ordem ASC", async () => {
    chain.limit.mockResolvedValue([
      { date: "2026-01-01", applicationsCount: "10" },
      { date: "2025-01-01", applicationsCount: "8" },
    ]);

    const rows = await service.getApplicationsEvolution({
      granularity: "year",
      months: 40,
    } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);

    expect(rows.map((r) => r.date)).toEqual(["2025-01-01", "2026-01-01"]);
    expect(rows[0]!.applicationsCount).toBe(8);
    expect(rows[1]!.applicationsCount).toBe(10);
  });

  it("chama orderBy na query e aplica filtros compartilhados", async () => {
    chain.limit.mockResolvedValue([]);

    await service.getApplicationsEvolution({
      granularity: "month",
      startDate: "2024-05-01",
      endDate: "2024-05-31",
      customerId: "33333333-4444-5555-6666-777777777777",
      farmId: "11111111-2222-3333-4444-555555555555",
      productId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);

    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
  });

  it("granularity day continua retornando formato YYYY-MM-DD", async () => {
    chain.limit.mockResolvedValue([
      { date: "2026-04-07", applicationsCount: "3" },
      { date: "2026-04-06", applicationsCount: "11" },
    ]);

    const rows = await service.getApplicationsEvolution({
      granularity: "day",
      months: 90,
      farmId: "11111111-2222-3333-4444-555555555555",
      productId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    } as Parameters<ApplicationService["getApplicationsEvolution"]>[0]);

    expect(rows.map((r) => r.date)).toEqual(["2026-04-06", "2026-04-07"]);
    expect(rows[0]!.applicationsCount).toBe(11);
    expect(rows[1]!.applicationsCount).toBe(3);
  });
});
