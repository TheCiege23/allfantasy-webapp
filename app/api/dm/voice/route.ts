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

async function shareLeague(userA: string, userB: string): Promise<boolean> {
  const shared = await prisma.bracketLeagueMember.findFirst({
    where: {
      userId: userA,
      league: {
        members: {
          some: { userId: userB },
        },
      },
    },
  });
  return !!shared;
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('voice') as File | null;
    const receiverId = formData.get('receiverId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No voice file provided' }, { status: 400 });
    }

    if (!receiverId) {
      return NextResponse.json({ error: 'receiverId is required' }, { status: 400 });
    }

    if (receiverId === session.user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'File must be audio' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Voice message must be under 2MB' }, { status: 400 });
    }

    const receiver = await prisma.appUser.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const inSameLeague = await shareLeague(session.user.id, receiverId);
    if (!inSameLeague) {
      return NextResponse.json({ error: 'You can only message members of your leagues' }, { status: 403 });
    }

    const ext = file.type.includes('webm') ? 'webm' : file.type.includes('mp4') ? 'mp4' : 'ogg';
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);

    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadPath, fileName), buffer);

    const voiceUrl = `/uploads/voice/${fileName}`;

    const dm = await prisma.privateChatMessage.create({
      data: {
        senderId: session.user.id,
        receiverId,
        message: '🎤 Voice message',
        voiceUrl,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ message: dm });
  } catch (err) {
    console.error('[DM Voice Upload Error]', err);
    return NextResponse.json({ error: 'Failed to send voice message' }, { status: 500 });
  }
}
