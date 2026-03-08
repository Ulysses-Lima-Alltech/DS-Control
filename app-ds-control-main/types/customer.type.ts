export type Customer = {
  id: string;
  cnpj: string;
  phone: string;
  name: string;
  razaoSocial: string;
  createdAt: Date;
  updatedAt: Date;
};

export const CustomerTypeTranslation: Record<string, string> = {
  name: 'Nome',
  razaoSocial: 'Razão Social',
  phone: 'Telefone',
  createdAt: 'Data de Criação',
  cnpj: 'CNPJ',
};
