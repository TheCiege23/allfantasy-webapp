import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/ai-issues", tool: "AdminAiIssues" })(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const area = searchParams.get('area');

  const where: any = {};
  if (status && status !== 'all') where.status = status;
  if (priority && priority !== 'all') where.priority = priority;
  if (area && area !== 'all') where.area = area;

  const issues = await prisma.aIIssue.findMany({
    where,
    include: {
      feedbackItems: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const stats = await prisma.aIIssue.aggregate({
    _count: { id: true },
    _avg: { avgConfidence: true, feltOffRate: true },
    where: { status: { in: ['open', 'investigating', 'in_progress'] } },
  });

  const openCount = await prisma.aIIssue.count({
    where: { status: { in: ['open', 'investigating', 'in_progress'] } },
  });

  const resolvedRecently = await prisma.aIIssue.findMany({
    where: {
      status: 'resolved',
      resolvedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { resolvedAt: 'desc' },
    take: 10,
  });

  const avgResolutionTime = await prisma.$queryRaw`
    SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400) as avg_days
    FROM "AIIssue"
    WHERE status = 'resolved' AND "resolvedAt" IS NOT NULL
  ` as any[];

  return NextResponse.json({
    issues,
    stats: {
      openCount,
      avgConfidence: stats._avg.avgConfidence ?? 0,
      avgFeltOffRate: stats._avg.feltOffRate ?? 0,
      avgResolutionDays: avgResolutionTime[0]?.avg_days ?? 0,
    },
    resolvedRecently,
  });
})

export const POST = withApiUsage({ endpoint: "/api/admin/ai-issues", tool: "AdminAiIssues" })(async (req: NextRequest) => {
  const body = await req.json();
  const { title, description, area, priority, sport, leagueType, aiSelfAssessment, tags, feedbackItems } = body;

  if (!title || !area) {
    return NextResponse.json({ error: 'Title and area required' }, { status: 400 });
  }

  const issue = await prisma.aIIssue.create({
    data: {
      title,
      description,
      area,
      priority: priority || 'low',
      sport,
      leagueType,
      aiSelfAssessment,
      tags: tags || [],
      reportCount: feedbackItems?.length || 1,
      feedbackItems: feedbackItems ? {
        create: feedbackItems.map((f: any) => ({
          feedbackText: f.feedbackText,
          feedbackType: f.feedbackType,
          confidenceLevel: f.confidenceLevel,
          sport: f.sport,
          leagueType: f.leagueType,
          insightType: f.insightType,
        })),
      } : undefined,
    },
    include: { feedbackItems: true },
  });

  return NextResponse.json({ issue });
})
