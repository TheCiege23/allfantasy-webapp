import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.teamPerformance.deleteMany({ where: { team: { league: { name: { contains: 'Test' } } } } });
  await prisma.leagueTeam.deleteMany({ where: { league: { name: { contains: 'Test' } } } });
  await prisma.roster.deleteMany({ where: { league: { name: { contains: 'Test' } } } });
  await prisma.waiverPickup.deleteMany({ where: { league: { name: { contains: 'Test' } } } });
  await prisma.league.deleteMany({ where: { name: { contains: 'Test' } } });

  const league = await prisma.league.create({
    data: {
      userId: '6a0faf22-6bfa-4484-8acc-c6618028e334',
      platform: 'sleeper',
      platformLeagueId: 'test-league-123',
      name: 'Test Dynasty League',
      sport: 'NFL',
      season: 2025,
      scoring: 'ppr',
      leagueSize: 10,
      status: 'active',
    },
  });

  const teamsData = [
    { externalId: 't1', ownerName: 'Cjabar', teamName: 'Jersey Hitmen', pointsFor: 1452.3, aiPowerScore: 94, strengthNotes: 'Elite young RBs', riskNotes: 'QB age cliff soon', wins: 7, losses: 1 },
    { externalId: 't2', ownerName: 'BallSoHard', teamName: 'PrimeTime', pointsFor: 1389.7, aiPowerScore: 88, strengthNotes: 'WR depth insane', riskNotes: 'Injury prone starters', wins: 6, losses: 2 },
    { externalId: 't3', ownerName: 'GridironGuru', teamName: 'Sack Attack', pointsFor: 1321.1, aiPowerScore: 82, strengthNotes: 'Strong defense streaming', riskNotes: 'Thin at RB', wins: 5, losses: 3 },
    { externalId: 't4', ownerName: 'You', teamName: 'Your Squad', pointsFor: 1287.4, aiPowerScore: 78, strengthNotes: 'Balanced', riskNotes: 'Bye week issues', wins: 4, losses: 4 },
  ];

  for (const t of teamsData) {
    await prisma.leagueTeam.create({
      data: {
        leagueId: league.id,
        externalId: t.externalId,
        ownerName: t.ownerName,
        teamName: t.teamName,
        pointsFor: t.pointsFor,
        aiPowerScore: t.aiPowerScore,
        strengthNotes: t.strengthNotes ?? null,
        riskNotes: t.riskNotes ?? null,
        wins: t.wins,
        losses: t.losses,
      },
    });
  }

  console.log('Test league & teams seeded!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
