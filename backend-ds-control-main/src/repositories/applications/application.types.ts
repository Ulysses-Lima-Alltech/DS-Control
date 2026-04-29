import type { OperationalDateInput } from "@common/utils/operational-date";

export type Application = {
  id: string;
  serviceOrderId: string | null;
  pilotId: string;
  assistantId: string | null;
  droneId: string;
  cultureId: string;
  hectares: string;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  date: Date;
  productId: string;
  plotId: string | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  farmId: string | null;
};

export interface CreateApplication {
  serviceOrderId?: string | null;
  pilotId: string;
  assistantId?: string;
  droneId: string;
  cultureId: string;
  hectares: string;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  date: OperationalDateInput;
  productId: string;
  plotId: string | null;
  farmId: string | null;
  observations?: string;
}

export interface UpdateApplication {
  serviceOrderId?: string;
  pilotId?: string;
  assistantId?: string;
  droneId?: string;
  cultureId?: string;
  hectares?: string;
  flowRate?: string;
  altitude?: string;
  routeSpacing?: string;
  dropletSize?: string;
  date?: OperationalDateInput;
  productId?: string;
  plotId?: string;
  farmId?: string;
  observations?: string;
}

export type ApplicationWithRelations = Application & {
  serviceOrder: {
    id: string;
    number: number;
    status: string;
  } | null;
  pilot: {
    id: string;
    name: string;
    email: string;
  };
  assistant: {
    id: string;
    name: string;
  } | null;
  drone: {
    id: string;
    name: string;
    model: string;
  };
  culture: {
    id: string;
    name: string;
    description: string | null;
  };
  product: {
    id: string;
    name: string;
  };
  plot: {
    id: string;
    name: string;
    hectare: string;
    farm: {
      id: string;
      name: string;
      customer: {
        id: string;
        name: string;
      };
    };
  } | null;
  farm: {
    id: string;
    name: string;
    customer: {
      id: string;
      name: string;
    };
  } | null;
};

export type ApplicationQueryResult = {
  id: string;
  serviceOrderId: string | null;
  pilotId: string;
  assistantId: string | null;
  droneId: string;
  cultureId: string;
  hectares: string;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  date: Date;
  productId: string;
  plotId: string | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  serviceOrder: {
    id: string;
    number: number;
    status: string;
  } | null;
  pilot: {
    id: string;
    name: string;
    email: string;
  };
  assistant: {
    id: string;
    name: string;
  } | null;
  drone: {
    id: string;
    name: string;
    model: string;
  };
  culture: {
    id: string;
    name: string;
    description: string;
  };
  product: {
    id: string;
    name: string;
  };
  plot: {
    id: string;
    name: string;
    hectare: string;
    farm: {
      id: string;
      name: string;
      customer: {
        id: string;
        name: string;
      };
    };
  } | null;
};

export type DrizzleApplicationQueryResult = {
  id: string;
  serviceOrderId: string | null;
  pilotId: string;
  assistantId: string | null;
  droneId: string;
  cultureId: string;
  hectares: string;
  flowRate: string;
  altitude: string;
  routeSpacing: string;
  dropletSize: string;
  date: Date;
  productId: string;
  plotId: string | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  farmId: string | null;
  serviceOrder?: {
    id: string;
    number: number;
    status: string;
  } | null | undefined;
  pilot: {
    id: string;
    name: string;
    email: string;
  };
  assistant?: {
    id: string;
    name: string;
  } | null | undefined;
  drone: {
    id: string;
    name: string;
    model: string;
  };
  culture: {
    id: string;
    name: string;
    description: string | null;
  };
  product: {
    id: string;
    name: string;
  };
  plot: {
    id: string;
    name: string;
    hectare: string;
    farm: {
      id: string;
      name: string;
      customer: {
        id: string;
        name: string;
      };
    };
  } | null;
  farm?: {
    id: string;
    name: string;
    customer: {
      id: string;
      name: string;
    };
  } | null | undefined;
};

export enum ApplicationOrderBy {
  DATE = 'date',
  PILOT = 'pilot',
  PRODUCT = 'product'
}

export enum ApplicationOrderType {
  ASC = 'asc',
  DESC = 'desc'
}
