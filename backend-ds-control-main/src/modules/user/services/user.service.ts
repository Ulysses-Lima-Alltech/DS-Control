import bcrypt from "bcrypt";
import { and, eq, gt, ne, or } from "drizzle-orm";

import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { env } from "@config/index";
import { db } from "@infra/database";
import { users, userTokens } from "@infra/database/schema";

import type { PaginatedRequest } from "@common/types/paginated-request.types";
import { resend } from "@infra/resend";
import { createForgotPasswordTemplate } from "@infra/resend/templates/forgot-password-mail";
import { UserVM, type UserViewModelSchema, type User as UserVMType } from "@models/user.vm";
import { app } from "@modules/app/app.module";
import { UserRepository } from "@repositories/users/user.repository";
import type { User, UserOrderBy, UserOrderType } from "@repositories/users/user.types";
import crypto from "node:crypto";
import type { ChangePasswordDTO } from "../dto/change-password.dto";
import type { CreateUserDTO } from "../dto/create-user.dto";
import type { UpdateUserDTO } from "../dto/update-user.dto";

export class UserService {
  private readonly userRepository = new UserRepository();

  /**
   * @description Create a new user
   * @param {CreateUserDTO} data - The user data
   * @throws {AppError} If the user already exists
   */
  public async createUser({ email, name, password, type, customerId }: CreateUserDTO): Promise<void> {
    console.log(email, name, password, type, customerId);

    app.log.info("[UserService] - Starting user creation for email %s", email);

    const existingUser = await db.query.users.findFirst({
      where: or(eq(users.email, email)),
    });

    if (existingUser?.email === email) {
      app.log.warn("[UserService] - User creation failed: Email %s already exists", email);
      throw new AppError("Já existe usuário com este Email", HTTP_STATUS_CODES.CONFLICT);
    }

    const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

    const user = await this.userRepository.createUser({
      email,
      name,
      password: hashedPassword,
      type,
      customerId,
    });

    app.log.info("[UserService] - User created successfully with ID %s", user.id);
  }

  /**
   * @description Request a password reset
   * @param {string} email - The user's email
   * @throws {AppError} If the user is not found
   */
  public async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase();
    let userId: string | undefined;
    let operation = "validate reset request";

