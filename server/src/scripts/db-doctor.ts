import { databaseService } from "../services/database.service.js";

const main = async () => {
  await databaseService.initialize({ repair: false });
  const report = await databaseService.inspectSchemaHealth();

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        level: "error",
        message: "db doctor failed",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}).finally(async () => {
  await databaseService.close();
});
