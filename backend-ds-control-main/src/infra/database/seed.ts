import "dotenv/config";

import { env } from "@config/index";
import { app } from "@modules/app/app.module";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { fazendaAcude } from "./mock/seed-fazenda-acude";
import { fazendaGaipora } from "./mock/seed-fazenda-gaipora";
import { fazendaNovoMundo } from "./mock/seed-fazenda-novo-mundo";
import * as schema from "./schema";
import { assistants, contracts, cultureTypes, customers, farms, plots, products, users } from "./schema";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  type: "backoffice" | "pilot" | "farmer";
  customerId?: string;
  customerName?: string;
}

interface SeedCustomer {
  cnpj: string;
  phone: string;
  name: string;
  razaoSocial: string;
  document_number: string;
  entity_type: "PF" | "PJ";
}

interface SeedFarm {
  name: string;
  customerId: string;
}

interface SeedPlot {
  name: string;
  farmId: string;
  customerId: string;
  geoJson: object;
  externalId: string;
  hectare: string;
}

interface SeedContract {
  name: string;
  customerId: string;
  dateStart: Date;
  dateEnd: Date;
  observation: string;
}

interface SeedAssistant {
  name: string;
}

interface SeedProduct {
  name: string;
}

interface SeedCultureType {
  name: string;
  description: string;
}

interface SeedDrone {
  name: string;
  model: string;
  aircraftRid: string;
}

const seedUsers: SeedUser[] = [
  {
    name: "Admin User",
    email: "admin@dsc.com",
    password: "admin_fq}Cp<.v;H~y(-}xAd`8",
    type: "backoffice",
  },
  {
    name: "John Pilot",
    email: "pilot@dsc.com", 
    password: "fq}Cp<.v;H~y(-}xAd`8",
    type: "pilot",
  },
  {
    name: "Fazenda Gaipara Manager",
    email: "gaipara@dsc.com",
    password: "fq}Cp<.v;H~y(-}xAd`8", 
    type: "farmer",
    customerName: "Agro DS Control",
  },
  {
    name: "Fazenda Açude Manager",
    email: "acude@dsc.com",
    password: "fq}Cp<.v;H~y(-}xAd`8", 
    type: "farmer",
    customerName: "Cooperativa Tecnológica",
  },
  {
    name: "Mundo Novo Manager",
    email: "mundonovo@dsc.com",
    password: "fq}Cp<.v;H~y(-}xAd`8", 
    type: "farmer",
    customerName: "Agropecuária Moderna",
  },
  {
    name: "Demo Backoffice",
    email: "demo@dsc.com",
    password: "fq}Cp<.v;H~y(-}xAd`8",
    type: "backoffice",
  },
];

const seedCustomers: SeedCustomer[] = [
  {
    cnpj: "12345678000195",
    phone: "+5511987654321",
    name: "Agro DS Control",
    razaoSocial: "Agro DS Control Tecnologia Agrícola Ltda",
    document_number: "12345678900123",
    entity_type: "PJ",
  },
  {
    cnpj: "98765432000123",
    phone: "+5511912345678",
    name: "Cooperativa Tecnológica",
    razaoSocial: "Cooperativa Tecnológica de Agricultura de Precisão",
    document_number: "12345678900123",
    entity_type: "PJ",
  },
  {
    cnpj: "11122233000144",
    phone: "+5511999887766",
    name: "Agropecuária Moderna",
    razaoSocial: "Agropecuária Moderna Sustentável Ltda",
    document_number: "12345678900",
    entity_type: "PF",
  },
];

