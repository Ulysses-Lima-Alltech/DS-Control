import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as AssistantService from '@/services/assistant.service';

export const useRegisterNewAssistant = (
  options?: UseMutationOptions<
    AssistantService.RegisterNewAssistantResponse,
    Error,
    AssistantService.RegisterNewAssistantParams
  >
) => {
  return useMutation({
    mutationFn: (data: AssistantService.RegisterNewAssistantParams) =>
      AssistantService.registerNewAssistant(data),
    ...options,
  });
};

export const useUpdateAssistantById = (
  options?: UseMutationOptions<
    AssistantService.UpdateAssistantByIdResponse,
    Error,
    AssistantService.UpdateAssistantByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: AssistantService.UpdateAssistantByIdParams) =>
      AssistantService.updateAssistantById(data),
    ...options,
  });
};

export const useDeleteAssistantById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (assistantId: string) => AssistantService.deleteAssistantById(assistantId),
    ...options,
  });
};
