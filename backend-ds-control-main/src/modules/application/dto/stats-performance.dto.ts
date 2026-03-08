import z from "zod";

export const PilotPerformanceSchema = z.object({
  avgHectaresByPilot: z.number(),
  avgDailyByPilot: z.number(),
  totalHectares: z.number(),
  comparelaLastMonth: z.array(
    z.object({
      pilotName: z.string(),
      day: z.string(),
      month: z.string(),
      applications: z.number(),
      hectares: z.number()
    })
  )
})

export type PilotPerformanceDTO = z.infer<typeof PilotPerformanceSchema>;