import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { env } from "@config/index";
import type { FastifyReply, FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { db } from "@infra/database";
import { users, userTokens } from "@infra/database/schema";
import { and, eq, gt } from "drizzle-orm";

export async function AuthenticationJWT(
  request: FastifyRequest, 
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    const ACCESS_TOKEN_COOKIE_KEY = '@ds-drones/access_token';

    // Try to get token from Authorization header first, then from cookie
    let token: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (request.cookies && request.cookies[ACCESS_TOKEN_COOKIE_KEY]) {
      token = request.cookies[ACCESS_TOKEN_COOKIE_KEY];
    }

    if (!token) {
      const appError = new AppError('Unauthorized, no token provided', HTTP_STATUS_CODES.UNAUTHORIZED);
      return reply.status(appError.statusCode).send(appError.throw());
    }

    const { payload } = await jwtVerify(token, Buffer.from(env.ACCESS_TOKEN_SECRET), {
      algorithms: ['HS256'],
    });

    if(!payload?.userId || !payload?.email || !payload?.tokenId) {
      const appError = new AppError('Unauthorized, invalid token payload', HTTP_STATUS_CODES.UNAUTHORIZED);
      return reply.status(appError.statusCode).send(appError.throw());
    }

    const [user, storedToken] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, payload.userId as string) }),
      db.query.userTokens.findFirst({ where: and(
        eq(userTokens.id, payload.tokenId as string),
        eq(userTokens.userId, payload.userId as string),
        eq(userTokens.context, "ACCESS_TOKEN"),
        gt(userTokens.expiresAt, new Date()),
      ) }),
    ]);

    if (!user || user.deletedAt || !storedToken) {
      const appError = new AppError('Unauthorized, revoked session', HTTP_STATUS_CODES.UNAUTHORIZED);
      return reply.status(appError.statusCode).send(appError.throw());
    }

    const isPasswordChangeRoute = request.routeOptions.url === "/me/password";
    if (user.mustChangePassword && !isPasswordChangeRoute) {
      const appError = new AppError('Alteração de senha obrigatória', HTTP_STATUS_CODES.FORBIDDEN, undefined, 'PASSWORD_CHANGE_REQUIRED');
      return reply.status(appError.statusCode).send(appError.throw());
    }

    request.payload = { 
      userId: payload.userId as string,
      email: payload.email as string,
      type: user.type,
      mustChangePassword: user.mustChangePassword,
      tokenId: payload.tokenId as string,
    } 
  } catch (_) {
    const appError = new AppError('Unauthorized, invalid token', HTTP_STATUS_CODES.UNAUTHORIZED);
    return reply.status(appError.statusCode).send(appError.throw());
  }
}
