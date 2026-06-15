const fs = require("fs");
const path = require("path");

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;

  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function ensureInsideDirectory(targetPath, parentDir) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedParent = path.resolve(parentDir);
  const relative = path.relative(resolvedParent, resolvedTarget);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Caminho fora do diretorio esperado: ${resolvedTarget}`);
  }
}

function cleanApplicationsDir(applicationsDir, osOutputDir) {
  ensureInsideDirectory(applicationsDir, osOutputDir);

  fs.rmSync(applicationsDir, { recursive: true, force: true });
  fs.mkdirSync(applicationsDir, { recursive: true });
}

function isApprovedApplication(application) {
  return (
    application.imageScope === "application" &&
    ["high_confidence", "exact_application"].includes(application.matchType) &&
    application.reviewRequired === false &&
    application.reviewStatus === "approved" &&
    Boolean(application.primaryImagePath) &&
    fs.existsSync(application.primaryImagePath) &&
    fs.statSync(application.primaryImagePath).isFile()
  );
}

function buildFrontendApplication(application, osNumber) {
  return {
    applicationId: application.applicationId,
    imageUrl: `/dji-reports/os-${osNumber}/applications/${application.applicationId}.png`,
    imageScope: "application",
    matchType: application.matchType,
    matchConfidence: application.matchConfidence,
    reviewRequired: false,
    reviewStatus: "approved",
    plot: application.plot,
    farm: application.farm,
    pilot: application.pilot,
    drone: application.drone,
    dsAreaHa: application.dsAreaHa,
    djiAreaHa: application.djiAreaHa,
    areaDifferenceHa: application.areaDifferenceHa,
    areaDifferencePercent: application.areaDifferencePercent,
    flightCount: application.flightCount,
    flightRecordNumbers: application.flightRecordNumbers || [],
    generatedAt: application.generatedAt,
  };
}

function printSummary({ copiedImages, exportedApplications, manifestPath }) {
  console.log("");
  console.log("[RESUMO EXPORT DJI FRONTEND]");
  console.log(`Imagens copiadas: ${copiedImages}`);
  console.log(`Aplicacoes exportadas: ${exportedApplications}`);
  console.log(`Manifest gerado: ${manifestPath}`);
}

function main() {
  const osNumber = String(getArg("--os-id", "134"));
  const robotRoot = __dirname;
  const projectRoot = path.resolve(robotRoot, "..");
  const defaultManifestPath = path.join(
    robotRoot,
    "downloads-dji",
    `os-${osNumber}-v2`,
    `dji_manifest_applications_os_${osNumber}.json`,
  );
  const sourceManifestPath = path.resolve(
    getArg("--manifest", defaultManifestPath),
  );
  const frontendRoot = path.resolve(
    getArg("--frontend-root", path.join(projectRoot, "frontend-ds-control-main")),
  );
  const osOutputDir = path.join(
    frontendRoot,
    "public",
    "dji-reports",
    `os-${osNumber}`,
  );
  const applicationsDir = path.join(osOutputDir, "applications");
  const frontendManifestPath = path.join(osOutputDir, "manifest.json");

  const sourceManifest = readJson(sourceManifestPath);
  const sourceApplications = asArray(sourceManifest.applications);
  const approvedApplications = sourceApplications.filter(isApprovedApplication);

  fs.mkdirSync(osOutputDir, { recursive: true });
  cleanApplicationsDir(applicationsDir, osOutputDir);

  const applicationsById = {};
  let copiedImages = 0;

  for (const application of approvedApplications) {
    const targetPath = path.join(applicationsDir, `${application.applicationId}.png`);
    ensureInsideDirectory(targetPath, applicationsDir);
    fs.copyFileSync(application.primaryImagePath, targetPath);
    copiedImages += 1;

    applicationsById[application.applicationId] = buildFrontendApplication(
      application,
      osNumber,
    );
  }

  const frontendApplications = Object.values(applicationsById);
  const frontendManifest = {
    osNumber,
    generatedAt: new Date().toISOString(),
    sourceManifest: path.basename(sourceManifestPath),
    summary: {
      osNumber,
      totalApplications: frontendApplications.length,
      totalApplicationsWithImage: frontendApplications.filter(
        (application) => Boolean(application.imageUrl),
      ).length,
      totalApproved: frontendApplications.filter(
        (application) => application.reviewStatus === "approved",
      ).length,
      totalHighConfidence: frontendApplications.filter(
        (application) => application.matchType === "high_confidence",
      ).length,
      totalExactApplication: frontendApplications.filter(
        (application) => application.matchType === "exact_application",
      ).length,
    },
    applications: applicationsById,
  };

  fs.writeFileSync(
    frontendManifestPath,
    JSON.stringify(frontendManifest, null, 2),
    "utf8",
  );

  printSummary({
    copiedImages,
    exportedApplications: frontendApplications.length,
    manifestPath: frontendManifestPath,
  });
}

main();
