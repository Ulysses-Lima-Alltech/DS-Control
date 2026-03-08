import type { FastifyReply, FastifyRequest } from "fastify";
import type { LoginWithEmailAndPasswordDTO } from "./dto/login-with-email-and-password.dto";

import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { app } from "@modules/app/app.module";
import { AuthenticationService } from "./authentication.service";

export class AuthenticationController { 
  private static readonly ACCESS_TOKEN_COOKIE_KEY = '@ds-drones/access_token';
  private static readonly REFRESH_TOKEN_COOKIE_KEY = '@ds-drones/refresh_token';
  private static readonly COOKIE_OPTIONS = {
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'lax' as const,
  };
  private service: AuthenticationService;

  constructor() {
    this.service = new AuthenticationService();
  }

  public loginWithEmailAndPassword = async (request: FastifyRequest<{ Body: LoginWithEmailAndPasswordDTO }>, reply: FastifyReply) => {
    try {
      app.log.info("[AuthenticationController] - Starting login attempt for email %s", request.body.email);
      const { accessToken, refreshToken } = await this.service.loginWithEmailAndPassword(request.body);

      app.log.info("[AuthenticationController] - Login successful for email %s", request.body.email);
      return reply.status(200)
        .setCookie(AuthenticationController.ACCESS_TOKEN_COOKIE_KEY, accessToken, {
          ...AuthenticationController.COOKIE_OPTIONS,
          maxAge: 8 * 60 * 60 * 1000, // 8 hours
        })
        .setCookie(AuthenticationController.REFRESH_TOKEN_COOKIE_KEY, refreshToken, {
          ...AuthenticationController.COOKIE_OPTIONS,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .send({ 
          accessToken, // Keep for backwards compatibility
        });

    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AuthenticationController] - Login failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AuthenticationController] - Unexpected error during login: %s", error);
      reply.status(500).send(new AppError('Internal server error', 500, error as Error).throw());
    }
  }

  public refreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      app.log.info("[AuthenticationController] - Starting token refresh");
      const refreshToken = request.cookies[AuthenticationController.REFRESH_TOKEN_COOKIE_KEY]

      if(!refreshToken) {
        app.log.warn("[AuthenticationController] - Token refresh failed: No refresh token provided");
        throw new AppError('Invalid or expired token', HTTP_STATUS_CODES.FORBIDDEN);
      }

      const { accessToken, refreshToken: newRefreshToken } = await this.service.refreshToken(refreshToken);
 
      app.log.info("[AuthenticationController] - Token refresh successful");
      return reply.status(200)
        .setCookie(AuthenticationController.ACCESS_TOKEN_COOKIE_KEY, accessToken, {
          ...AuthenticationController.COOKIE_OPTIONS,
          maxAge: 8 * 60 * 60 * 1000, // 8 hours
        })
        .setCookie(AuthenticationController.REFRESH_TOKEN_COOKIE_KEY, newRefreshToken, {
          ...AuthenticationController.COOKIE_OPTIONS,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .send({ accessToken }); // Keep for backwards compatibility
     } catch (error) {      
       if (error instanceof AppError) {
         app.log.warn("[AuthenticationController] - Token refresh failed: %s", error.message);
         reply.status(error.statusCode).send(error.throw());
         return;
       }
 
       app.log.error("[AuthenticationController] - Unexpected error during token refresh: %s", error);
       reply.status(500).send(new AppError('Internal server error', 500, error as Error).throw());
     }
  }

  public logout = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      app.log.info("[AuthenticationController] - Starting logout process");
      const refreshToken = request.cookies[AuthenticationController.REFRESH_TOKEN_COOKIE_KEY];

      if (!refreshToken) {
        app.log.warn("[AuthenticationController] - Logout failed: No refresh token provided");
        throw new AppError('Refresh token is required', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      await this.service.logout(refreshToken);

      app.log.info("[AuthenticationController] - Logout successful");
      return reply.status(200)
        .clearCookie(AuthenticationController.ACCESS_TOKEN_COOKIE_KEY, {
          path: '/',
          httpOnly: true,
          secure: false,
        })
        .clearCookie(AuthenticationController.REFRESH_TOKEN_COOKIE_KEY, {
          path: '/',
          httpOnly: true,
          secure: false,
        })
        .send({ message: 'Logged out successfully' });
    } catch (error) {
      if (error instanceof AppError) {
        app.log.warn("[AuthenticationController] - Logout failed: %s", error.message);
        reply.status(error.statusCode).send(error.throw());
        return;
      }

      app.log.error("[AuthenticationController] - Unexpected error during logout: %s", error);
      reply.status(500).send(new AppError('Internal server error', 500, error as Error).throw());
    }
  }
}