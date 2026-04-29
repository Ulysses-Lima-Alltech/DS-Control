import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { CropSeasonVM } from "@models/crop-season.vm";
import { app } from "@modules/app/app.module";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateCropSeasonDTO } from "./dto/create-crop-season.dto";
import type { UpdateCropSeasonDTO } from "./dto/update-crop-season.dto";
import { CropSeasonService } from "./services/crop-season.service";

export class CropSeasonController {
  private readonly service: CropSeasonService;

  constructor() {
    this.service = new CropSeasonService();
  }

  public createCropSeason = async (
    request: FastifyRequest<{ Body: CreateCropSeasonDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      await this.service.createCropSeason(request.body);
      return reply.status(201).send({
        message: "Crop season created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CropSeasonController] - Unexpected error during crop season creation: %o", { error });
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listCropSeasons = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & {
        search?: string;
        status?: "active" | "inactive";
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const result = await this.service.listCropSeasons(
        request.query.page ?? 1,
        request.query.limit ?? 10,
        request.query.search,
        request.query.status ?? "active",
      );

      return reply.status(200).send({
        message: "Crop seasons listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CropSeasonController] - Unexpected error during crop season listing: %o", { error });
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getCropSeasonById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const cropSeason = await this.service.getCropSeasonById(request.params.id);

      return reply.status(200).send({
        message: "Crop season retrieved successfully",
        cropSeason: CropSeasonVM.toViewModel(cropSeason),
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CropSeasonController] - Unexpected error during crop season retrieval: %o", { error });
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getCurrentCropSeason = async (_: FastifyRequest, reply: FastifyReply) => {
    try {
      const cropSeason = await this.service.getCurrentCropSeason();

      return reply.status(200).send({
        message: "Current crop season retrieved successfully",
        cropSeason: cropSeason ? CropSeasonVM.toViewModel(cropSeason) : null,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CropSeasonController] - Unexpected error during current crop season retrieval: %o", { error });
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateCropSeason = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateCropSeasonDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      const cropSeason = await this.service.updateCropSeason(request.params.id, request.body);

      return reply.status(200).send({
        message: "Crop season updated successfully",
        cropSeason: CropSeasonVM.toViewModel(cropSeason),
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CropSeasonController] - Unexpected error during crop season update: %o", { error });
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteCropSeason = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      await this.service.deleteCropSeason(request.params.id);
      return reply.status(200).send({
        message: "Crop season deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CropSeasonController] - Unexpected error during crop season deletion: %o", { error });
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
}

