export type Contract = {
  id: string;
  customerId: string;
  name: string;
  dateStart: Date;
  dateEnd: Date;
  observation: string;
  customer: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
};
