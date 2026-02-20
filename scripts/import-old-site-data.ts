import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type SignupRecord = {
  id: number;
  name: string;
  email: string;
  consent: boolean;
  leagueTypes: string[] | null;
  draftTypes: string[] | null;
  sports: string[] | null;
  sportsOther: string | null;
  aiFeatures: string[] | null;
  currentFantasyApp: string | null;
  fantasyExperience: string | null;
  feedback: string | null;
  timestamp: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
};

async function main() {
  const jsonPath = path.join(process.cwd(), "attached_assets/signups_(1)_1771618559955.json");
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: SignupRecord[] = JSON.parse(raw);

  console.log(`Loaded ${data.length} records from JSON`);

  // --- 1. SIGNUPS: Import into EarlyAccessSignup, dedup by email ---
  console.log("\n=== IMPORTING SIGNUPS ===");
  const existingSignups = await prisma.earlyAccessSignup.findMany({ select: { email: true } });
  const existingEmails = new Set(existingSignups.map((s) => s.email.toLowerCase()));

  const seenEmails = new Set<string>();
  let signupInserted = 0;
  let signupSkipped = 0;

  for (const rec of data) {
    const email = rec.email.trim().toLowerCase();
    if (!email) continue;
    if (existingEmails.has(email) || seenEmails.has(email)) {
      signupSkipped++;
      continue;
    }
    seenEmails.add(email);

    let source = "old_site";
    if (rec.timestamp >= "2026-01-26" && rec.timestamp < "2026-02-16") {
      source = "google_ads_landing";
    }

    await prisma.earlyAccessSignup.create({
      data: {
        email,
        name: rec.name?.trim() || null,
        createdAt: new Date(rec.timestamp),
        source,
        referrer: rec.referrer,
        utmSource: rec.utmSource,
        utmMedium: rec.utmMedium,
        utmCampaign: rec.utmCampaign,
        utmContent: rec.utmContent,
        utmTerm: rec.utmTerm,
      },
    });
    signupInserted++;
  }
  console.log(`Signups: ${signupInserted} inserted, ${signupSkipped} skipped (duplicate)`);

  // --- 2. LEAGUE IDEAS: Import into LeagueTypeSubmission ---
  console.log("\n=== IMPORTING LEAGUE IDEAS ===");
  const existingIdeas = await prisma.leagueTypeSubmission.findMany({ select: { email: true, leagueTypeName: true } });
  const existingIdeaKeys = new Set(existingIdeas.map((i) => `${i.email.toLowerCase()}|${i.leagueTypeName.toLowerCase()}`));

  let ideasInserted = 0;
  let ideasSkipped = 0;

  const usersWithTypes = data.filter(
    (d) => d.leagueTypes && d.leagueTypes.length > 0
  );

  for (const rec of usersWithTypes) {
    const email = rec.email.trim().toLowerCase();
    const types = rec.leagueTypes!;
    const typeSummary = types.join(", ");
    const key = `${email}|${typeSummary.toLowerCase()}`;

    if (existingIdeaKeys.has(key)) {
      ideasSkipped++;
      continue;
    }

    const sportsArr = rec.sports && rec.sports.length > 0 ? rec.sports : ["NFL"];
    const aiFeatures = rec.aiFeatures && rec.aiFeatures.length > 0 ? rec.aiFeatures : [];
    const draftTypes = rec.draftTypes && rec.draftTypes.length > 0 ? rec.draftTypes : [];

    await prisma.leagueTypeSubmission.create({
      data: {
        leagueTypeName: typeSummary,
        tagline: `Interested in: ${typeSummary}`,
        description: [
          `User expressed interest in these league types during signup.`,
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
        createdAt: new Date(rec.timestamp),
      },
    });
    ideasInserted++;
  }
  console.log(`League Ideas: ${ideasInserted} inserted, ${ideasSkipped} skipped (duplicate)`);

  // --- 3. FEEDBACK: Import into LegacyFeedback ---
  console.log("\n=== IMPORTING FEEDBACK ===");
  const existingFeedback = await prisma.legacyFeedback.findMany({ select: { email: true, feedbackText: true } });
  const existingFeedbackKeys = new Set(
    existingFeedback.map((f) => `${(f.email || "").toLowerCase()}|${f.feedbackText.toLowerCase().trim()}`)
  );

  let feedbackInserted = 0;
  let feedbackSkipped = 0;

  const usersWithFeedback = data.filter(
    (d) => d.feedback && d.feedback.trim() !== ""
  );

  for (const rec of usersWithFeedback) {
    const email = rec.email.trim().toLowerCase();
    const text = rec.feedback!.trim();
    const key = `${email}|${text.toLowerCase()}`;

    if (existingFeedbackKeys.has(key)) {
      feedbackSkipped++;
      continue;
    }

    await prisma.legacyFeedback.create({
      data: {
        feedbackType: "general",
        tool: "signup_questionnaire",
        feedbackText: text,
        email,
        canContact: rec.consent,
        status: "new",
        createdAt: new Date(rec.timestamp),
      },
    });
    feedbackInserted++;
  }
  console.log(`Feedback: ${feedbackInserted} inserted, ${feedbackSkipped} skipped (duplicate)`);

  // --- ALSO import from the CSV for signups that might only be in CSV (early_access type with no JSON match) ---
  console.log("\n=== CHECKING CSV FOR ADDITIONAL SIGNUPS ===");
  const csvPath = path.join(process.cwd(), "attached_assets/allfantasy-all-signups_1771618559954.csv");
  const csvRaw = fs.readFileSync(csvPath, "utf-8");
  const csvLines = csvRaw.split("\n").slice(1).filter((l) => l.trim());

  let csvInserted = 0;
  let csvSkipped = 0;

  const allInsertedEmails = new Set([...existingEmails, ...seenEmails]);

  for (const line of csvLines) {
    const match = line.match(/^"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"$/);
    if (!match) continue;
    const [, csvName, csvEmail, csvType, csvSource, csvCreated] = match;
    const email = csvEmail.trim().toLowerCase();

    if (!email || allInsertedEmails.has(email)) {
      csvSkipped++;
      continue;
    }
    allInsertedEmails.add(email);

    await prisma.earlyAccessSignup.create({
      data: {
        email,
        name: csvName?.trim() || null,
        createdAt: new Date(csvCreated),
        source: csvSource || csvType || "old_site",
      },
    });
    csvInserted++;
  }
  console.log(`CSV additional signups: ${csvInserted} inserted, ${csvSkipped} skipped (duplicate)`);

  // --- SUMMARY ---
  const totalSignups = await prisma.earlyAccessSignup.count();
  const totalIdeas = await prisma.leagueTypeSubmission.count();
  const totalFeedback = await prisma.legacyFeedback.count();

  console.log("\n=== FINAL COUNTS ===");
  console.log(`EarlyAccessSignup: ${totalSignups}`);
  console.log(`LeagueTypeSubmission: ${totalIdeas}`);
  console.log(`LegacyFeedback: ${totalFeedback}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
