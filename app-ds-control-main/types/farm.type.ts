import { Plot } from '@/types/plot.type';

export type Farm = {
  id: string;
  name: string;
  mapColor?: string | null;
  customer: {
    id: string;
    name: string;
  };
  plots: Plot[];
  createdAt: string;
  updatedAt: string;
};
