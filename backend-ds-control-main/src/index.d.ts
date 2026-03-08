import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    payload?: {
      userId: string;
      email: string;
    }
  }
}
