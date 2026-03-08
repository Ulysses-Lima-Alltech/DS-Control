export type Drone = {
  id: string;
  name: string;
  model: string;
  aircraftRid: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
};

export interface CreateDrone {
  name: string;
  model: string;
  aircraftRid: string;
} 