const { runDueJobHealthChecks } = require("../services/jobHealth/runner");

async function main() {
  const limit = Math.min(500, Math.max(1, Number(process.env.JOB_HEALTH_BATCH_SIZE || 50)));
  const concurrency = Math.min(
    10,
    Math.max(1, Number(process.env.JOB_HEALTH_CONCURRENCY || 5))
  );
  const summary = await runDueJobHealthChecks({ limit, concurrency });
  console.log(JSON.stringify({ ok: true, ...summary }));
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error?.message || String(error),
    })
  );
  process.exitCode = 1;
});
