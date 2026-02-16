import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9' .\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFloat_(v: string | undefined | null): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n;
}

function parseInt_(v: string | undefined | null): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseInt(v.trim(), 10);
  return isNaN(n) ? null : n;
}

function parseString(v: string | undefined | null): string | null {
  if (!v || v.trim() === "" || v.trim() === '""') return null;
  return v.trim().replace(/^"|"$/g, "");
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const COLUMN_MAP: Record<string, string> = {
  name: "name",
  position: "position",
  status: "status",
  current_team: "currentTeam",
  season: "season",
  "40_yard_dash": "fortyYardDash",
  "20_yard_shuttle": "twentyYardShuttle",
  "3_cone_drill": "threeConeDrill",
  bench_press: "benchPress",
  broad_jump: "broadJump",
  vertical_jump: "verticalJump",
  athleticism_score: "athleticismScore",
  speed_score: "speedScore",
  burst_score: "burstScore",
  agility_score: "agilityScore",
  sparq_x: "sparqX",
  arm_length_in: "armLengthIn",
  hand_size_in: "handSizeIn",
  height_in: "heightIn",
  weight_lb: "weightLb",
  bmi: "bmi",
  catch_radius: "catchRadius",
  throw_velocity_mph: "throwVelocityMph",
  breakout_age: "breakoutAge",
  breakout_rating: "breakoutRating",
  breakout_year: "breakoutYear",
  college: "college",
  college_dominator_rating: "collegeDominatorRating",
  college_dynamic_score: "collegeDynamicScore",
  college_level_of_competition: "collegeLevelOfCompetition",
  college_freshman_yards: "collegeFreshmanYards",
  college_target_share: "collegeTargetShare",
  college_receiver_rating: "collegeReceiverRating",
  college_ypr: "collegeYpr",
  college_teammate_score: "collegeTeammateScore",
  best_college_season_yardage_share: "bestCollegeSeasonYardageShare",
  draft_pick: "draftPick",
  draft_year: "draftYear",
  current_adp: "currentAdp",
  current_adp_trend: "currentAdpTrend",
  lifetime_value: "lifetimeValue",
  best_comparable_players: "bestComparablePlayers",
  total_fantasy_points: "totalFantasyPoints",
  fantasy_points_per_game: "fantasyPointsPerGame",
  expected_fantasy_points: "expectedFantasyPoints",
  expected_fantasy_points_per_game: "expectedFantasyPointsPerGame",
  weekly_volatility: "weeklyVolatility",
};

export async function importPlayerAnalyticsCSV(csvPath: string): Promise<{
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { total: 0, imported: 0, skipped: 0, errors: ["CSV is empty or has no data rows"] };
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.replace(/^"|"$/g, "").trim()
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 50;
  let batch: any[] = [];

  const expectedCols = headers.length;
  console.log(`[PlayerAnalytics] CSV has ${expectedCols} columns, ${lines.length - 1} data rows`);

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);

      if (values.length < Math.min(10, expectedCols)) {
        skipped++;
        continue;
      }

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || "";
      }

      const name = parseString(row.name);
      const position = parseString(row.position);
      const season = parseString(row.season);

      if (!name || !position || !season) {
        skipped++;
        continue;
      }

      const normalizedName = normalizeName(name);

      const rawData: Record<string, any> = {};
      for (const header of headers) {
        const val = parseString(row[header]);
        if (val !== null) rawData[header] = val;
      }

      const record: any = {
        normalizedName,
        name,
        position,
        status: parseString(row.status),
        currentTeam: parseString(row.current_team),
        season,
        fortyYardDash: parseFloat_(row["40_yard_dash"]),
        twentyYardShuttle: parseFloat_(row["20_yard_shuttle"]),
        threeConeDrill: parseFloat_(row["3_cone_drill"]),
        benchPress: parseInt_(row.bench_press),
        broadJump: parseInt_(row.broad_jump),
        verticalJump: parseFloat_(row.vertical_jump),
        athleticismScore: parseFloat_(row.athleticism_score),
        speedScore: parseFloat_(row.speed_score),
        burstScore: parseFloat_(row.burst_score),
        agilityScore: parseFloat_(row.agility_score),
        sparqX: parseFloat_(row.sparq_x),
        armLengthIn: parseFloat_(row.arm_length_in),
        handSizeIn: parseFloat_(row.hand_size_in),
        heightIn: parseInt_(row.height_in),
        weightLb: parseInt_(row.weight_lb),
        bmi: parseFloat_(row.bmi),
        catchRadius: parseFloat_(row.catch_radius),
        throwVelocityMph: parseFloat_(row.throw_velocity_mph),
        breakoutAge: parseFloat_(row.breakout_age),
        breakoutRating: parseFloat_(row.breakout_rating),
        breakoutYear: parseInt_(row.breakout_year),
        college: parseString(row.college),
        collegeDominatorRating: parseFloat_(row.college_dominator_rating),
        collegeDynamicScore: parseFloat_(row.college_dynamic_score),
        collegeLevelOfCompetition: parseFloat_(row.college_level_of_competition),
        collegeFreshmanYards: parseFloat_(row.college_freshman_yards),
        collegeTargetShare: parseFloat_(row.college_target_share),
        collegeReceiverRating: parseString(row.college_receiver_rating),
        collegeYpr: parseFloat_(row.college_ypr),
        collegeTeammateScore: parseFloat_(row.college_teammate_score),
        bestCollegeSeasonYardageShare: parseFloat_(
          row.best_college_season_yardage_share
        ),
        draftPick: parseFloat_(row.draft_pick),
        draftYear: parseInt_(row.draft_year),
        currentAdp: parseFloat_(row.current_adp),
        currentAdpTrend: parseFloat_(row.current_adp_trend),
        lifetimeValue: parseFloat_(row.lifetime_value),
        bestComparablePlayers: parseString(row.best_comparable_players),
        totalFantasyPoints: parseFloat_(row.total_fantasy_points),
        fantasyPointsPerGame: parseFloat_(row.fantasy_points_per_game),
        expectedFantasyPoints: parseFloat_(row.expected_fantasy_points),
        expectedFantasyPointsPerGame: parseFloat_(
          row.expected_fantasy_points_per_game
        ),
        weeklyVolatility: parseFloat_(row.weekly_volatility),
        rawData,
        source: "csv_import",
        dataVersion: "v1",
      };

      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        const results = await processBatch(batch);
        imported += results.imported;
        skipped += results.skipped;
        if (results.errors.length) errors.push(...results.errors);
        batch = [];
      }
    } catch (e: any) {
      errors.push(`Row ${i}: ${e.message}`);
      if (errors.length > 50) break;
    }
  }

  if (batch.length > 0) {
    const results = await processBatch(batch);
    imported += results.imported;
    skipped += results.skipped;
    if (results.errors.length) errors.push(...results.errors);
  }

  return { total: lines.length - 1, imported, skipped, errors: errors.slice(0, 20) };
}

