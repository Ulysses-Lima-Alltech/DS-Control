import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTopFarms = vi.fn();
const mockEvolution = vi.fn();

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
      { yearMonth: "2024-02", applicationsCount: 5 },
      { yearMonth: "2024-03", applicationsCount: 7 },
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
});