const seedContracts: SeedContract[] = [
  {
    name: "Contrato de Aplicação Agrícola 2024 - Agro DS Control",
    customerId: "", // Will be set based on customer lookup
    dateStart: new Date("2024-01-01"),
    dateEnd: new Date("2024-12-31"),
    observation: "Contrato anual para serviços de aplicação de defensivos agrícolas com drones em toda a propriedade da Agro DS Control.",
  },
  {
    name: "Contrato de Monitoramento 2024 - Cooperativa Tecnológica",
    customerId: "", // Will be set based on customer lookup
    dateStart: new Date("2024-03-01"),
    dateEnd: new Date("2025-02-28"),
    observation: "Contrato de monitoramento de safra e mapeamento de áreas produtivas utilizando tecnologia de drones e sensoriamento remoto.",
  },
  {
    name: "Contrato de Pulverização Sazonal - Agropecuária Moderna",
    customerId: "", // Will be set based on customer lookup
    dateStart: new Date("2024-06-01"),
    dateEnd: new Date("2024-11-30"),
    observation: "Contrato para aplicação sazonal de insumos agrícolas durante o período de plantio e crescimento das culturas de soja e milho.",
  },
];

const seedAssistants: SeedAssistant[] = [
  {
    name: "Jake",
  },
  {
    name: "Alan",
  },
  {
    name: "Charles",
  },
  {
    name: "David",
  },
  {
    name: "Ethan",
  },
  {
    name: "Frank",
  },
  {
    name: "George",
  },
  {
    name: "Henry",
  },
];

const seedProducts: SeedProduct[] = [
  {
    name: "Herbicide Glyphosate 480",
  },
  {
    name: "Insecticide Lambda-Cyhalothrin",
  },
  {
    name: "Fungicide Trifloxystrobin",
  },
  {
    name: "Fertilizer NPK 20-10-20",
  },
  {
    name: "Growth Regulator Paclobutrazol",
  },
  {
    name: "Adjuvant Surfactant",
  },
  {
    name: "Bio-Stimulant Amino Acids",
  },
  {
    name: "Micronutrient Zinc Sulfate",
  },
  {
    name: "Soil Conditioner Calcium Carbonate",
  },
  {
    name: "Seed Treatment Thiamethoxam",
  },
];

const seedCultureTypes: SeedCultureType[] = [
  {
    name: "Soybean",
    description: "High protein legume crop primarily used for oil production and animal feed",
  },
  {
    name: "Corn",
    description: "Cereal grain crop used for food, feed, and industrial applications",
  },
  {
    name: "Cotton",
    description: "Fiber crop used primarily for textile production",
  },
  {
    name: "Rice",
    description: "Staple cereal grain crop grown in flooded fields",
  },
  {
    name: "Wheat",
    description: "Cereal grain used for flour production and food manufacturing",
  },
  {
    name: "Sugar Cane",
    description: "Tall perennial grass used for sugar and ethanol production",
  },
  {
    name: "Coffee",
    description: "Tropical crop grown for coffee bean production",
  },
  {
    name: "Citrus",
    description: "Fruit trees including oranges, lemons, and grapefruits",
  },
];

const seedDrones: SeedDrone[] = [
  {
    name: "Phoenix-01",
    model: "DJI Agras T40",
    aircraftRid: "RID-PHX001-2024",
  },
  {
    name: "Eagle-02",
    model: "DJI Agras T30",
    aircraftRid: "RID-EGL002-2024",
  },
  {
    name: "Falcon-03",
    model: "XAG P100 Pro",
    aircraftRid: "RID-FLC003-2024",
  },
  {
    name: "Hawk-04",
    model: "DJI Agras T40",
    aircraftRid: "RID-HWK004-2024",
  },
  {
    name: "Thunder-05",
    model: "Yamaha RMAX",
    aircraftRid: "RID-THD005-2024",
  },
  {
    name: "Storm-06",
    model: "XAG P80",
    aircraftRid: "RID-STM006-2024",
  },
  {
    name: "Lightning-07",
    model: "DJI Agras T30",
    aircraftRid: "RID-LTG007-2024",
  },
  {
    name: "Tornado-08",
    model: "Eavision EA-30X",
    aircraftRid: "RID-TRN008-2024",
  },
];

