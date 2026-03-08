import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import type { FastifyInstance, FastifyPluginOptions, HookHandlerDoneFunction } from "fastify";
import type { FastifyZodOpenApiTypeProvider } from "fastify-zod-openapi";
import z from "zod";

export function AppRoutes(
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: HookHandlerDoneFunction,
) {
  app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      description: "Health check endpoint to monitor API status",
      summary: "Health check",
      tags: ["health"],
      response: {
        200: z.object({
          uptime: z.number().describe("The number of seconds the server has been running"),
          responseTime: z.array(z.number()).describe("High-resolution real time in [seconds, nanoseconds]"),
          timestamp: z.number().describe("Current timestamp in milliseconds since Unix epoch")
        })
      }
    },
    handler: (_, response) => {
      const healthCheck = {
        uptime: process.uptime(),
        responseTime: process.hrtime(),
        timestamp: Date.now(),
      };
      response.status(HTTP_STATUS_CODES.OK).send(healthCheck);
    },
  });

  // app.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
  //   method: "POST", 
  //   url: "/import-data",
  //   schema: {
  //     description: "Import applications data from CSV file",
  //     summary: "Import CSV data",
  //     tags: ["import"],
  //     response: {
  //       200: z.object({
  //         message: z.string(),
  //         serviceOrders: z.array(z.string()),
  //         applications: z.array(z.string()),
  //         totalServiceOrders: z.number(),
  //         totalApplications: z.number(),
  //         successfulRows: z.array(z.number()),
  //         failedRows: z.array(z.object({
  //           rowNumber: z.number(),
  //           error: z.string()
  //         })),
  //         summary: z.object({
  //           totalRowsInCsv: z.number(),
  //           successfulRowsCount: z.number(),
  //           failedRowsCount: z.number(),
  //           successRate: z.string()
  //         })
  //       }),
  //       404: z.object({
  //         error: z.string()
  //       }),
  //       500: z.object({
  //         error: z.string(),
  //         details: z.string().optional()
  //       })
  //     }
  //   },
  //   handler: async (_, response) => {
  //     try {
  //       console.log("Starting CSV import process...");
        
  //       const csvFilePath = path.join(process.cwd(), "imports", "data.csv");
        
  //       if (!fs.existsSync(csvFilePath)) {
  //         return response.status(404).send({ error: "CSV file not found" });
  //       }

  //       // Parse CSV data
  //       const csvData: any[] = [];
  //       let currentRowNumber = 1; // Start at 1 to account for header
        
  //       await new Promise((resolve, reject) => {
  //         fs.createReadStream(csvFilePath)
  //           .pipe(csv())
  //           .on('data', (row) => {
  //             currentRowNumber++;
  //             csvData.push({ ...row, __rowNumber: currentRowNumber });
  //           })
  //           .on('end', resolve)
  //           .on('error', reject);
  //       });

  //       console.log(`Parsed ${csvData.length} rows from CSV`);

  //       // Group applications by customer to create one service order per customer
  //       const applicationsByCustomer = new Map<string, any[]>();
        
  //       for (const row of csvData) {
  //         const customerId = row['Empresa (customerID)'];
  //         if (!applicationsByCustomer.has(customerId)) {
  //           applicationsByCustomer.set(customerId, []);
  //         }
  //         applicationsByCustomer.get(customerId)!.push(row);
  //       }

  //       console.log(`Found ${applicationsByCustomer.size} unique customers`);

  //       const createdServiceOrderIds: string[] = [];
  //       const createdApplicationIds: string[] = [];
  //       const successfulRows: number[] = [];
  //       const failedRows: Array<{ rowNumber: number; error: string }> = [];

  //       // Create service orders and applications for each customer
  //       for (const [customerId, applicationsData] of applicationsByCustomer) {
  //         let serviceOrderId: string | null = null;
          
  //         try {
  //           // First, create service order in its own transaction
  //           await db.transaction(async (tx) => {
  //             // Get unique farms and pilots for this customer's applications
  //             const farms = [...new Set(applicationsData.map(app => app['Selecione a Fazenda (farmId)']))].filter(Boolean);
  //             const pilots = [...new Set(applicationsData.map(app => app['Selecione o Piloto  (pilotId)']))].filter(Boolean);
              
  //             // Use the contract from the first application (assuming all have the same contract)
  //             const contractId = applicationsData[0]['Período de safra (contractId)'];
              
  //             // Create service order
  //             const [serviceOrder] = await tx
  //               .insert(serviceOrders)
  //               .values({
  //                 customerId,
  //                 contractId,
  //                 plannedDate: new Date(),
  //                 observation: "Importado da planilha",
  //                 status: 'open'
  //               })
  //               .returning();

  //             if (!serviceOrder) {
  //               throw new Error(`Failed to create service order for customer ${customerId}`);
  //             }

  //             serviceOrderId = serviceOrder.id;
  //             createdServiceOrderIds.push(serviceOrder.id);
  //             console.log(`Created service order ${serviceOrder.id} for customer ${customerId}`);

  //             // Insert service order farms associations
  //             if (farms.length > 0) {
  //               await tx.insert(serviceOrderFarms).values(
  //                 farms.map((farmId) => ({
  //                   serviceOrderId: serviceOrder.id,
  //                   farmId,
  //                 }))
  //               );
  //             }

  //             // Insert service order pilots associations
  //             if (pilots.length > 0) {
  //               await tx.insert(serviceOrderPilots).values(
  //                 pilots.map((pilotId) => ({
  //                   serviceOrderId: serviceOrder.id,
  //                   pilotId,
  //                 }))
  //               );
  //             }
  //           });

  //           // If service order was created successfully, process applications individually
  //           if (serviceOrderId) {
  //             for (const appData of applicationsData) {
  //               const rowNumber = appData.__rowNumber;
  //               try {
  //                 // Each application in its own transaction to isolate failures
  //                 await db.transaction(async (tx) => {
  //                   // Parse dates
  //                   const createdAtStr = appData['Carimbo de data/hora (createdAt)'];
  //                   const applicationDateStr = appData['Selecione o dia da aplicação: (date application)'];
                    
  //                   // Convert DD/MM/YYYY to Date
  //                   const parseDate = (dateStr: string) => {
  //                     const [day, month, year] = dateStr.split('/');
  //                     return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  //                   };

  //                   const applicationDate = parseDate(applicationDateStr);
                    
  //                   const mapName = appData['Nome do Mapa (observation) (plotId=null)'];
  //                   const observation = `Importado da planilha, Data da aplicação: ${createdAtStr}, talhão: ${mapName}`;
                    
  //                   // Create application
  //                   const [application] = await tx
  //                     .insert(applications)
  //                     .values({
  //                       serviceOrderId: serviceOrderId,
  //                       pilotId: appData['Selecione o Piloto  (pilotId)'],
  //                       assistantId: appData['Selecione o seu ajudante: (assistantId)'] || null,
  //                       droneId: appData['Qual drone utilizado?'],
  //                       cultureId: appData['Tipo de cultura (culture-typeId)'],
  //                       hectares: appData['Quantos hectares aplicados?'],
  //                       date: applicationDate,
  //                       productId: appData['Qual foi o tipo de aplicação? (productId)'],
  //                       plotId: null, // As per requirement
  //                       observations: observation
  //                     })
  //                     .returning();

  //                   if (!application) {
  //                     throw new Error(`Failed to create application for customer ${customerId} at row ${rowNumber}`);
  //                   }

  //                   createdApplicationIds.push(application.id);
  //                   successfulRows.push(rowNumber);
  //                   console.log(`Created application ${application.id} for service order ${serviceOrderId} (row ${rowNumber})`);
  //                 });
  //               } catch (error) {
  //                 const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //                 failedRows.push({ rowNumber, error: errorMessage });
  //                 console.error(`Error creating application at row ${rowNumber}:`, error);
  //                 // Don't re-throw - continue processing other applications
  //               }
  //             }
  //           }
  //         } catch (error) {
  //           // If service order creation fails, mark all rows for this customer as failed
  //           const customerRows = applicationsData.map(app => app.__rowNumber);
  //           const errorMessage = error instanceof Error ? error.message : 'Service order creation failed';
            
  //           customerRows.forEach(rowNumber => {
  //             if (!failedRows.find(fr => fr.rowNumber === rowNumber)) {
  //               failedRows.push({ rowNumber, error: `Service order creation failed: ${errorMessage}` });
  //             }
  //           });
            
  //           console.error(`Error creating service order for customer ${customerId}:`, error);
  //         }
  //       }

  //       // Generate JSON file with results
  //       const resultData = {
  //         serviceOrders: createdServiceOrderIds,
  //         applications: createdApplicationIds,
  //         totalServiceOrders: createdServiceOrderIds.length,
  //         totalApplications: createdApplicationIds.length,
  //         successfulRows: successfulRows.sort((a, b) => a - b),
  //         failedRows: failedRows.sort((a, b) => a.rowNumber - b.rowNumber),
  //         summary: {
  //           totalRowsInCsv: csvData.length,
  //           successfulRowsCount: successfulRows.length,
  //           failedRowsCount: failedRows.length,
  //           successRate: csvData.length > 0 ? ((successfulRows.length / csvData.length) * 100).toFixed(2) + '%' : '0%'
  //         },
  //         importDate: new Date().toISOString(),
  //         customersProcessed: applicationsByCustomer.size
  //       };

  //       const jsonFilePath = path.join(process.cwd(), "import-results.json");
  //       fs.writeFileSync(jsonFilePath, JSON.stringify(resultData, null, 2));

  //       console.log(`Import completed! Created ${createdServiceOrderIds.length} service orders and ${createdApplicationIds.length} applications`);
  //       console.log(`Success rate: ${resultData.summary.successRate} (${successfulRows.length}/${csvData.length} rows)`);
  //       if (failedRows.length > 0) {
  //         console.log(`Failed rows: ${failedRows.map(fr => `${fr.rowNumber} (${fr.error})`).join(', ')}`);
  //       }
        
  //       return response.status(HTTP_STATUS_CODES.OK).send({
  //         message: `Import completed! Created ${createdServiceOrderIds.length} service orders and ${createdApplicationIds.length} applications. Success rate: ${resultData.summary.successRate}`,
  //         serviceOrders: createdServiceOrderIds,
  //         applications: createdApplicationIds,
  //         totalServiceOrders: createdServiceOrderIds.length,
  //         totalApplications: createdApplicationIds.length,
  //         successfulRows: successfulRows.sort((a, b) => a - b),
  //         failedRows: failedRows.sort((a, b) => a.rowNumber - b.rowNumber),
  //         summary: resultData.summary
  //       });

  //     } catch (error) {
  //       console.error("Error during import:", error);
  //       return response.status(500).send({ 
  //         error: "Failed to import data", 
  //         details: error instanceof Error ? error.message : "Unknown error" 
  //       });
  //     }
  //   }
  // })

  done();
}
