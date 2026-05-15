import type { FastifyReply, FastifyRequest } from "fastify";
import type { ChangePasswordDTO } from "./dto/change-password.dto";
import type { CreateUserDTO } from "./dto/create-user.dto";
import type { UpdateMeDTO } from "./dto/update-me.dto";
import type { UpdateUserDTO } from "./dto/update-user.dto";

import AppError from "@common/handlers/app-error";
import type { PaginatedRequestQueryString } from "@common/types/paginated-request.types";
import { UserVM } from "@models/user.vm";
import { app } from "@modules/app/app.module";
import type { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import { UserService } from "./services/user.service";
import { UserOrderBy, UserOrderType } from "@repositories/users/user.types";

export class UserController {
  private service: UserService;

  constructor() {
    this.service = new UserService();
  }

  public createUser = async (
    request: FastifyRequest<{ Body: CreateUserDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      console.log(request.body);
      app.log.info("[UserController] - Starting user creation for email %s", request.body.email);

      await this.service.createUser(request.body);

      app.log.info("[UserController] - User created successfully");
      return reply.status(201).send({
        message: "User created successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - User creation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during user creation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public requestPasswordReset = async (
    request: FastifyRequest<{ Body: RequestPasswordResetDto }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[UserController] - Starting password reset request for email %s",
        request.body.email,
      );
      await this.service.requestPasswordReset(request.body.email);

      app.log.info("[UserController] - Password reset request sent successfully");
      return reply.status(200).send({
        message: "Password reset request sent successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - Password reset request failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during password reset request: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public resetPassword = async (
    request: FastifyRequest<{ Body: ResetPasswordDto }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[UserController] - Starting password reset for user %s", request.body.userId);
      await this.service.resetPassword(
        request.body.token,
        request.body.password,
        request.body.userId,
      );

      app.log.info("[UserController] - Password reset completed successfully");
      return reply.status(200).send({
        message: "Password reset successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - Password reset failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during password reset: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      app.log.info("[UserController] - Fetching user details for user %s", request.payload?.userId);
      const userDb = await this.service.getMe(request.payload?.userId!);
      const user = UserVM.toViewModel(userDb);

      app.log.info("[UserController] - Successfully retrieved user details");
      return reply.status(200).send({
        message: "User details retrieved successfully",
        user,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - Failed to retrieve user details: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during user details retrieval: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public listUsers = async (
    request: FastifyRequest<{
      Querystring: PaginatedRequestQueryString & {
        search?: string;
        orderBy?: UserOrderBy;
        orderType?: UserOrderType;
        type?: "backoffice" | "pilot" | "farmer";
        status?: "active" | "inactive" | "all";
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[UserController] - Listing users");
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 10;
      const search = request.query.search;
      const orderBy = request.query.orderBy;
      const orderType = request.query.orderType;
      const filters = {
        type: request.query.type,
        status: request.query.status,
      };

      const users = await this.service.listUsers(page, limit, search, filters, orderBy, orderType);

      app.log.info("[UserController] - Successfully listed users");
      return reply.status(200).send({
        message: "Users listed successfully",
        ...users,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - Failed to list users: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during user listing: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public getUserById = async (
    request: FastifyRequest<{Params: {id: string}}>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[UserController] - Fetching user details for user %s", request.params.id)
      const userDb = await this.service.getUserById(request.params.id);
      const user = UserVM.toViewModel(userDb);

      app.log.info("[UserController] - Successfully retrieved user details");
      return reply.status(200).send(user)
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn(
          "[UserController] - Failed to retrieve user details: %s",
          error.message,
        );
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error(
        "[UserController] - Unexpected error during customer details retrieval: %s",
        error,
      )
      reply.status(500).send(new AppError("Internal server errror", 500, error).throw())
    }
  }

  public updateUser = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[UserController] - Starting user update for user %s", request.params.id);

      const updatedUser = await this.service.updateUser(request.params.id, request.body);
      const user = UserVM.toViewModel(updatedUser);

      app.log.info("[UserController] - User updated successfully");
      return reply.status(200).send({
        message: "User updated successfully",
        user,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - User update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during user update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public updateMe = async (request: FastifyRequest<{ Body: UpdateMeDTO }>, reply: FastifyReply) => {
    try {
      app.log.info(
        "[UserController] - Starting profile update for user %s",
        request.payload?.userId,
      );

      const updatedUser = await this.service.updateMe(request.payload?.userId!, request.body);
      const user = UserVM.toViewModel(updatedUser);

      app.log.info("[UserController] - Profile updated successfully");
      return reply.status(200).send({
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - Profile update failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during profile update: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public deleteUser = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[UserController] - Starting user deletion for user %s", request.params.id);

      await this.service.deleteUser(request.params.id, request.payload?.userId!);

      app.log.info("[UserController] - User deleted successfully");
      return reply.status(200).send({
        message: "User deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - User deletion failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during user deletion: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public changePassword = async (
    request: FastifyRequest<{ Body: ChangePasswordDTO }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info(
        "[UserController] - Starting password change for user %s",
        request.payload?.userId,
      );

      await this.service.changePassword(request.payload?.userId!, request.body);

      app.log.info("[UserController] - Password changed successfully");
      return reply.status(200).send({
        message: "Password changed successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - Password change failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during password change: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  };

  public activateUser = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      app.log.info("[UserController] - Starting user activation for user %s", request.params.id);
      await this.service.activateUser(request.params.id);

      app.log.info("[UserController] - User activated successfully");
      return reply.status(200).send({
        message: "User activated successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[UserController] - User activation failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[UserController] - Unexpected error during user activation: %s", error);
      reply.status(500).send(new AppError("Internal server error", 500, error).throw());
    }
  }
}
