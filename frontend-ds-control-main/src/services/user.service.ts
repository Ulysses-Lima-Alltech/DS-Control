import { z } from 'zod';

import { ResetPasswordSchema } from '@/schemas/auth.schema';
import {
  RegisterNewUserSchema,
  RequestResetUserPasswordByEmailSchema,
  UpdateCurrentUserSchema,
  UpdateUserByIdSchema,
} from '@/schemas/user.schema';
import { api } from '@/services/api.service';
import type { User, UserOrderBy, UserOrderType } from '@/types/user.type';

export async function getMe(): Promise<User> {
  try {
    const response = await api(`/users/me`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao buscar usuário: ${error.message}`);
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error(`[User Service] Erro ao buscar usuário: ${error}`);
    throw error;
  }
}

export type AdministrativePasswordUpdateParams = {
  userId: string;
  password: string;
};

export type AdministrativePasswordUpdateResponse = {
  message: string;
};

export async function updateAdministrativePassword({
  userId,
  password,
}: AdministrativePasswordUpdateParams): Promise<AdministrativePasswordUpdateResponse> {
  const response = await api(`/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Não foi possível alterar a senha');
  }

  return response.json();
}

export type GetAllUsersResponse = {
  data: User[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllUsersParams = {
  page?: string;
  limit?: string;
  search?: string;
  type?: 'backoffice' | 'pilot' | 'farmer';
  status?: 'active' | 'inactive' | 'all';
  orderBy?: UserOrderBy;
  orderType?: UserOrderType
};

export async function getAllUsers(params?: GetAllUsersParams): Promise<GetAllUsersResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page);
    if (params?.limit) searchParams.append('limit', params.limit);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.type) searchParams.append('type', params.type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.orderBy) searchParams.append('orderBy', params.orderBy);
    if (params?.orderType) searchParams.append('orderType', params.orderType);

    const url = `/users${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    const response = await api(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao buscar usuários: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[User Service] Erro ao buscar usuários: ${error}`);
    throw error;
  }
}

export async function getUserById(id: string): Promise<User> {
  const response = await api(`/users/${id}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[User Service] Erro ao buscar usuário: ${error.message}`);
  }

  return await response.json();
}

export type RegisterNewUserParams = z.infer<typeof RegisterNewUserSchema>;

export type RegisterNewUserResponse = {
  message: string;
};

export async function registerNewUser(
  data: RegisterNewUserParams
): Promise<RegisterNewUserResponse> {
  try {
    RegisterNewUserSchema.parse(data);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...userData } = data;

    const response = await api(`/users/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao criar usuário: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[User Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar usuário');
    }

    console.error(`[User Service] Erro ao criar usuário: ${error}`);
    throw error;
  }
}

export async function deleteUserById(userId: string): Promise<void> {
  const response = await api(`/users/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[User Service] Erro ao deletar usuário: ${error.message}`);
  }
}

export async function activateUserById(userId: string): Promise<void> {
  const response = await api(`/users/${userId}/activate`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[User Service] Erro ao ativar usuário: ${error.message}`);
  }
}

export type RequestResetUserPasswordByEmailParams = z.infer<
  typeof RequestResetUserPasswordByEmailSchema
>;

export async function requestResetUserPasswordByEmail(
  data: RequestResetUserPasswordByEmailParams
): Promise<void> {
  try {
    RequestResetUserPasswordByEmailSchema.parse(data);

    const response = await api(`/users/request-password-reset`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao solicitar redefinição de senha: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[User Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao solicitar redefinição de senha');
    }

    console.error(`[User Service] Erro ao solicitar redefinição de senha: ${error}`);
    throw error;
  }
}

export type UpdateCurrentUserParams = z.infer<typeof UpdateCurrentUserSchema>;

export type UpdateCurrentUserResponse = {
  message: string;
};

export async function updateCurrentUser(
  data: UpdateCurrentUserParams
): Promise<UpdateCurrentUserResponse> {
  try {
    UpdateCurrentUserSchema.parse(data);

    const response = await api(`/users/me`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao atualizar usuário: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[User Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar usuário');
    }

    console.error(`[User Service] Erro ao atualizar usuário: ${error}`);
    throw error;
  }
}

export type ChangeCurrentUserPasswordParams = {
  oldPassword: string;
  newPassword: string;
};

export type ChangeCurrentUserPasswordResponse = {
  message: string;
};

export async function changeCurrentUserPassword(
  data: ChangeCurrentUserPasswordParams
): Promise<ChangeCurrentUserPasswordResponse> {
  try {
    const response = await api(`/users/me/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao alterar senha: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[User Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao alterar senha');
    }

    console.error(`[User Service] Erro ao alterar senha: ${error}`);
    throw error;
  }
}

export type UpdateUserByIdParams = z.infer<typeof UpdateUserByIdSchema>;

export type UpdateUserByIdResponse = {
  message: string;
};

export async function updateUserById(
  userId: string,
  data: UpdateUserByIdParams
): Promise<UpdateUserByIdResponse> {
  try {
    const response = await api(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao atualizar usuário: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[User Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar usuário');
    }

    console.error(`[User Service] Erro ao atualizar usuário: ${error}`);
    throw error;
  }
}

export type ResetPasswordParams = z.infer<typeof ResetPasswordSchema>;

export type ResetPasswordRequestParams = {
  token: string;
  userId: string;
  password: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export async function resetPassword(
  data: ResetPasswordRequestParams
): Promise<ResetPasswordResponse> {
  try {
    const response = await api(`/users/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao redefinir senha: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[User Service] Erro ao redefinir senha: ${error}`);
    throw error;
  }
}
