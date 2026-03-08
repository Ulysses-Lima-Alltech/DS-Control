import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestResetUserPasswordByEmail } from '@/mutations/user.mutation';
import { RequestResetUserPasswordByEmailSchema } from '@/schemas/user.schema';
import { RequestResetUserPasswordByEmailParams } from '@/services/user.service';

interface FormRequestResetPasswordProps {
  emailFromUrl?: string;
}

export default function FormRequestResetPassword({
  emailFromUrl = '',
}: FormRequestResetPasswordProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestResetUserPasswordByEmailParams>({
    resolver: zodResolver(RequestResetUserPasswordByEmailSchema),
    defaultValues: {
      email: emailFromUrl,
    },
  });

  const { mutate: requestResetUserPasswordByEmail, isPending: isRequestingResetPassword } =
    useRequestResetUserPasswordByEmail({
      onSuccess: () => {
        toast('Solicitação de redefinição de senha enviada com sucesso');
        router.push('/auth/login');
      },
      onError: (error) => {
        toast(error.message);
      },
    });

  const onSubmit = (data: RequestResetUserPasswordByEmailParams) => {
    requestResetUserPasswordByEmail(data);
  };

  const handleBackToLogin = () => {
    router.push('/auth/login');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-6'>
      <div className='flex flex-col items-center text-center'>
        <h1 className='text-2xl font-bold'>Esqueceu sua senha?</h1>
        <p className='text-muted-foreground text-balance'>
          Digite o e-mail da sua conta para receber um link de redefinição de senha.
        </p>
      </div>

      <div className='grid gap-3'>
        <Label htmlFor='email'>E-mail</Label>
        <Input
          id='email'
          type='email'
          placeholder='email@example.com'
          required
          {...register('email')}
        />
        {errors.email && <p className='text-sm text-destructive'>{errors.email.message}</p>}
      </div>

      <Button type='submit' className='w-full' disabled={isRequestingResetPassword}>
        {isRequestingResetPassword ? 'Enviando solicitação...' : 'Enviar solicitação'}
      </Button>

      <Button type='button' variant='outline' className='w-full' onClick={handleBackToLogin}>
        Voltar para o Login
      </Button>
    </form>
  );
}
