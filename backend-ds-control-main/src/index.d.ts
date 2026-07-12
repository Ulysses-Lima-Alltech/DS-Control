import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    payload?: {
      userId: string;
      email: string;
      type: 'backoffice' | 'pilot' | 'farmer';
      mustChangePassword: boolean;
      tokenId: string;
    }
  }
}
