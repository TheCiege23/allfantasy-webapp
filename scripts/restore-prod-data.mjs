import fs from "fs";
import path from "path";

const BASE_URL = process.argv[2] || "http://localhost:5000";
const BEARER = process.env.ADMIN_BEARER_TOKEN || process.env.ADMIN_PASSWORD || "";

async function main() {
  const jsonPath = path.join(process.cwd(), "attached_assets/signups_(1)_1771618559955.json");
  const csvPath = path.join(process.cwd(), "attached_assets/allfantasy-all-signups_1771618559954.csv");

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Loaded ${data.length} records from JSON`);

  const signups = [];
  const seenEmails = new Set();

  for (const rec of data) {
    const email = rec.email?.trim().toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);

    let source = "old_site";
    if (rec.timestamp >= "2026-01-26" && rec.timestamp < "2026-02-16") {
      source = "google_ads_landing";
    }

    signups.push({
      email,
      name: rec.name?.trim() || null,
      createdAt: rec.timestamp,
      source,
      referrer: rec.referrer,
      utmSource: rec.utmSource,
      utmMedium: rec.utmMedium,
      utmCampaign: rec.utmCampaign,
      utmContent: rec.utmContent,
      utmTerm: rec.utmTerm,
    });
  }

  const csvRaw = fs.readFileSync(csvPath, "utf-8");
  const csvLines = csvRaw.split("\n").slice(1).filter((l) => l.trim());
  for (const line of csvLines) {
    const match = line.match(/^"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"$/);
    if (!match) continue;
    const [, csvName, csvEmail, csvType, csvSource, csvCreated] = match;
    const email = csvEmail.trim().toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    signups.push({
      email,
      name: csvName?.trim() || null,
      createdAt: csvCreated,
      source: csvSource || csvType || "old_site",
    });
  }

  const leagueIdeas = [];
  for (const rec of data) {
    if (!rec.leagueTypes || rec.leagueTypes.length === 0) continue;
    const email = rec.email?.trim().toLowerCase();
    const types = rec.leagueTypes;
    const sportsArr = rec.sports?.length > 0 ? rec.sports : ["NFL"];
    const aiFeatures = rec.aiFeatures?.length > 0 ? rec.aiFeatures : [];
    const draftTypes = rec.draftTypes?.length > 0 ? rec.draftTypes : [];

    leagueIdeas.push({
      leagueTypeName: types.join(", "),
      tagline: `Interested in: ${types.join(", ")}`,
      description: [
        "User expressed interest in these league types during signup.",
        rec.fantasyExperience ? `Experience level: ${rec.fantasyExperience}` : null,
        rec.currentFantasyApp ? `Currently uses: ${rec.currentFantasyApp}` : null,
        aiFeatures.length > 0 ? `AI features wanted: ${aiFeatures.join(", ")}` : null,
        draftTypes.length > 0 ? `Draft preferences: ${draftTypes.join(", ")}` : null,
      ].filter(Boolean).join("\n"),
      sports: sportsArr,
      recommendedSize: "12",
      seasonFormat: "Full Season",
      draftType: draftTypes[0] || "Snake Draft",
      winCondition: "Standard",
      hasSpecialScoring: false,
      specialMechanics: types,
      weeklyFlow: "Standard weekly matchup format",
      creditName: rec.name?.trim() || "Anonymous",
      email,
      permissionConsent: rec.consent,
      rightsConsent: rec.consent,
      canContact: rec.consent,
      status: "received",
      createdAt: rec.timestamp,
    });
  }

  const feedback = [];
  for (const rec of data) {
    if (!rec.feedback || rec.feedback.trim() === "") continue;
    feedback.push({
      feedbackType: "general",
      tool: "signup_questionnaire",
      feedbackText: rec.feedback.trim(),
      email: rec.email?.trim().toLowerCase(),
      canContact: rec.consent,
      status: "new",
      createdAt: rec.timestamp,
    });
  }

  console.log(`Prepared: ${signups.length} signups, ${leagueIdeas.length} league ideas, ${feedback.length} feedback`);
  console.log(`Posting to ${BASE_URL}/api/admin/bulk-import...`);

  const res = await fetch(`${BASE_URL}/api/admin/bulk-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BEARER}`,
    },
    body: JSON.stringify({ signups, leagueIdeas, feedback }),
  });

  const json = await res.json();
  console.log("Response:", JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
