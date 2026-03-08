import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as UserService from '@/services/user.service';

export const useChangeCurrentUserPassword = (
  options?: UseMutationOptions<
    UserService.ChangeCurrentUserPasswordResponse,
    Error,
    UserService.ChangeCurrentUserPasswordParams
  >
) => {
  return useMutation({
    mutationFn: (data: UserService.ChangeCurrentUserPasswordParams) =>
      UserService.changeCurrentUserPassword(data),
    ...options,
  });
};

export const useForgotPassword = (
  options?: UseMutationOptions<void, Error, UserService.ForgotPasswordParams>
) => {
  return useMutation({
    mutationFn: (data: UserService.ForgotPasswordParams) => UserService.forgotPassword(data),
    ...options,
  });
};
