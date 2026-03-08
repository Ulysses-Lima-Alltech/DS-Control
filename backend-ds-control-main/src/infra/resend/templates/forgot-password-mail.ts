interface ForgotPasswordTemplateProps {
  userName: string;
  resetLink: string;
}

export function createForgotPasswordTemplate({
  userName,
  resetLink,
}: ForgotPasswordTemplateProps): string {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="pt-BR">
  <head>
  </head>
  <body
    style="background-color:rgb(255,255,255);margin:auto;font-family:ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';padding:0.5rem"
  >
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="border:1px solid rgb(234,234,234);border-radius:0.25rem;margin:40px auto;padding:20px;max-width:465px"
    >
      <tbody>
        <tr style="width:100%">
          <td>
            <h1
              style="color:rgb(0,0,0);font-size:24px;font-weight:400;text-align:center;margin:30px 0"
            >
              Solicitação de Redefinição de Senha
            </h1>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0"
            >
              Olá ${userName},
            </p>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0"
            >
              Recebemos uma solicitação para redefinir a senha da sua conta. Se
              você fez esta solicitação, clique no botão abaixo para criar uma nova
              senha:
            </p>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;margin:16px 0 32px"
            >
              <tbody>
                <tr>
                  <td>
                    <a
                      href="${resetLink}"
                      style="background-color:rgb(0,0,0);border-radius:0.25rem;color:rgb(255,255,255);font-size:14px;font-weight:600;text-decoration:none;text-align:center;padding:0.75rem 1.25rem;line-height:100%;display:inline-block;max-width:100%"
                      target="_blank"
                      >Redefinir Minha Senha</a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0"
            >
              Este link será válido por 15 minutos para garantir a segurança da sua conta.
            </p>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0"
            >
              Se você não solicitou uma redefinição de senha, por favor ignore este email
              ou entre em contato com nossa equipe de suporte se tiver alguma dúvida.
            </p>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0"
            >
              Se você está tendo problemas com o botão acima, copie e cole esta URL no seu navegador: ${resetLink}
            </p>
            <hr
              style="border:1px solid rgb(234,234,234);margin:26px 0;width:100%"
            />
            <p
              style="color:rgb(102,102,102);font-size:12px;line-height:24px;margin:16px 0"
            >
              Atenciosamente,<br />A Equipe DS Drones
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
  `;
}
