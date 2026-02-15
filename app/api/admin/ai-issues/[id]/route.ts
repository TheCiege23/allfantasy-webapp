import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/ai-issues/[id]", tool: "AdminAiIssues" })(async (req: NextRequest,
  { params }: { params: { id: string } }) => {
  const issue = await prisma.aIIssue.findUnique({
    where: { id: params.id },
    include: {
      feedbackItems: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  return NextResponse.json({ issue });
})

export const PATCH = withApiUsage({ endpoint: "/api/admin/ai-issues/[id]", tool: "AdminAiIssues" })(async (req: NextRequest,
  { params }: { params: { id: string } }) => {
  const body = await req.json();
  const { status, priority, tags, description, resolutionSummary, resolutionType, aiSelfAssessment } = body;

  const data: any = {};
  if (status !== undefined) data.status = status;
  if (priority !== undefined) data.priority = priority;
  if (tags !== undefined) data.tags = tags;
  if (description !== undefined) data.description = description;
  if (aiSelfAssessment !== undefined) data.aiSelfAssessment = aiSelfAssessment;

  if (status === 'resolved' && resolutionSummary) {
    data.resolutionSummary = resolutionSummary;
    data.resolutionType = resolutionType || 'other';
    data.resolvedAt = new Date();
  }

  const issue = await prisma.aIIssue.update({
    where: { id: params.id },
    data,
    include: { feedbackItems: true },
  });

  return NextResponse.json({ issue });
})

export const DELETE = withApiUsage({ endpoint: "/api/admin/ai-issues/[id]", tool: "AdminAiIssues" })(async (req: NextRequest,
  { params }: { params: { id: string } }) => {
  await prisma.aIIssue.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
})
