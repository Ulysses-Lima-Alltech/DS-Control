import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateAssistantDTO } from "./dto/create-assistant.dto";
import type { UpdateAssistantDTO } from "./dto/update-assistant.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { AssistantVM } from "@models/assistant.vm";
import { app } from "@modules/app/app.module";
import { AssistantService } from "./services/assistant.service";

export class AssistantController {
  private service: AssistantService;

  constructor() {
    this.service = new AssistantService();
  }

  public createAssistant = async (
    request: FastifyRequest<{
      Body: CreateAssistantDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[AssistantController] - Starting assistant creation with name %s",
        request.body.name,
      );

      await this.service.createAssistant(request.body);

      app.log.info("[AssistantController] - Assistant created successfully");
      return reply.status(201).send({
        message: "Assistant created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AssistantController] - Assistant creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AssistantController] - Unexpected error during assistant creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listAssistants = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & {
        search?: string;
        status?: "active" | "inactive";
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[AssistantController] - Listing assistants");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const status = request.query.status;

      const result = await this.service.listAssistants(page, limit, search, status);

      app.log.info("[AssistantController] - Successfully listed assistants");
      return reply.status(200).send({
        message: "Assistants listed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AssistantController] - Failed to list assistants: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AssistantController] - Unexpected error during assistant listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getAssistantById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[AssistantController] - Fetching assistant details for assistant %s", request.params.id);
      const assistantDb = await this.service.getAssistantById(request.params.id);
      const assistant = AssistantVM.toViewModel(assistantDb);

      app.log.info("[AssistantController] - Successfully retrieved assistant details");
      return reply.status(200).send({
        message: "Assistant details retrieved successfully",
        assistant,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AssistantController] - Failed to retrieve assistant details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AssistantController] - Unexpected error during assistant details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateAssistant = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateAssistantDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[AssistantController] - Starting assistant update for assistant %s", request.params.id);

      const updatedAssistant = await this.service.updateAssistant(request.params.id, request.body);
      const assistant = AssistantVM.toViewModel(updatedAssistant);

      app.log.info("[AssistantController] - Assistant updated successfully");
      return reply.status(200).send({
        message: "Assistant updated successfully",
        assistant,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AssistantController] - Assistant update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AssistantController] - Unexpected error during assistant update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteAssistant = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[AssistantController] - Starting assistant deletion for assistant %s", request.params.id);

      await this.service.deleteAssistant(request.params.id);

      app.log.info("[AssistantController] - Assistant deleted successfully");
      return reply.status(200).send({
        message: "Assistant deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AssistantController] - Assistant deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AssistantController] - Unexpected error during assistant deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };
} 