const PROD_URL = process.argv[2];
const BEARER = process.env.ADMIN_BEARER_TOKEN || process.env.ADMIN_PASSWORD || "";

if (!PROD_URL) {
  console.error("Usage: node scripts/sync-questionnaire-to-prod.mjs <PROD_URL>");
  console.error("Example: node scripts/sync-questionnaire-to-prod.mjs https://your-app.replit.app");
  process.exit(1);
}

async function main() {
  console.log("Fetching questionnaire responses from dev...");
  const devRes = await fetch("http://localhost:5000/api/admin/questionnaire", {
    headers: { Authorization: `Bearer ${BEARER}` },
  });
  if (!devRes.ok) throw new Error(`Dev fetch failed: ${devRes.status}`);
  const { responses } = await devRes.json();
  console.log(`Found ${responses.length} questionnaire responses in dev`);

  if (responses.length === 0) {
    console.log("No responses to sync.");
    return;
  }

  console.log(`Pushing to ${PROD_URL}/api/admin/questionnaire...`);
  const prodRes = await fetch(`${PROD_URL}/api/admin/questionnaire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BEARER}`,
    },
    body: JSON.stringify({ rows: responses }),
  });

  const result = await prodRes.json();
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
