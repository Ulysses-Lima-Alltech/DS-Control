import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { convertToMilliseconds } from "@common/utils/convert-to-ms";
import { generateUUID } from "@common/utils/generate-uuid";
import { env } from "@config/index";
import { db } from "@infra/database";
import { userTokens } from "@infra/database/schema/user-tokens.schema";
import { users } from "@infra/database/schema/user.schema";
import { app } from "@modules/app/app.module";
import bcrypt from "bcrypt";
import { and, eq, lt, or } from "drizzle-orm";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { LoginWithEmailAndPasswordDTO } from "./dto/login-with-email-and-password.dto";

type TokenPayload = {
  email: string;
  userId: string;
  tokenId: string;
} & JWTPayload;

export class AuthenticationService {
  private static readonly ACCESS_TOKEN_EXPIRATION = "8h";
  private static readonly REFRESH_TOKEN_EXPIRATION = "7d";

  /**
   * @description Login with email and password
   * @param {LoginWithEmailAndPasswordDTO} data - The user's email and password
   * @returns {Promise<{ accessToken: string, refreshToken: string }>} The generated tokens
   */
  public async loginWithEmailAndPassword({
    email,
    password,
  }: LoginWithEmailAndPasswordDTO): Promise<{ accessToken: string; refreshToken: string; mustChangePassword: boolean }> {
    app.log.info("[AuthenticationService] - Starting login attempt for email %s", email);

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        app.log.warn(
          "[AuthenticationService] - Login attempt failed: Invalid credentials for email %s",
          email,
        );
        throw new AppError("Credenciais inválidas", HTTP_STATUS_CODES.FORBIDDEN);
      }

      if (user.deletedAt) {
        app.log.warn(
          "[AuthenticationService] - Login attempt failed: User %s is disabled",
          user.id,
        );
        throw new AppError("O usuário está desabilitado", HTTP_STATUS_CODES.FORBIDDEN);
      }

      const isEqualPasswords = await bcrypt.compare(password, user.password);

      if (!isEqualPasswords) {
        app.log.warn(
          "[AuthenticationService] - Login attempt failed: Invalid password for email %s",
          email,
        );
        throw new AppError("Credencias inválidas", HTTP_STATUS_CODES.FORBIDDEN);
      }

      const { accessToken, refreshToken } = await this.generateTokenPairs(user.id, user.email);

      app.log.info("[AuthenticationService] - Login successful for user %s", user.id);

      return {
        accessToken,
        refreshToken,
        mustChangePassword: user.mustChangePassword,
      };
    } catch (error: unknown) {
      app.log.error("[AuthenticationService] - Error during login process: %s", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Internal server error", HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * @description Logout a user
   * @param {string} refreshToken - The user's refresh token
   */
  public async logout(refreshToken: string) {
    app.log.info("[AuthenticationService] - Processing logout request");

    const payload = await this.verifyToken(refreshToken, env.REFRESH_TOKEN_SECRET);

    if (!payload?.userId || !payload?.email || !payload?.tokenId) {
      app.log.warn("[AuthenticationService] - Logout failed: Invalid token provided");
      throw new AppError("Token inválido ou expirado", HTTP_STATUS_CODES.FORBIDDEN);
    }

    const { tokenId } = payload;

    await db.delete(userTokens).where(eq(userTokens.id, tokenId as string));
    app.log.info("[AuthenticationService] - User successfully logged out");
  }

  /**
   * @description Refresh a token
   * @param {string} token - The token to refresh
   * @returns {Promise<{ accessToken: string, refreshToken: string }>} The new tokens
   */
  public async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    app.log.info("[AuthenticationService] - Starting token refresh process");

    const payload = await this.verifyToken(token, env.REFRESH_TOKEN_SECRET);

    if (!payload || !payload.userId || !payload.email || !payload.tokenId) {
      app.log.warn("[AuthenticationService] - Token refresh failed: Invalid token");
      throw new AppError("Token inválido ou expirado", HTTP_STATUS_CODES.FORBIDDEN);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId as string),
    });

    if (!user) {
      app.log.warn(
        "[AuthenticationService] - Token refresh failed: User %s not found",
        payload.userId,
      );
      throw new AppError("Usuário não encontrado", HTTP_STATUS_CODES.FORBIDDEN);
    }

    if (user.deletedAt) {
      app.log.warn("[AuthenticationService] - Token refresh failed: User %s is disabled", user.id);
      throw new AppError("O usuário está desabilitado", HTTP_STATUS_CODES.FORBIDDEN);
    }

    const { email, userId, tokenId } = payload as TokenPayload;
    const { accessToken, refreshToken } = await this.generateTokenPairs(userId, email);

    await db
      .delete(userTokens)
      .where(
        or(
          eq(userTokens.id, tokenId),
          and(eq(userTokens.context, "ACCESS_TOKEN"), lt(userTokens.expiresAt, new Date())),
        ),
      )

    app.log.info("[AuthenticationService] - Token refresh successful for user %s", userId);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * @description Verify a token
   * @param {string} token - The token to verify
   * @param {string} secret - The secret key to verify the token
   * @returns {Promise<JWTPayload | null>} The payload of the token
   */
  private async verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, Buffer.from(secret), {
        algorithms: ["HS256"],
      });
      return payload;
    } catch (err: unknown) {
      app.log.error("[AuthenticationService] - Token verification failed: %s", err);
      return null;
    }
  }

  /**
   * @description Generate a token pair for a user
   * @param {string} userId - The user's ID
   * @param {string} email - The user's email
   * @returns {Promise<{ accessToken: string, refreshToken: string }>} The generated tokens
   */
  private async generateTokenPairs(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      email,
      userId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateToken(
        userId,
        payload,
        env.ACCESS_TOKEN_SECRET,
        AuthenticationService.ACCESS_TOKEN_EXPIRATION,
        "ACCESS_TOKEN",
      ),
      this.generateToken(
        userId,
        payload,
        env.REFRESH_TOKEN_SECRET,
        AuthenticationService.REFRESH_TOKEN_EXPIRATION,
        "REFRESH_TOKEN",
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * @description Generate a token for a user
   * @param {string} userId - The user's ID
   * @param {JWTPayload} payload - The payload to be signed
   * @param {string} secret - The secret key to sign the token
   * @param {string} expiresIn - The expiration time of the token
   * @param {string} context - The context of the token
   * @returns {Promise<string>} The generated token
   */
  private async generateToken(
    userId: string,
    payload: JWTPayload,
    secret: string,
    expiresIn: string,
    context: "ACCESS_TOKEN" | "REFRESH_TOKEN",
  ): Promise<string> {
    const tokenId = generateUUID();

    const jwt = await new SignJWT({ ...payload, tokenId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expiresIn)
      .sign(Buffer.from(secret));

    const hashedToken = await bcrypt.hash(jwt, env.BCRYPT_SALT_ROUNDS);

    await db.insert(userTokens).values({
      userId,
      context,
      token: hashedToken,
      expiresAt: new Date(Date.now() + convertToMilliseconds(expiresIn)),
    });

    return jwt;
  }
}
