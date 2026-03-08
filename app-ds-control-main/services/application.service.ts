import { z } from 'zod';

import {
  RegisterNewApplicationSchema,
  RegisterNewLooseApplicationSchema,
  UpdateApplicationByIdSchema,
  UpdateLooseApplicationSchema,
} from '@/schemas/application.schema';
import { Application, ApplicationOrderBy, ApplicationOrderType } from '@/types/applications.type';

import { api } from './api.service';

export type GetAllApplicationsParams = {
  pilotId?: string;
  customerId?: string;
  serviceOrderId?: string;
  farmId?: string;
  includePlots?: string;
  includeCustomer?: string;
  includeServiceOrder?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  orderBy?: ApplicationOrderBy;
  orderType?: ApplicationOrderType;
};

export type GetAllApplicationsResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export async function getAllApplications(
  params?: GetAllApplicationsParams
): Promise<GetAllApplicationsResponse> {
  const searchParams = new URLSearchParams();
  const toYYYYMMDD = (dateString: string) => {
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots);
  if (params?.includeCustomer) searchParams.append('includeCustomer', params.includeCustomer);
  if (params?.includeServiceOrder)
    searchParams.append('includeServiceOrder', params.includeServiceOrder);
  if (params?.startDate) searchParams.append('startDate', toYYYYMMDD(params.startDate));
  if (params?.endDate) searchParams.append('endDate', toYYYYMMDD(params.endDate));
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy);
  if (params?.orderType) searchParams.append('orderType', params.orderType);

  const url = `/applications${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações: ${error.message}`);
  }

  const data = await response.json();
  return data;
}

export type GetApplicationByIdResponse = {
  application: Application;
};

export async function getApplicationById(
  applicationId: string
): Promise<GetApplicationByIdResponse> {
  const response = await api(`/applications/${applicationId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicação: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByServiceOrderIdResponse = {
  data: Application[];
};

export type GetApplicationsByServiceOrderIdParams = {
  includeGeoJson?: string;
};

export async function getApplicationsByServiceOrderId(
  serviceOrderId: string,
  params?: GetApplicationsByServiceOrderIdParams
): Promise<GetApplicationsByServiceOrderIdResponse> {
  const searchParams = new URLSearchParams();
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);
  
  const url = `/applications/service-order/${serviceOrderId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar aplicações da ordem de serviço: ${error.message}`
    );
  }

  return await response.json();
}

export type RegisterNewApplicationParams = z.infer<typeof RegisterNewApplicationSchema>;

export type RegisterNewApplicationWithoutPlotParams = z.infer<
  typeof RegisterNewLooseApplicationSchema
>;

export type RegisterNewApplicationResponse = {
  message: string;
};

export async function registerNewApplication(
  data: RegisterNewApplicationParams
): Promise<RegisterNewApplicationResponse> {
  try {
    RegisterNewApplicationSchema.parse(data);

    const response = await api(`/applications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao criar aplicação: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar aplicação');
    }

    console.error(`[Application Service] Erro ao criar aplicação: ${error}`);
    throw error;
  }
}

export async function registerNewApplicationWithoutPlot(
  data: RegisterNewApplicationWithoutPlotParams
): Promise<RegisterNewApplicationResponse> {
  try {
    const schema = RegisterNewLooseApplicationSchema;
    schema.parse(data);

    const response = await api(`/applications`, {
      method: 'POST',
      body: JSON.stringify({ ...data }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao criar aplicação: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar aplicação');
    }

    console.error(`[Application Service] Erro ao criar aplicação: ${error}`);
    throw error;
  }
}

export type UpdateApplicationByIdParams = z.infer<typeof UpdateApplicationByIdSchema> & {
  id: string;
};

export type UpdateApplicationByIdResponse = {
  message: string;
};

export async function updateApplicationById(
  data: UpdateApplicationByIdParams
): Promise<UpdateApplicationByIdResponse> {
  try {
    UpdateApplicationByIdSchema.parse(data);

    const response = await api(`/applications/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao atualizar aplicação: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar aplicação');
    }

    console.error(`[Application Service] Erro ao atualizar aplicação: ${error}`);
    throw error;
  }
}

export type UpdateLooseApplicationByIdParams = z.infer<typeof UpdateLooseApplicationSchema> & {
  id: string;
};

export type UpdateLooseApplicationByIdResponse = {
  message: string;
};

export async function updateLooseApplicationById(
  data: UpdateLooseApplicationByIdParams
): Promise<UpdateLooseApplicationByIdResponse> {
  try {
    UpdateLooseApplicationSchema.parse(data);

    const response = await api(`/applications/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao atualizar aplicação avulsa: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar aplicação avulsa');
    }

    console.error(`[Application Service] Erro ao atualizar aplicação avulsa: ${error}`);
    throw error;
  }
}

export async function deleteApplicationById(applicationId: string): Promise<void> {
  const response = await api(`/applications/${applicationId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao deletar aplicação: ${error.message}`);
  }
}

export type GetApplicationsByPilotIdResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export async function getApplicationsByPilotId(
  pilotId: string,
  params?: GetAllApplicationsParams
): Promise<GetApplicationsByPilotIdResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);

  const url = `/applications/pilot/${pilotId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações do piloto: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByPlotIdParams = {
  plotId: string;
  page?: string;
  limit?: string;
};

export type GetApplicationsByPlotIdResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export async function getApplicationsByPlotId(
  params: GetApplicationsByPlotIdParams
): Promise<GetApplicationsByPlotIdResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page);
  if (params.limit) searchParams.append('limit', params.limit);

  const url = `/applications/plot/${params.plotId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações do plot: ${error.message}`);
  }

  return await response.json();
}
