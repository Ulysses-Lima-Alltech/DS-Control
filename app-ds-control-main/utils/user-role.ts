export const normalizeUserType = (userType?: string | null) => userType?.trim().toLowerCase() ?? '';

export const isAdminRole = (userType?: string | null) => {
  const normalized = normalizeUserType(userType);
  return normalized === 'admin' || normalized === 'adm';
};

export const isBackofficeRole = (userType?: string | null) =>
  normalizeUserType(userType) === 'backoffice';

export const isAdministrativeRole = (userType?: string | null) =>
  isAdminRole(userType) || isBackofficeRole(userType);

export const isFarmerRole = (userType?: string | null) => normalizeUserType(userType) === 'farmer';

export const isPilotRole = (userType?: string | null) => normalizeUserType(userType) === 'pilot';

export const getDefaultRouteByUserType = (userType?: string | null) => {
  if (isPilotRole(userType)) return '/pilot/map';
  if (isFarmerRole(userType)) return '/farmer/map';
  if (isAdministrativeRole(userType)) return '/backoffice/dashboard';

  return '/auth/login';
};

export const getUserTypeLabel = (userType?: string | null) => {
  if (isAdminRole(userType)) return 'ADM';
  if (isBackofficeRole(userType)) return 'Administrativo';
  if (isPilotRole(userType)) return 'Piloto';
  if (isFarmerRole(userType)) return 'Fazendeiro';

  return 'Usuario';
};