async function processBatch(batch: any[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const record of batch) {
    try {
      await prisma.playerAnalyticsSnapshot.upsert({
        where: {
          normalizedName_season_source: {
            normalizedName: record.normalizedName,
            season: record.season,
            source: record.source,
          },
        },
        create: record,
        update: {
          ...record,
          importedAt: new Date(),
        },
      });
      imported++;
    } catch (e: any) {
      errors.push(`${record.name}: ${e.message?.slice(0, 100)}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

if (require.main === module) {
  const csvPath =
    process.argv[2] ||
    path.join(
      process.cwd(),
      "attached_assets/data_analysis_report-2026-02-16_(2)_1771266996330.csv"
    );

  console.log(`[PlayerAnalytics] Importing from: ${csvPath}`);

  importPlayerAnalyticsCSV(csvPath)
    .then((result) => {
      console.log(`[PlayerAnalytics] Import complete:`);
      console.log(`  Total rows: ${result.total}`);
      console.log(`  Imported: ${result.imported}`);
      console.log(`  Skipped: ${result.skipped}`);
      if (result.errors.length) {
        console.log(`  Errors (first 20):`);
        result.errors.forEach((e) => console.log(`    - ${e}`));
      }
      process.exit(0);
    })
    .catch((e) => {
      console.error(`[PlayerAnalytics] Fatal error:`, e);
      process.exit(1);
    });
}
