import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = 'public/uploads/voice';
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    const leagueId = formData.get('leagueId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
    }

    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'File must be audio' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Voice message must be under 2MB' }, { status: 400 });
    }

    const member = await prisma.bracketLeagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: session.user.id } },
    });

    if (!member) {
      return NextResponse.json({ error: 'Not a league member' }, { status: 403 });
    }

    const ext = file.type.includes('webm') ? 'webm' : file.type.includes('mp4') ? 'mp4' : 'ogg';
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);

    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadPath, fileName), buffer);

    const audioUrl = `/uploads/voice/${fileName}`;

    const chatMessage = await prisma.madnessChatMessage.create({
      data: {
        leagueId,
        userId: session.user.id,
        message: '[Voice Message]',
        audioUrl,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(chatMessage);
  } catch (err) {
    console.error('[Madness Chat Voice Upload Error]', err);
    return NextResponse.json({ error: 'Failed to send voice message' }, { status: 500 });
  }
}