async function seedDatabase() {
  app.log.info("Starting database seeding...");

  // Initialize database connection
  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    // Connect to database
    await client.connect();
    const db = drizzle(client, { 
      schema,
      logger: env.NODE_ENV === 'development',
    });

    // Check if users already exist
    const existingUsers = await db.query.users.findMany();
    
    if (existingUsers.length === 0) {
      // Hash passwords and prepare user data
      const hashedUsers = await Promise.all(
        seedUsers.map(async (user) => ({
          ...user,
          password: await bcrypt.hash(user.password, Number(env.BCRYPT_SALT_ROUNDS)),
        }))
      );

      // Insert users
      await db.insert(users).values(hashedUsers);

      app.log.info(`Successfully seeded ${seedUsers.length} users:`);
      for (const user of seedUsers) {
        app.log.info(`   - ${user.name} (${user.email}) - ${user.type}`);
      }
    } else {
      app.log.info("Database already contains users. Skipping user seeding.");
    }

    // Check if customers already exist
    const existingCustomers = await db.query.customers.findMany();
    
    if (existingCustomers.length === 0) {
      // Insert customers
      await db.insert(customers).values(seedCustomers);

      app.log.info(`Successfully seeded ${seedCustomers.length} customers:`);
      for (const customer of seedCustomers) {
        app.log.info(`   - ${customer.name} (CNPJ: ${customer.cnpj})`);
      }
    } else {
      app.log.info("Database already contains customers. Skipping customer seeding.");
    }

    // Get customer IDs for farms seeding
    const customerRecords = await db.query.customers.findMany();
    
    // Check if farms already exist
    const existingFarms = await db.query.farms.findMany();
    
    if (existingFarms.length === 0 && customerRecords.length > 0) {
      // Create seed farms data based on real cURL data
      const seedFarms: SeedFarm[] = [
        {
          name: "Gerado-Gaipara",
          customerId: customerRecords[0].id,
        },
        {
          name: "Gerado-Açude",
          customerId: customerRecords[1].id,
        },
        {
          name: "Gerada - Fazenda Mundo Novo",
          customerId: customerRecords[2].id,
        },
      ];

      // Insert farms
      await db.insert(farms).values(seedFarms);

      app.log.info(`Successfully seeded ${seedFarms.length} farms:`);
      for (const farm of seedFarms) {
        app.log.info(`   - ${farm.name}`);
      }
    } else {
      app.log.info("Database already contains farms or no customers found. Skipping farm seeding.");
    }

    // Get farm IDs for plots seeding
    const farmRecords = await db.query.farms.findMany();
    
    // Check if plots already exist
    const existingPlots = await db.query.plots.findMany();
    
    if (existingPlots.length === 0 && farmRecords.length > 0) {
      // Create seed plots data based on real cURL data arrays
      const seedPlots: SeedPlot[] = [];

      // Find farms by name and map plots to them
      const gaiparaFarm = farmRecords.find(farm => farm.name === "Gerado-Gaipara");
      const acudeFarm = farmRecords.find(farm => farm.name === "Gerado-Açude");
      const mundoNovoFarm = farmRecords.find(farm => farm.name === "Gerada - Fazenda Mundo Novo");

      // Add Gerado-Gaipara plots
      if (gaiparaFarm) {
        for (const plot of fazendaGaipora) {
          seedPlots.push({
            name: plot.name,
            farmId: gaiparaFarm.id,
            customerId: gaiparaFarm.customerId,
            geoJson: plot.geoJson,
            externalId: plot.externalId,
            hectare: plot.hectare,
          });
        }
      }

      // Add Gerado-Açude plots
      if (acudeFarm) {
        for (const plot of fazendaAcude) {
          seedPlots.push({
            name: plot.name,
            farmId: acudeFarm.id,
            customerId: acudeFarm.customerId,
            geoJson: plot.geoJson,
            externalId: plot.externalId,
            hectare: plot.hectare,
          });
        }
      }

      // Add Fazenda Mundo Novo plots
      if (mundoNovoFarm) {
        for (const plot of fazendaNovoMundo) {
          seedPlots.push({
            name: plot.name,
            farmId: mundoNovoFarm.id,
            customerId: mundoNovoFarm.customerId,
            geoJson: plot.geoJson,
            externalId: plot.externalId,
            hectare: plot.hectare,
          });
        }
      }

      // Insert plots
      await db.insert(plots).values(seedPlots);

      app.log.info(`Successfully seeded ${seedPlots.length} plots:`);
      for (const plot of seedPlots) {
        app.log.info(`   - ${plot.name}`);
      }
    } else {
      app.log.info("Database already contains plots or no farms found. Skipping plot seeding.");
    }

    // Check if contracts already exist
    const existingContracts = await db.query.contracts.findMany();
    
    if (existingContracts.length === 0 && customerRecords.length > 0) {
      // Map contracts to customers
      const contractsWithCustomerIds = seedContracts.map((contract, index) => ({
        name: contract.name,
        customerId: customerRecords[index % customerRecords.length].id,
        date_start: contract.dateStart,
        date_end: contract.dateEnd,
        observation: contract.observation,
      }));

      // Insert contracts
      await db.insert(contracts).values(contractsWithCustomerIds);

      app.log.info(`Successfully seeded ${contractsWithCustomerIds.length} contracts:`);
      for (const contract of contractsWithCustomerIds) {
        app.log.info(`   - ${contract.name}`);
      }
    } else {
      app.log.info("Database already contains contracts or no customers found. Skipping contract seeding.");
    }

    // Check if assistants already exist
    const existingAssistants = await db.query.assistants.findMany();
    
    if (existingAssistants.length === 0) {
      // Insert assistants
      await db.insert(assistants).values(seedAssistants);

      app.log.info(`Successfully seeded ${seedAssistants.length} assistants:`);
      for (const assistant of seedAssistants) {
        app.log.info(`   - ${assistant.name}`);
      }
    } else {
      app.log.info("Database already contains assistants. Skipping assistant seeding.");
    }

    // Check if products already exist
    const existingProducts = await db.query.products.findMany();
    
    if (existingProducts.length === 0) {
      // Insert products
      await db.insert(products).values(seedProducts);

      app.log.info(`Successfully seeded ${seedProducts.length} products:`);
      for (const product of seedProducts) {
        app.log.info(`   - ${product.name}`);
      }
    } else {
      app.log.info("Database already contains products. Skipping product seeding.");
    }

    // Check if culture types already exist
    const existingCultureTypes = await db.query.cultureTypes.findMany();
    
    if (existingCultureTypes.length === 0) {
      // Insert culture types
      await db.insert(cultureTypes).values(seedCultureTypes);

      app.log.info(`Successfully seeded ${seedCultureTypes.length} culture types:`);
      for (const cultureType of seedCultureTypes) {
        app.log.info(`   - ${cultureType.name}: ${cultureType.description}`);
      }
    } else {
      app.log.info("Database already contains culture types. Skipping culture type seeding.");
    }

    // Check if drones already exist
    const existingDrones = await db.select().from(schema.drones);
    
    if (existingDrones.length === 0) {
      // Insert drones
      await db.insert(schema.drones).values(seedDrones);

      app.log.info(`Successfully seeded ${seedDrones.length} drones:`);
      for (const drone of seedDrones) {
        app.log.info(`   - ${drone.name} (${drone.model}) - RID: ${drone.aircraftRid}`);
      }
    } else {
      app.log.info("Database already contains drones. Skipping drone seeding.");
    }

  } catch (error) {
    app.log.error("Error seeding database:", error);
    throw error;
  } finally {
    // Always close the connection
    await client.end();
  }
}

// Export the seed function
export { seedDatabase };

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      app.log.info("Database seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      app.log.error("Database seeding failed: %s", error);
      process.exit(1);
    });
} 