import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateDroneDTO } from "./dto/create-drone.dto";
import type { UpdateDroneDTO } from "./dto/update-drone.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { DroneVM } from "@models/drone.vm";
import { app } from "@modules/app/app.module";
import { DroneService } from "./services/drone.service";

export class DroneController {
  private service: DroneService;

  constructor() {
    this.service = new DroneService();
  }

  public createDrone = async (
    request: FastifyRequest<{
      Body: CreateDroneDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[DroneController] - Starting drone creation");

      await this.service.createDrone(request.body);

      app.log.info("[DroneController] - Drone created successfully");
      return reply.status(201).send({
        message: "Drone created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[DroneController] - Drone creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[DroneController] - Unexpected error during drone creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listDrones = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & {
        search?: string;
        status?: "active" | "inactive";
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[DroneController] - Listing drones");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const status = request.query.status;

      const result = await this.service.listDrones(page, limit, search, status);

      app.log.info("[DroneController] - Successfully listed drones");
      return reply.status(200).send({
        message: "Drones listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[DroneController] - Failed to list drones: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[DroneController] - Unexpected error during drone listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getDroneById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[DroneController] - Fetching drone details for drone %s", request.params.id);
      const droneDb = await this.service.getDroneById(request.params.id);
      const drone = DroneVM.toViewModel(droneDb);

      app.log.info("[DroneController] - Successfully retrieved drone details");
      return reply.status(200).send({
        message: "Drone details retrieved successfully",
        drone,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[DroneController] - Failed to retrieve drone details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[DroneController] - Unexpected error during drone details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getDronesOperation = async (
    request: FastifyRequest<{Querystring: {
      startDate: string,
      endDate: string,
    }}>,
    reply: FastifyReply
  ) => {
    try {
      const { startDate, endDate} = request.query;
      app.log.info("[DroneController] - Starting drones stats for drones %s - %s", startDate, endDate);
      const operation = await this.service.getDronesOperation(new Date(startDate), new Date(endDate));
      return reply.status(200).send({
        message: "Drone stats sucessfully",
        operation
      });
    } catch (error) {
      if(error instanceof AppError) {
        app.log.warn("[DroneController] - Drones operation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[DroneController] - Unexpected error during drone operation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }

  public updateDrone = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateDroneDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[DroneController] - Starting drone update for drone %s", request.params.id);

      const updatedDrone = await this.service.updateDrone(request.params.id, request.body);
      const drone = DroneVM.toViewModel(updatedDrone);

      app.log.info("[DroneController] - Drone updated successfully");
      return reply.status(200).send({
        message: "Drone updated successfully",
        drone,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[DroneController] - Drone update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[DroneController] - Unexpected error during drone update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteDrone = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[DroneController] - Starting drone deletion for drone %s", request.params.id);

      await this.service.deleteDrone(request.params.id);

      app.log.info("[DroneController] - Drone deleted successfully");
      return reply.status(200).send({
        message: "Drone deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[DroneController] - Drone deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[DroneController] - Unexpected error during drone deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
} 