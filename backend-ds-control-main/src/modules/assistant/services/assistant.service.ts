import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { db } from "@infra/database";
import { assistants } from "@infra/database/schema";
import { and, eq, isNull } from "drizzle-orm";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import {
    AssistantVM,
    type AssistantViewModelSchema,
} from "@models/assistant.vm";
import { app } from "@modules/app/app.module";
import { AssistantRepository } from "@repositories/assistants/assistant.repository";
import type { Assistant } from "@repositories/assistants/assistant.types";
import type { CreateAssistantDTO } from "../dto/create-assistant.dto";
import type { UpdateAssistantDTO } from "../dto/update-assistant.dto";

export class AssistantService {
  private readonly assistantRepository = new AssistantRepository();

  /**
   * @description Create a new assistant
   * @param {CreateAssistantDTO} data - The assistant data
   * @throws {AppError} If validation fails
   */
  public async createAssistant({ name }: CreateAssistantDTO): Promise<void> {
    app.log.info("[AssistantService] - Starting assistant creation with name %s", name);

    // Check if assistant name already exists
    const existingAssistant = await db.query.assistants.findFirst({
      where: and(eq(assistants.name, name), isNull(assistants.deletedAt)),
    });

    if (existingAssistant) {
      app.log.warn(
        "[AssistantService] - Assistant creation failed: Assistant name %s already exists",
        name,
      );
      throw new AppError(
        "Já existe um assistente com este nome",
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    // Create the assistant
    const assistant = await this.assistantRepository.createAssistant({
      name,
    });

    app.log.info("[AssistantService] - Assistant created successfully with ID %s", assistant.id);
  }

  /**
   * @description Get all assistants with optional search and status filter
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name
   * @param {string} status - Optional status filter (active/inactive)
   * @returns {Promise<PaginatedRequest<typeof AssistantViewModelSchema>>} The list of assistants
   */
  public async listAssistants(
    page: number,
    limit: number,
    search?: string,
    status?: "active" | "inactive"
  ): Promise<PaginatedRequest<typeof AssistantViewModelSchema>> {
    app.log.info("[AssistantService] - Listing all assistants");

    const queryResult = await this.assistantRepository.getAllAssistants(page, limit, search, status);
    const totalCount = await this.assistantRepository.countAssistants(search, status);

    app.log.info("[AssistantService] - Retrieved %d assistants", totalCount);

    return {
      data: queryResult.map((assistant) => AssistantVM.toViewModel(assistant)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get assistant by ID
   * @param {string} assistantId - The assistant's ID
   * @returns {Promise<Assistant>} The assistant details
   * @throws {AppError} If the assistant is not found
   */
  public async getAssistantById(assistantId: string): Promise<Assistant> {
    app.log.info("[AssistantService] - Fetching assistant details for assistant %s", assistantId);

    try {
      const assistant = await this.assistantRepository.getAssistantById(assistantId);

      if (!assistant) {
        app.log.warn("[AssistantService] - Assistant not found: %s", assistantId);
        throw new AppError("Assistente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[AssistantService] - Successfully retrieved assistant details for %s", assistantId);
      return assistant;
    } catch (error) {
      app.log.error("[AssistantService] - Failed to fetch assistant details: %s", error);
      throw error;
    }
  }

  /**
   * @description Update assistant by ID
   * @param {string} assistantId - The assistant's ID
   * @param {UpdateAssistantDTO} data - The assistant data to update
   * @returns {Promise<Assistant>} The updated assistant
   * @throws {AppError} If the assistant is not found or validation fails
   */
  public async updateAssistant(assistantId: string, data: UpdateAssistantDTO): Promise<Assistant> {
    app.log.info("[AssistantService] - Starting assistant update for assistant %s", assistantId);

    try {
      const existingAssistant = await this.assistantRepository.getAssistantById(assistantId);

      if (!existingAssistant) {
        app.log.warn("[AssistantService] - Assistant update failed: Assistant %s not found", assistantId);
        throw new AppError("Assistente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.name && data.name !== existingAssistant.name) {
        const nameExists = await db.query.assistants.findFirst({
          where: and(eq(assistants.name, data.name), isNull(assistants.deletedAt)),
        });

        if (nameExists) {
          app.log.warn(
            "[AssistantService] - Assistant update failed: Assistant name %s already exists",
            data.name,
          );
          throw new AppError(
            "Já existe um assistente com este nome",
            HTTP_STATUS_CODES.CONFLICT,
          );
        }
      }

      const updateData: { name?: string } = {};
      if (data.name) updateData.name = data.name;

      if (Object.keys(updateData).length > 0) {
        await this.assistantRepository.updateAssistant(assistantId, updateData);
      }

      const updatedAssistant = await this.assistantRepository.getAssistantById(assistantId);

      if (!updatedAssistant) {
        app.log.error(
          "[AssistantService] - Assistant update failed: Unable to retrieve updated assistant %s",
          assistantId,
        );
        throw new AppError("Falha ao atualizar o assistente", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[AssistantService] - Assistant updated successfully with ID %s", assistantId);
      return updatedAssistant;
    } catch (error) {
      app.log.error("[AssistantService] - Assistant update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Delete an assistant (soft delete)
   * @param {string} assistantId - The assistant's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the assistant is not found
   */
  public async deleteAssistant(assistantId: string): Promise<void> {
    app.log.info("[AssistantService] - Starting assistant deletion for assistant %s", assistantId);

    try {
      // Check if assistant exists and is not already deleted
      const existingAssistant = await this.assistantRepository.getAssistantById(assistantId);

      if (!existingAssistant) {
        app.log.warn("[AssistantService] - Assistant deletion failed: Assistant %s not found", assistantId);
        throw new AppError("Assistente não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      await this.assistantRepository.deleteAssistant(assistantId);

      app.log.info("[AssistantService] - Assistant deleted successfully with ID %s", assistantId);
    } catch (error) {
      app.log.error("[AssistantService] - Assistant deletion failed: %s", error);
      throw error;
    }
  }
} 