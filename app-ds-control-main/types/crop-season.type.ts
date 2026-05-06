export type CropSeasonProduct = {
  id: string;
  name: string;
};

export type CropSeason = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  products: CropSeasonProduct[];
};
