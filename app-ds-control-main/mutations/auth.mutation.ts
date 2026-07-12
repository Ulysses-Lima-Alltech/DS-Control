import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as AuthService from '@/services/auth.service';

export const useLogin = (options?: UseMutationOptions<{ mustChangePassword: boolean }, Error, AuthService.LoginParams>) => {
  return useMutation({
    mutationFn: (data: AuthService.LoginParams) => AuthService.login(data),
    ...options,
  });
};

export const useLogout = (options?: UseMutationOptions<void, Error, void>) => {
  return useMutation({
    mutationFn: () => AuthService.logout(),
    ...options,
  });
};
