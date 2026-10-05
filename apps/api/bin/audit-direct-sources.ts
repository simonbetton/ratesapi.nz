import { auditDirectSources } from "./direct/run";

try {
  const complete = await auditDirectSources(
    process.argv[2] ?? "direct-source-report.json"
  );
  if (!complete) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
