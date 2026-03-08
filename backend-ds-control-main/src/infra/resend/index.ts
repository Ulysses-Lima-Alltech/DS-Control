import { env } from '@config/index';
import { Resend } from 'resend';


let resend: Resend;

(async () => {
  resend = new Resend(env.RESEND_API_KEY);
})();

export { resend };
