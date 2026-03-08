import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as UserService from '@/services/user.service';

export const useRegisterNewUser = (
  options?: UseMutationOptions<
    UserService.RegisterNewUserResponse,
    Error,
    UserService.RegisterNewUserParams
  >
) => {
  return useMutation({
    mutationFn: (data: UserService.RegisterNewUserParams) => UserService.registerNewUser(data),
    ...options,
  });
};

export const useDeleteUserById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (userId: string) => UserService.deleteUserById(userId),
    ...options,
  });
};

export const useRequestResetUserPasswordByEmail = (
  options?: UseMutationOptions<void, Error, UserService.RequestResetUserPasswordByEmailParams>
) => {
  return useMutation({
    mutationFn: (data: UserService.RequestResetUserPasswordByEmailParams) =>
      UserService.requestResetUserPasswordByEmail(data),
    ...options,
  });
};

export const useResetPassword = (
  options?: UseMutationOptions<
    UserService.ResetPasswordResponse,
    Error,
    UserService.ResetPasswordRequestParams
  >
) => {
  return useMutation({
    mutationFn: (data: UserService.ResetPasswordRequestParams) => UserService.resetPassword(data),
    ...options,
  });
};

export const useUpdateCurrentUser = (
  options?: UseMutationOptions<
    UserService.UpdateCurrentUserResponse,
    Error,
    UserService.UpdateCurrentUserParams
  >
) => {
  return useMutation({
    mutationFn: (data: UserService.UpdateCurrentUserParams) => UserService.updateCurrentUser(data),
    ...options,
  });
};

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

export const useUpdateUserById = (
  options?: UseMutationOptions<
    UserService.UpdateUserByIdResponse,
    Error,
    { userId: string; data: UserService.UpdateUserByIdParams }
  >
) => {
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UserService.UpdateUserByIdParams }) =>
      UserService.updateUserById(userId, data),
    ...options,
  });
};
