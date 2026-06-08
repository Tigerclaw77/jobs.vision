const fs = require("node:fs/promises");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { discoverJobsForSources } = require("../../src/lib/job-discovery");
const eyecareConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const { saveDiscoveryRun } = require("../services/jobImportRepository");
const { pool } = require("../services/db");

function configForIndustry(industryKey) {
  return industryKey === "eyecare" ? eyecareConfig : null;
}

async function readSources(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Source file must contain an array.");
  return parsed;
}

async function main() {
  const sourceFile = process.argv[2] || path.resolve(__dirname, "job-discovery-sources.example.json");
  const sources = await readSources(sourceFile);
  let savedCount = 0;

  for (const source of sources) {
    const industryConfig = configForIndustry(source.industryKey);
    const runs = await discoverJobsForSources([source], {
      industryConfig,
      maxDepth: 1,
      maxFollowLinks: 1,
      delayMs: 750,
    });

    for (const run of runs) {
      if (run.error) {
        console.error(`Discovery failed for ${source.employerName}: ${run.error}`);
        continue;
      }
      const saved = await saveDiscoveryRun(run, { discoveredBy: "script" });
      savedCount += saved.length;
      console.log(
        `${source.employerName}: discovered ${run.jobs.length}, saved/upserted ${saved.length}`
      );
    }
  }

  console.log(`Discovery complete. Saved/upserted ${savedCount} job import(s).`);
}

main()
  .catch((error) => {
    console.error("Job discovery failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
