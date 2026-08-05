import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    payload?: {
      userId: string;
      email: string;
      type: 'backoffice' | 'pilot' | 'farmer';
      customerId: string | null;
      mustChangePassword: boolean;
      tokenId: string;
    }
  }
}
