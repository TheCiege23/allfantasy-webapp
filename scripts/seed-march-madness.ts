import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let tournament = await prisma.bracketTournament.findFirst({
    where: { sport: 'ncaam', season: 2025 },
  });

  if (!tournament) {
    tournament = await prisma.bracketTournament.create({
      data: {
        name: '2025 NCAA March Madness',
        season: 2025,
        sport: 'ncaam',
      },
    });
  }

  await (prisma as any).marchMadnessGame.deleteMany({
    where: { tournamentId: tournament.id },
  });

  const round1Games = [
    { round: 1, gameNumber: 1, region: 'East', team1: 'Auburn', team1Seed: 1, team2: 'North Dakota St.', team2Seed: 16 },
    { round: 1, gameNumber: 2, region: 'East', team1: 'Michigan St.', team1Seed: 8, team2: 'Longwood', team2Seed: 9 },
    { round: 1, gameNumber: 3, region: 'East', team1: "St. John's", team1Seed: 5, team2: 'Omaha', team2Seed: 12 },
    { round: 1, gameNumber: 4, region: 'East', team1: 'Texas Tech', team1Seed: 4, team2: 'UNC Wilmington', team2Seed: 13 },
    { round: 1, gameNumber: 5, region: 'East', team1: 'Alabama', team1Seed: 3, team2: 'Colgate', team2Seed: 14 },
    { round: 1, gameNumber: 6, region: 'East', team1: 'Oregon', team1Seed: 6, team2: 'North Carolina', team2Seed: 11 },
    { round: 1, gameNumber: 7, region: 'East', team1: 'Florida', team1Seed: 7, team2: 'UConn', team2Seed: 10 },
    { round: 1, gameNumber: 8, region: 'East', team1: 'Purdue', team1Seed: 2, team2: 'High Point', team2Seed: 15 },
    { round: 1, gameNumber: 9, region: 'West', team1: 'Duke', team1Seed: 1, team2: 'Mount St. Mary\'s', team2Seed: 16 },
    { round: 1, gameNumber: 10, region: 'West', team1: 'Mississippi St.', team1Seed: 8, team2: 'Baylor', team2Seed: 9 },
    { round: 1, gameNumber: 11, region: 'West', team1: 'Oregon St.', team1Seed: 5, team2: 'Liberty', team2Seed: 12 },
    { round: 1, gameNumber: 12, region: 'West', team1: 'Arizona', team1Seed: 4, team2: 'Akron', team2Seed: 13 },
    { round: 1, gameNumber: 13, region: 'West', team1: 'Wisconsin', team1Seed: 3, team2: 'Montana', team2Seed: 14 },
    { round: 1, gameNumber: 14, region: 'West', team1: 'Illinois', team1Seed: 6, team2: 'Xavier', team2Seed: 11 },
    { round: 1, gameNumber: 15, region: 'West', team1: 'Texas A&M', team1Seed: 7, team2: 'Yale', team2Seed: 10 },
    { round: 1, gameNumber: 16, region: 'West', team1: 'Tennessee', team1Seed: 2, team2: 'Wofford', team2Seed: 15 },
    { round: 1, gameNumber: 17, region: 'South', team1: 'Houston', team1Seed: 1, team2: 'SIU Edwardsville', team2Seed: 16 },
    { round: 1, gameNumber: 18, region: 'South', team1: 'Gonzaga', team1Seed: 8, team2: 'Georgia', team2Seed: 9 },
    { round: 1, gameNumber: 19, region: 'South', team1: 'Clemson', team1Seed: 5, team2: 'McNeese', team2Seed: 12 },
    { round: 1, gameNumber: 20, region: 'South', team1: 'Purdue', team1Seed: 4, team2: 'High Point', team2Seed: 13 },
    { round: 1, gameNumber: 21, region: 'South', team1: 'Marquette', team1Seed: 3, team2: 'New Mexico', team2Seed: 14 },
    { round: 1, gameNumber: 22, region: 'South', team1: 'Michigan', team1Seed: 6, team2: 'UC San Diego', team2Seed: 11 },
    { round: 1, gameNumber: 23, region: 'South', team1: 'Kansas', team1Seed: 7, team2: 'Arkansas', team2Seed: 10 },
    { round: 1, gameNumber: 24, region: 'South', team1: "St. Mary's", team1Seed: 2, team2: 'Norfolk St.', team2Seed: 15 },
    { round: 1, gameNumber: 25, region: 'Midwest', team1: 'Florida', team1Seed: 1, team2: 'Norfolk St.', team2Seed: 16 },
    { round: 1, gameNumber: 26, region: 'Midwest', team1: 'UConn', team1Seed: 8, team2: 'Oklahoma', team2Seed: 9 },
    { round: 1, gameNumber: 27, region: 'Midwest', team1: 'Memphis', team1Seed: 5, team2: 'Colorado St.', team2Seed: 12 },
    { round: 1, gameNumber: 28, region: 'Midwest', team1: 'Maryland', team1Seed: 4, team2: 'Grand Canyon', team2Seed: 13 },
    { round: 1, gameNumber: 29, region: 'Midwest', team1: 'Missouri', team1Seed: 3, team2: 'Drake', team2Seed: 14 },
    { round: 1, gameNumber: 30, region: 'Midwest', team1: 'Kentucky', team1Seed: 6, team2: 'Troy', team2Seed: 11 },
    { round: 1, gameNumber: 31, region: 'Midwest', team1: 'UCLA', team1Seed: 7, team2: 'Utah St.', team2Seed: 10 },
    { round: 1, gameNumber: 32, region: 'Midwest', team1: 'Iowa St.', team1Seed: 2, team2: 'Lipscomb', team2Seed: 15 },
  ];

  await (prisma as any).marchMadnessGame.createMany({
    data: round1Games.map(g => ({
      ...g,
      tournamentId: tournament!.id,
      date: new Date('2025-03-20'),
      venue: 'Various NCAA Sites',
    })),
  });

  console.log(`2025 March Madness games seeded! (${round1Games.length} Round of 64 games)`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
