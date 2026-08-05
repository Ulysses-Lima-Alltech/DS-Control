import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTopFarms = vi.fn();
const mockEvolution = vi.fn();
const mockListApplications = vi.fn();

vi.mock("@modules/app/app.module", () => ({
  app: {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock("../services/application.service", () => ({
  ApplicationService: function MockApplicationService() {
    return {
      getTopFarmsStats: mockTopFarms,
      getApplicationsEvolution: mockEvolution,
      listApplications: mockListApplications,
    };
  },
}));

import type { FastifyReply, FastifyRequest } from "fastify";
import { ApplicationController } from "../application.controller";

function createReplyMock() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return { send, status, reply: { status } as unknown as FastifyReply };
}

describe("ApplicationController — contrato de resposta dos endpoints de estatísticas", () => {
  let controller: ApplicationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ApplicationController();
  });

  it("getTopFarmsStats envia 200 com message e topFarms conforme serviço", async () => {
    const payload = [
      {
        farmId: null as string | null,
        farmName: "Fazenda não informada",
        applicationsCount: 1,
        totalAreaHectares: 12.5,
      },
    ];
    mockTopFarms.mockResolvedValue(payload);

    const { send, status, reply } = createReplyMock();
    const request = {
      query: { limit: 2 },
    } as unknown as FastifyRequest<{ Querystring: { limit: number } }>;

    await controller.getTopFarmsStats(request, reply);

    expect(mockTopFarms).toHaveBeenCalledWith({ limit: 2 });
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith({
      message: "Top farms statistics retrieved successfully",
      topFarms: payload,
    });
  });

  it("getApplicationsEvolution envia 200 com message e evolution conforme serviço", async () => {
    const payload = [
      { date: "2024-02-01", applicationsCount: 5 },
      { date: "2024-03-01", applicationsCount: 7 },
    ];
    mockEvolution.mockResolvedValue(payload);

    const { send, status, reply } = createReplyMock();
    const request = {
      query: { months: 6, startDate: "2024-01-01", endDate: "2024-12-31" },
    } as unknown as FastifyRequest<{ Querystring: { months: number; startDate: string; endDate: string } }>;

    await controller.getApplicationsEvolution(request, reply);

    expect(mockEvolution).toHaveBeenCalledWith(request.query);
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith({
      message: "Applications evolution retrieved successfully",
      evolution: payload,
    });
  });

  it("força estatísticas farmer ao cliente autenticado e desativa ignoreFilters", async () => {
    mockTopFarms.mockResolvedValue([]);
    const customerId = "11111111-1111-4111-8111-111111111111";
    const { reply } = createReplyMock();
    const request = {
      query: { limit: 5, ignoreFilters: true },
      payload: { type: "farmer", customerId },
    } as unknown as FastifyRequest;

    await controller.getTopFarmsStats(request as never, reply);

    expect(mockTopFarms).toHaveBeenCalledWith({
      limit: 5,
      ignoreFilters: false,
      customerId,
    });
  });

  it("rejeita customerId arbitrário antes de listar aplicações farmer", async () => {
    const { status, reply } = createReplyMock();
    const request = {
      query: {
        page: 1,
        limit: 10,
        customerId: "22222222-2222-4222-8222-222222222222",
      },
      payload: {
        type: "farmer",
        customerId: "11111111-1111-4111-8111-111111111111",
      },
    } as unknown as FastifyRequest;

    await controller.listApplications(request as never, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockListApplications).not.toHaveBeenCalled();
  });
});
