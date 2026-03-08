export interface DronesOperationDTO {
    avgHectareByDrones: number;
    avgDailyByDrones: number;
    totalHectares: number;
    compareLastMonth: { droneName: string, droneRID: String, month: string, applications: number, hectares: number}[];
}