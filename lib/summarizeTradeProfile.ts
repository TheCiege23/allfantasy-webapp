import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeUserTradeProfile(userId: string) {
  try {
    const recentVotes = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (recentVotes.length < 10) {
      console.log(`Not enough votes for ${userId} (only ${recentVotes.length})`);
      return;
    }

    const voteLines = recentVotes
      .map(v => `${v.vote === 'UP' ? '👍' : '👎'} ${v.reason || ''} on "${v.suggestionTitle || 'suggestion'}"`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a concise user preference summarizer for fantasy football trades.
Create a short, dense profile (150–300 tokens max) from these thumbs up/down votes.
Focus on recurring patterns: positional biases, risk tolerance, valuation style, roster fit preferences, etc.
Use bullet points. Be specific and honest.`
        },
        { role: 'user', content: `Votes:\n${voteLines}` }
      ],
      temperature: 0.4,
      max_tokens: 350,
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';

    if (!summary) throw new Error('No summary generated');

    await prisma.tradeProfile.upsert({
      where: { userId },
      update: {
        summary,
        voteCount: recentVotes.length,
        lastSummarizedAt: new Date(),
        version: { increment: 1 },
      },
      create: {
        userId,
        summary,
        voteCount: recentVotes.length,
        lastSummarizedAt: new Date(),
      },
    });

    console.log(`Updated trade profile for user ${userId}`);
  } catch (error) {
    console.error(`Summarization failed for user ${userId}:`, error);
  }
}
