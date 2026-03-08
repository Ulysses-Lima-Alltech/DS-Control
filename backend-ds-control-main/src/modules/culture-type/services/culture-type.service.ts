import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { db } from "@infra/database";
import { cultureTypes } from "@infra/database/schema";
import { and, eq, isNull } from "drizzle-orm";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import {
  CultureTypeVM,
  type CultureTypeViewModelSchema,
} from "@models/culture-type.vm";
import { app } from "@modules/app/app.module";
import { CultureTypeRepository } from "@repositories/culture-types/culture-type.repository";
import type { CultureType } from "@repositories/culture-types/culture-type.types";
import type { CreateCultureTypeDTO } from "../dto/create-culture-type.dto";
import { statsCultureTypes } from "../dto/stats-culture-type.dto";
import type { UpdateCultureTypeDTO } from "../dto/update-culture-type.dto";

export class CultureTypeService {
  private readonly cultureTypeRepository = new CultureTypeRepository();

  /**
   * @description Create a new culture type
   * @param {CreateCultureTypeDTO} data - The culture type data
   * @throws {AppError} If validation fails
   */
  public async createCultureType({ name, description }: CreateCultureTypeDTO): Promise<void> {
    app.log.info("[CultureTypeService] - Starting culture type creation with name %s", name);

    // Check if culture type name already exists
    const existingCultureType = await db.query.cultureTypes.findFirst({
      where: and(eq(cultureTypes.name, name), isNull(cultureTypes.deletedAt)),
    });

    if (existingCultureType) {
      app.log.warn(
        "[CultureTypeService] - Culture type creation failed: Culture type name %s already exists",
        name,
      );
      throw new AppError(
        "Já existe um tipo de cultura com este nome",
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    // Create the culture type
    const cultureType = await this.cultureTypeRepository.createCultureType({
      name,
      description,
    });

    app.log.info("[CultureTypeService] - Culture type created successfully with ID %s", cultureType.id);
  }

  /**
   * @description Get all culture types
   * @returns {Promise<CultureType[]>} The list of culture types
   */
  public async listCultureTypes(
    page: number,
    limit: number,
    search?: string,
    status?: "active" | "inactive",
  ): Promise<PaginatedRequest<typeof CultureTypeViewModelSchema>> {
    app.log.info("[CultureTypeService] - Listing all culture types");

    const queryResult = await this.cultureTypeRepository.getAllCultureTypes(page, limit, search, status);
    const totalCount = await this.cultureTypeRepository.countCultureTypes(search, status);

    app.log.info("[CultureTypeService] - Retrieved %d culture types", totalCount);

    return {
      data: queryResult.map((cultureType) => CultureTypeVM.toViewModel(cultureType)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Stats to Drones Operation
   * @param {Date} startDate - The StartDate 
   * @param {Date} endDate - The endDate 
   * @returns {Promise<DronesOperationDTO>} return Drones Operation
   */
  public async getStatsCultureTypes(startDate: Date, endDate: Date): Promise<statsCultureTypes> {
    const [
      totalHectares,
      compareLastMonth,
    ] = await Promise.all([
      this.cultureTypeRepository.countHectares(startDate, endDate),
      this.cultureTypeRepository.compareLastMonth(startDate, endDate)
    ]);

    return {
      totalHectares,
      compareLastMonth,
    }
  }

  /**
   * @description Get culture type by ID
   * @param {string} cultureTypeId - The culture type's ID
   * @returns {Promise<CultureType>} The culture type details
   * @throws {AppError} If the culture type is not found
   */
  public async getCultureTypeById(cultureTypeId: string): Promise<CultureType> {
    app.log.info("[CultureTypeService] - Fetching culture type details for culture type %s", cultureTypeId);

    try {
      const cultureType = await this.cultureTypeRepository.getCultureTypeById(cultureTypeId);

      if (!cultureType) {
        app.log.warn("[CultureTypeService] - Culture type not found: %s", cultureTypeId);
        throw new AppError("Tipo de cultura não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[CultureTypeService] - Successfully retrieved culture type details for %s", cultureTypeId);
      return cultureType;
    } catch (error) {
      app.log.error("[CultureTypeService] - Failed to fetch culture type details: %s", error);
      throw error;
    }
  }

  /**
   * @description Update culture type by ID
   * @param {string} cultureTypeId - The culture type's ID
   * @param {UpdateCultureTypeDTO} data - The culture type data to update
   * @returns {Promise<CultureType>} The updated culture type
   * @throws {AppError} If the culture type is not found or validation fails
   */
  public async updateCultureType(cultureTypeId: string, data: UpdateCultureTypeDTO): Promise<CultureType> {
    app.log.info("[CultureTypeService] - Starting culture type update for culture type %s", cultureTypeId);

    try {
      const existingCultureType = await this.cultureTypeRepository.getCultureTypeById(cultureTypeId);

      if (!existingCultureType) {
        app.log.warn("[CultureTypeService] - Culture type update failed: Culture type %s not found", cultureTypeId);
        throw new AppError("Tipo de cultura não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.name && data.name !== existingCultureType.name) {
        const nameExists = await db.query.cultureTypes.findFirst({
          where: and(eq(cultureTypes.name, data.name), isNull(cultureTypes.deletedAt)),
        });

        if (nameExists) {
          app.log.warn(
            "[CultureTypeService] - Culture type update failed: Culture type name %s already exists",
            data.name,
          );
          throw new AppError(
            "Já existe um tipo de cultura com este nome",
            HTTP_STATUS_CODES.CONFLICT,
          );
        }
      }

      const updateData: { name?: string; description?: string | null } = {};
      if (data.name) updateData.name = data.name;
      if (data.description) updateData.description = data.description;

      if (Object.keys(updateData).length > 0) {
        await this.cultureTypeRepository.updateCultureType(cultureTypeId, updateData);
      }

      const updatedCultureType = await this.cultureTypeRepository.getCultureTypeById(cultureTypeId);

      if (!updatedCultureType) {
        app.log.error(
          "[CultureTypeService] - Culture type update failed: Unable to retrieve updated culture type %s",
          cultureTypeId,
        );
        throw new AppError("Falha ao atualizar o tipo de cultura", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[CultureTypeService] - Culture type updated successfully with ID %s", cultureTypeId);
      return updatedCultureType;
    } catch (error) {
      app.log.error("[CultureTypeService] - Culture type update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete a culture type (soft delete)
   * @param {string} cultureTypeId - The culture type's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the culture type is not found
   */
  public async deleteCultureType(cultureTypeId: string): Promise<void> {
    app.log.info("[CultureTypeService] - Starting culture type deletion for culture type %s", cultureTypeId);

    try {
      // Check if culture type exists and is not already deleted
      const existingCultureType = await this.cultureTypeRepository.getCultureTypeById(cultureTypeId);

      if (!existingCultureType) {
        app.log.warn("[CultureTypeService] - Culture type deletion failed: Culture type %s not found", cultureTypeId);
        throw new AppError("Tipo de cultura não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.cultureTypeRepository.deleteCultureType(cultureTypeId);

      app.log.info("[CultureTypeService] - Culture type deleted successfully with ID %s", cultureTypeId);
    } catch (error) {
      app.log.error("[CultureTypeService] - Culture type deletion failed: %s", error);
      throw error;
    }
  }
} 