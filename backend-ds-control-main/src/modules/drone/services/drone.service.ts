import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import type { PaginatedRequest } from "@common/types/paginated-request.types";
import { drones } from "@infra/database/schema";
import { and, eq } from "drizzle-orm";

import { db } from "@infra/database";
import { DroneVM } from "@models/drone.vm";
import { app } from "@modules/app/app.module";
import { DroneRepository } from "@repositories/drones/drone.repository";
import type { Drone } from "@repositories/drones/drone.types";
import type { CreateDroneDTO } from "../dto/create-drone.dto";
import { DronesOperationDTO } from "../dto/drone-operation.dto";
import type { UpdateDroneDTO } from "../dto/update-drone.dto";

export class DroneService {
  private readonly droneRepository = new DroneRepository();

  /**
   * @description Create a new drone
   * @param {CreateDroneDTO} data - The drone data
   * @throws {AppError} If validation fails or drone name already exists
   */
  public async createDrone({ name, model, aircraftRid }: CreateDroneDTO): Promise<void> {
    app.log.info("[DroneService] - Starting drone creation");

    // Check if drone name already exists
    const existingDrone = await db.query.drones.findFirst({
      where: eq(drones.name, name),
    });

    if (existingDrone && !existingDrone.deletedAt) {
      app.log.warn(
        "[DroneService] - Drone creation failed: Drone name %s already exists",
        name,
      );
      throw new AppError(
        "Já existe um drone com este nome",
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    // Create the drone
    const drone = await this.droneRepository.createDrone({
      name,
      model,
      aircraftRid,
    });

    app.log.info("[DroneService] - Drone created successfully with ID %s", drone.id);
  }

  /**
   * @description Get all drones with optional search and status filter
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name, model, or aircraftRid
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<PaginatedRequest<DroneViewModelSchema>>} The list of drones
   */
  public async listDrones(
    page: number,
    limit: number,
    search?: string,
    status?: "active" | "inactive"
  ): Promise<PaginatedRequest<typeof import("@models/drone.vm").DroneViewModelSchema>> {
    app.log.info("[DroneService] - Listing all drones");

    const queryResult = await this.droneRepository.getAllDrones(page, limit, search, status);
    const totalCount = await this.droneRepository.countDrones(search, status);

    app.log.info("[DroneService] - Retrieved %d drones", totalCount);

    return {
      data: queryResult.map((drone) => DroneVM.toViewModel(drone)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get drone by ID
   * @param {string} droneId - The drone's ID
   * @returns {Promise<Drone>} The drone details
   * @throws {AppError} If the drone is not found
   */
  public async getDroneById(droneId: string): Promise<Drone> {
    app.log.info("[DroneService] - Fetching drone details for drone %s", droneId);

    try {
      const drone = await this.droneRepository.getDroneById(droneId);

      if (!drone) {
        app.log.warn("[DroneService] - Drone not found: %s", droneId);
        throw new AppError("Drone não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[DroneService] - Successfully retrieved drone details for %s", droneId);
      return drone;
    } catch (error) {
      app.log.error("[DroneService] - Failed to fetch drone details: %s", error);
      throw error;
    }
  }

  /**
   * @description Stats to Drones Operation
   * @param {Date} startDate - The StartDate 
   * @param {Date} endDate - The endDate 
   * @returns {Promise<DronesOperationDTO>} return Drones Operation
   */
  public async getDronesOperation(startDate: Date, endDate: Date): Promise<DronesOperationDTO> {
    const [
      avgHectareByDrones,
      totalHectares,
      compareLastMonth,
    ] = await Promise.all([
      this.droneRepository.avgHectaresByDrones(startDate, endDate),
      this.droneRepository.CountHectares(startDate, endDate),
      this.droneRepository.compareLastMonth(startDate, endDate)
    ]);

    return {
      avgHectareByDrones,
      avgDailyByDrones: (compareLastMonth.reduce((acc, curr) => acc + curr.hectares, 0) / compareLastMonth.length) || 0,
      totalHectares,
      compareLastMonth,
    }
  }

  /**
   * @description Update drone by ID
   * @param {string} droneId - The drone's ID
   * @param {UpdateDroneDTO} data - The drone data to update
   * @returns {Promise<Drone>} The updated drone
   * @throws {AppError} If the drone is not found or validation fails
   */
  public async updateDrone(droneId: string, data: UpdateDroneDTO): Promise<Drone> {
    app.log.info("[DroneService] - Starting drone update for drone %s", droneId);

    try {
      const existingDrone = await this.droneRepository.getDroneById(droneId);

      if (!existingDrone) {
        app.log.warn("[DroneService] - Drone update failed: Drone %s not found", droneId);
        throw new AppError("Drone não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.name && data.name !== existingDrone.name) {
        const nameExists = await db.query.drones.findFirst({
          where: and(eq(drones.name, data.name)),
        });

        if (nameExists && nameExists.id !== droneId && !nameExists.deletedAt) {
          app.log.warn(
            "[DroneService] - Drone update failed: Drone name %s already exists",
            data.name,
          );
          throw new AppError(
            "Já existe um drone com este nome",
            HTTP_STATUS_CODES.CONFLICT,
          );
        }
      }

      const updatedDrone = await this.droneRepository.updateDrone(droneId, data);

      if (!updatedDrone) {
        app.log.error("[DroneService] - Failed to update drone %s", droneId);
        throw new AppError("Failed to update drone", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[DroneService] - Drone updated successfully with ID %s", droneId);
      return updatedDrone;
    } catch (error) {
      app.log.error("[DroneService] - Drone update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete a drone (soft delete)
   * @param {string} droneId - The drone's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the drone is not found
   */
  public async deleteDrone(droneId: string): Promise<void> {
    app.log.info("[DroneService] - Starting drone deletion for drone %s", droneId);

    try {
      // Check if drone exists and is not already deleted
      const existingDrone = await this.droneRepository.getDroneById(droneId);

      if (!existingDrone) {
        app.log.warn("[DroneService] - Drone deletion failed: Drone %s not found", droneId);
        throw new AppError("Drone não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.droneRepository.deleteDrone(droneId);

      app.log.info("[DroneService] - Drone deleted successfully with ID %s", droneId);
    } catch (error) {
      app.log.error("[DroneService] - Drone deletion failed: %s", error);
      throw error;
    }
  }
} 