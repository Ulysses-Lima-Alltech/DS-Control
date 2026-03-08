import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateCultureTypeDTO } from "./dto/create-culture-type.dto";
import type { CultureTypeQueryString } from "./dto/culture-type-query.dto";
import type { UpdateCultureTypeDTO } from "./dto/update-culture-type.dto";

import AppError from "@common/handlers/app-error";
import { CultureTypeVM } from "@models/culture-type.vm";
import { app } from "@modules/app/app.module";
import { CultureTypeService } from "./services/culture-type.service";

export class CultureTypeController {
  private service: CultureTypeService;

  constructor() {
    this.service = new CultureTypeService();
  }

  public createCultureType = async (
    request: FastifyRequest<{
      Body: CreateCultureTypeDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[CultureTypeController] - Starting culture type creation with name %s",
        request.body.name,
      );

      await this.service.createCultureType(request.body);

      app.log.info("[CultureTypeController] - Culture type created successfully");
      return reply.status(201).send({
        message: "Culture type created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CultureTypeController] - Culture type creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CultureTypeController] - Unexpected error during culture type creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listCultureTypes = async (
    request: FastifyRequest<{
      Querystring: CultureTypeQueryString;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[CultureTypeController] - Listing culture types");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const status = request.query.status;

      const result = await this.service.listCultureTypes(page, limit, search, status);

      app.log.info("[CultureTypeController] - Successfully listed culture types");
      return reply.status(200).send({
        message: "Culture types listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CultureTypeController] - Failed to list culture types: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CultureTypeController] - Unexpected error during culture type listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getStatsCultureTypes = async (
    request: FastifyRequest<{ Querystring: {
      startDate: string,
      endDate: string,
    }}>,
    reply: FastifyReply,
  ) => {
    try {
      const { startDate, endDate} = request.query;
      app.log.info("[CultureTypeController] - Starting cultures types stats for culture types %s - %s", startDate, endDate);
      const statsCulture = await this.service.getStatsCultureTypes(new Date(startDate), new Date(endDate));
      return reply.status(200).send({
        message: "Culture Types sucessfully",
        statsCulture
      });
    } catch (error) {
      if(error instanceof AppError) {
        app.log.warn("[CultureTypeController] - Culture types stats failed: %s", error);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.warn("[CultureTypeController] - Unexpected error during culture types stats: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }

  public getCultureTypeById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[CultureTypeController] - Fetching culture type details for culture type %s", request.params.id);
      const cultureTypeDb = await this.service.getCultureTypeById(request.params.id);
      const cultureType = CultureTypeVM.toViewModel(cultureTypeDb);

      app.log.info("[CultureTypeController] - Successfully retrieved culture type details");
      return reply.status(200).send({
        message: "Culture type details retrieved successfully",
        cultureType,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CultureTypeController] - Failed to retrieve culture type details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CultureTypeController] - Unexpected error during culture type details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateCultureType = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateCultureTypeDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[CultureTypeController] - Starting culture type update for culture type %s", request.params.id);

      const updatedCultureType = await this.service.updateCultureType(request.params.id, request.body);
      const cultureType = CultureTypeVM.toViewModel(updatedCultureType);

      app.log.info("[CultureTypeController] - Culture type updated successfully");
      return reply.status(200).send({
        message: "Culture type updated successfully",
        cultureType,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CultureTypeController] - Culture type update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CultureTypeController] - Unexpected error during culture type update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteCultureType = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[CultureTypeController] - Starting culture type deletion for culture type %s", request.params.id);

      await this.service.deleteCultureType(request.params.id);

      app.log.info("[CultureTypeController] - Culture type deleted successfully");
      return reply.status(200).send({
        message: "Culture type deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[CultureTypeController] - Culture type deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[CultureTypeController] - Unexpected error during culture type deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
} 