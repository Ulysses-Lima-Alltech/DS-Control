import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { env } from "@config/index";
import type { FastifyReply, FastifyRequest } from "fastify";
import { jwtVerify } from "jose";

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

    if(!payload?.userId || !payload?.email) {
      const appError = new AppError('Unauthorized, invalid token payload', HTTP_STATUS_CODES.UNAUTHORIZED);
      return reply.status(appError.statusCode).send(appError.throw());
    }

    request.payload = { 
      userId: payload.userId as string,
      email: payload.email as string,
    } 
  } catch (_) {
    const appError = new AppError('Unauthorized, invalid token', HTTP_STATUS_CODES.UNAUTHORIZED);
    return reply.status(appError.statusCode).send(appError.throw());
  }
}