    if (!normalizedEmail) {
      throw new AppError("E-mail é obrigatório", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    app.log.info({ email: normalizedEmail }, "[UserService] Starting password reset request");

    try {
      operation = "find user";
      const user = await this.userRepository.getUserByEmail(normalizedEmail);

      if (!user) {
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }
      userId = user.id;

      if (!user.email?.trim()) {
        throw new AppError("Usuário não possui e-mail cadastrado", HTTP_STATUS_CODES.BAD_REQUEST);
      }

      if (user.deletedAt) {
        throw new AppError("Usuário inativo", HTTP_STATUS_CODES.BAD_REQUEST);
      }

      operation = "find existing reset token";
      const oldToken = await db.query.userTokens.findFirst({
        where: and(
          eq(userTokens.userId, user.id),
          eq(userTokens.context, "PASSWORD_RESET"),
          gt(userTokens.expiresAt, new Date()),
        ),
      });

      operation = "generate reset token";
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = await bcrypt.hash(resetToken, env.BCRYPT_SALT_ROUNDS);

      operation = "save reset token";
      const [newToken] = await db.insert(userTokens).values({
        context: "PASSWORD_RESET",
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      }).returning({ id: userTokens.id });

      if (!newToken) throw new Error("Database did not return the created password reset token");

      try {
        operation = "send password reset email";
        await this.sendPasswordResetEmail(user, resetToken);
      } catch (error) {
        await db.delete(userTokens).where(eq(userTokens.id, newToken.id));
        throw error;
      }

      if (oldToken) {
        operation = "remove previous reset token";
        await db.delete(userTokens).where(and(
          eq(userTokens.userId, user.id),
          eq(userTokens.context, "PASSWORD_RESET"),
          ne(userTokens.id, newToken.id),
        ));
      }

      app.log.info({ userId, email: normalizedEmail }, "[UserService] Password reset email sent");
    } catch (error) {
      const err = this.normalizeError(error);
      const originalError = error instanceof AppError && error.error
        ? this.normalizeError(error.error)
        : err;
      const context = {
        userId,
        email: normalizedEmail,
        operation,
        error: originalError.message,
        stack: originalError.stack,
      };
      if (error instanceof AppError) {
        const log = error.statusCode >= 500 ? app.log.error.bind(app.log) : app.log.warn.bind(app.log);
        log({ ...context, err }, "[UserService] Password reset request rejected");
        throw error;
      }
      app.log.error({ ...context, err }, "[UserService] Password reset request failed");
      throw error;
    }
  }

  /**
   * @description Reset a user's password
   * @param {string} token - The reset token
   * @param {string} newPassword - The new password
   * @throws {AppError} If the reset token is invalid or expired
   */
  public async resetPassword(token: string, newPassword: string, userId: string): Promise<void> {
    app.log.info("[UserService] - Starting password reset for user %s", userId);

    try {
      const resetTokenRecord = await db.query.userTokens.findFirst({
        where: and(
          eq(userTokens.userId, userId),
          eq(userTokens.context, "PASSWORD_RESET"),
          gt(userTokens.expiresAt, new Date()),
        ),
      });

      if (!resetTokenRecord) {
        app.log.warn(
          "[UserService] - Password reset failed: Invalid or expired token for user %s",
          userId,
        );
        throw new AppError("Token de redefinição inválido ou expirado", HTTP_STATUS_CODES.FORBIDDEN);
      }

      const isTokenValid = await bcrypt.compare(token, resetTokenRecord.token);

      if (!isTokenValid) {
        app.log.warn(
          "[UserService] - Password reset failed: Invalid token provided for user %s",
          userId,
        );
        throw new AppError("Token de redefinição inválido ou expirado", HTTP_STATUS_CODES.FORBIDDEN);
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        app.log.warn("[UserService] - Password reset failed: User %s not found", userId);
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

      await db.transaction(async (trx) => {
        await trx.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));
        await trx.delete(userTokens).where(eq(userTokens.id, resetTokenRecord.id));
      });

      app.log.info("[UserService] - Password reset completed successfully for user %s", userId);
    } catch (error) {
      app.log.error("[UserService] - Password reset failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Get the user details
   * @param {string} userId - The user's ID
   * @returns {Promise<User>} The user details
   */
  public async getMe(userId: string): Promise<UserVMType> {
    app.log.info("[UserService] - Fetching user details for user %s", userId);

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        app.log.warn("[UserService] - User not found: %s", userId);
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[UserService] - Successfully retrieved user details for %s", userId);
      return user as UserVMType;
    } catch (error) {
      app.log.error("[UserService] - Failed to fetch user details: %s", error);
      throw error;
    }
  }

  /**
   * @description List all users with optional search and filters
   * @param {number} page - The page number
   * @param {number} limit - The limit per page
   * @param {string} search - Optional search term to filter by name or email
   * @param {object} filters - Optional filters for type and status
   * @returns The list of users
   */
  public async listUsers(
    page: number,
    limit: number,
    search?: string,
    filters?: {
      type?: "backoffice" | "pilot" | "farmer";
      status?: "active" | "inactive" | "all";
    },
    orderBy?: UserOrderBy,
    orderType?: UserOrderType,
  ): Promise<PaginatedRequest<typeof UserViewModelSchema>> {
    const usersList = await this.userRepository.getAllUsers(page, limit, search, filters, orderBy, orderType);
    const totalCount = await this.userRepository.countUsers(search, filters);

    return {
      data: usersList.map((user) => UserVM.toViewModel(user as UserVMType)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  public async getUserById(userId: string): Promise<UserVMType> {
    app.log.info("[UserService] - Fetching user details for user %s", userId);

    try {
      const user = await this.userRepository.getUserById(userId);

      if(!user) {
        app.log.warn("[UserService] - User not found %s", userId);
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      app.log.info("[UserService]-  Successfully retrieved user details for %s", userId)
      return user as UserVMType;
    } catch (error) {
      app.log.error("[UserService] - Failed to fetch application details: %s", error);
      throw error;
    }
  }

  /**
   * @description Disable a user
   * @param {string} userId - The user's ID
   * @returns {Promise<void>} The disabled user
   */
  public async toggleUserStatus(userId: string, action: "disable" | "enable"): Promise<void> {
    if (action === "disable") {
      await this.userRepository.disableUser(userId);
    } else {
      await this.userRepository.enableUser(userId);
    }
  }

  /**
   * @description Send a password reset email to the user
   * @param {User} user - The user
   * @param {string} resetToken - The reset token
   * @throws {Error} If the email fails to send
   */
  private async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    const resetLink = `${env.FRONTEND_URL}/auth/forgot-password/callback?token=${resetToken}&userId=${user.id}`;

    const { error } = await resend.emails.send({
      from: "IControl <no-reply@dstechbrasil.com.br>",
      to: [user.email],
      subject: "Redefina sua senha | IControl",
      html: createForgotPasswordTemplate({ userName: user.name, resetLink }),
    });

    if (error) {
      throw new AppError(
        "Não foi possível enviar o e-mail de redefinição de senha",
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        this.normalizeError(error),
      );
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (error && typeof error === "object") {
      const data = error as Record<string, unknown>;
      const normalized = new Error(
        typeof data.message === "string" ? data.message : JSON.stringify(error),
      );
      Object.assign(normalized, data);
      return normalized;
    }
    return new Error(String(error));
  }

  /**
   * @description Update user by ID (Admin function)
   * @param {string} userId - The user's ID
   * @param {UpdateUserDTO} data - The user data to update
   * @returns {Promise<UserVMType>} The updated user
   * @throws {AppError} If the user is not found or email already exists
   */
  public async updateUser(userId: string, data: UpdateUserDTO): Promise<UserVMType> {
    app.log.info("[UserService] - Starting user update for user %s", userId);

    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!existingUser) {
        app.log.warn("[UserService] - User update failed: User %s not found", userId);
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (data.email && data.email !== existingUser.email) {
        const emailExists = await db.query.users.findFirst({
          where: eq(users.email, data.email),
        });

        if (emailExists) {
          app.log.warn("[UserService] - User update failed: Email %s already exists", data.email);
          throw new AppError("Já existe usuário com este Email", HTTP_STATUS_CODES.CONFLICT);
        }
      }

      const updatedUser = await this.userRepository.updateUser(userId, data);

      if (!updatedUser) {
        app.log.error("[UserService] - User update failed: Unable to update user %s", userId);
        throw new AppError("Falha ao atualizar o usuário", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      }

      app.log.info("[UserService] - User updated successfully with ID %s", userId);
      return updatedUser as UserVMType;
    } catch (error) {
      app.log.error("[UserService] - User update failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Update current user's own profile
   * @param {string} userId - The current user's ID
   * @param {Omit<UpdateUserDTO, 'type'>} data - The user data to update (excluding type)
   * @returns {Promise<UserVMType>} The updated user
   * @throws {AppError} If the user is not found or email already exists
   */
  public async updateMe(userId: string, data: Omit<UpdateUserDTO, "type">): Promise<UserVMType> {
    app.log.info("[UserService] - Starting profile update for user %s", userId);

    const { type, ...allowedData } = data as UpdateUserDTO;

    return this.updateUser(userId, allowedData);
  }

  /**
   * @description Delete a user (soft delete)
   * @param {string} userId - The user's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the user is not found
   */
  public async deleteUser(userId: string, loggedUserId: string): Promise<void> {
    app.log.info("[UserService] - Starting user deletion for user %s", userId);

    if (loggedUserId === userId) {
      throw new AppError("Você não pode se apagar", HTTP_STATUS_CODES.FORBIDDEN);
    }

    try {
      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!existingUser) {
        app.log.warn("[UserService] - User deletion failed: User %s not found", userId);
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      if (existingUser.deletedAt) {
        app.log.warn("[UserService] - User deletion failed: User %s already deleted", userId);
        throw new AppError("Usuário já foi deletado", HTTP_STATUS_CODES.BAD_REQUEST);
      }

      await this.userRepository.disableUser(userId);

      app.log.info("[UserService] - User deleted successfully with ID %s", userId);
    } catch (error) {
      app.log.error("[UserService] - User deletion failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Change user's password
   * @param {string} userId - The user's ID
   * @param {ChangePasswordDTO} data - Old and new password data
   * @returns {Promise<void>}
   * @throws {AppError} If the user is not found or old password is invalid
   */
  public async changePassword(
    userId: string,
    { oldPassword, newPassword }: ChangePasswordDTO,
    currentTokenId?: string,
  ): Promise<void> {
    app.log.info("[UserService] - Starting password change for user %s", userId);

    try {
      // Get user with password
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        app.log.warn("[UserService] - Password change failed: User %s not found", userId);
        throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
      }

      // Verify old password
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isOldPasswordValid) {
        app.log.warn(
          "[UserService] - Password change failed: Invalid old password for user %s",
          userId,
        );
        throw new AppError("Senha antiga inválida", HTTP_STATUS_CODES.UNAUTHORIZED);
      }

      if (await bcrypt.compare(newPassword, user.password)) {
        throw new AppError("A nova senha deve ser diferente da senha atual", HTTP_STATUS_CODES.BAD_REQUEST);
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

      // Update password
      await db.transaction(async (trx) => {
        await trx.update(users).set({
          password: hashedNewPassword,
          mustChangePassword: false,
        }).where(eq(users.id, userId));
        await trx.delete(userTokens).where(and(
          eq(userTokens.userId, userId),
          currentTokenId ? ne(userTokens.id, currentTokenId) : undefined,
        ));
      });

      app.log.info("[UserService] - Password changed successfully for user %s", userId);
    } catch (error) {
      app.log.error("[UserService] - Password change failed: %s", error);
      throw error;
    }
  }

  /**
   * @description Activate a user
   * @param {string} userId - The user's ID
   * @returns {Promise<void>}
   * @throws {AppError} If the user is not found
   */
  public async activateUser(userId: string): Promise<void> {
    app.log.info("[UserService] - Starting user activation for user %s", userId);

    await this.userRepository.enableUser(userId);

    app.log.info("[UserService] - User activated successfully with ID %s", userId);
  }

  public async updatePasswordAdministratively(
    adminId: string,
    userId: string,
    password: string,
  ): Promise<void> {
    if (typeof password !== "string" || password.trim().length === 0) {
      throw new AppError("Senha é obrigatória", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    if (user.deletedAt) throw new AppError("Usuário inativo", HTTP_STATUS_CODES.BAD_REQUEST);

    const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

    await db
      .update(users)
      .set({
        password: hashedPassword,
      })
      .where(eq(users.id, userId));

    app.log.info(
      {
        adminId,
        userId,
        operation: "administrative password update",
        occurredAt: new Date().toISOString(),
      },
      "[UserService] Administrative password update completed",
    );
  }
}
