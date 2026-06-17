import AppError from "@common/handlers/app-error";
import type { FastifyReply, FastifyRequest } from "fastify";
import { app } from "@modules/app/app.module";
import type { ImportDjiFlightsFromS3DTO, LinkDjiFlightDTO, PatchDjiFlightLinkDTO } from "./dto/dji.dto";
import { DjiService } from "./services/dji.service";

export class DjiController {
  private readonly service = new DjiService();

  public importFlightsFromS3 = async (
    request: FastifyRequest<{ Body: ImportDjiFlightsFromS3DTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[DjiController] - Importing DJI flights from S3");
      const result = await this.service.importFlightsFromS3(request.body);
      return reply.status(200).send(result);
    } catch (error) {
      this.handleError(reply, error, "[DjiController] - Failed to import DJI flights");
    }
  };

  public listFlights = async (
    request: FastifyRequest<{ Querystring: { date?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const flights = await this.service.listFlights(request.query.date);
      return reply.status(200).send({
        message: "DJI flights listed successfully",
        flights,
      });
    } catch (error) {
      this.handleError(reply, error, "[DjiController] - Failed to list DJI flights");
    }
  };

  public getFlightByRecordNumber = async (
    request: FastifyRequest<{ Params: { recordNumber: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const flight = await this.service.getFlightByRecordNumber(request.params.recordNumber);
      return reply.status(200).send({
        message: "DJI flight retrieved successfully",
        flight,
      });
    } catch (error) {
      this.handleError(reply, error, "[DjiController] - Failed to get DJI flight");
    }
  };

  public listApprovedFlightsByApplication = async (
    request: FastifyRequest<{ Params: { applicationId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const flights = await this.service.listApprovedFlightsByApplication(request.params.applicationId);
      return reply.status(200).send({
        message: "Application DJI flights listed successfully",
        flights,
      });
    } catch (error) {
      this.handleError(reply, error, "[DjiController] - Failed to list application DJI flights");
    }
  };

  public linkFlightToApplication = async (
    request: FastifyRequest<{
      Params: { applicationId: string; recordNumber: string };
      Body: LinkDjiFlightDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const link = await this.service.linkFlightToApplication(
        request.params.applicationId,
        request.params.recordNumber,
        request.body,
        request.payload?.userId,
      );

      return reply.status(200).send({
        message: "DJI flight linked successfully",
        link,
      });
    } catch (error) {
      this.handleError(reply, error, "[DjiController] - Failed to link DJI flight");
    }
  };

  public updateFlightApplicationLink = async (
    request: FastifyRequest<{
      Params: { applicationId: string; recordNumber: string };
      Body: PatchDjiFlightLinkDTO;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const link = await this.service.linkFlightToApplication(
        request.params.applicationId,
        request.params.recordNumber,
        request.body,
        request.payload?.userId,
      );

      return reply.status(200).send({
        message: "DJI flight link updated successfully",
        link,
      });
    } catch (error) {
      this.handleError(reply, error, "[DjiController] - Failed to update DJI flight link");
    }
  };

  private handleError(reply: FastifyReply, error: unknown, message: string): void {
    if (error instanceof AppError) {
      app.log.warn("%s: %s", message, error.message);
      reply.status(error.statusCode).send(error.throw());
      return;
    }

    app.log.error("%s: %s", message, error);
    reply.status(500).send(new AppError("Internal server error", 500, error).throw());
  }
}
