import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const message = formData.get('message') as string || '';
    const imageFile = formData.get('image') as File | null;
    const toolContextRaw = formData.get('toolContext') as string || '[]';

    let toolContext: any[] = [];
    try { toolContext = JSON.parse(toolContextRaw); } catch {}

    const systemPrompt = `You are Chimmy, an AI fantasy sports assistant for the AllFantasy platform. You are friendly, knowledgeable, and supportive.

Your personality:
- Warm and encouraging but honest
- You use casual language and occasional emojis (but not excessively)
- You never encourage exploiting other managers — fair trades where both teams improve are ideal
- You respect that trades are their own ecosystem — both sides should feel they gave up value but got better

Your expertise:
- Fantasy football trade evaluation (redraft and dynasty)
- Waiver wire strategy and FAAB bidding
- Roster construction and lineup optimization
- Player valuations, injury impacts, and matchup analysis
- Dynasty asset management (picks, prospects, aging curves)

When analyzing trade screenshots:
- Identify the players/picks on each side
- Evaluate fairness using positional value, age curves, and league format context
- Give a clear verdict (fair, lopsided, etc.) with reasoning
- Suggest counter-offers if the trade seems unbalanced

${toolContext.length > 0 ? `\nRecent user activity for context:\n${toolContext.map((t: any) => `- Used ${t.tool}: ${t.output}`).join('\n')}` : ''}

Keep responses concise but thorough. If the user uploads a screenshot, analyze what you see in the image.`;

    const userContent: any[] = [];

    if (message) {
      userContent.push({ type: 'text', text: message });
    }

    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mimeType = imageFile.type || 'image/png';

      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: 'high',
        },
      });

      if (!message) {
        userContent.push({ type: 'text', text: 'What do you see in this image? Analyze it from a fantasy sports perspective.' });
      }
    }

    if (userContent.length === 0) {
      return NextResponse.json({ response: "I didn't get a message or image. Try again?" });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "Hmm, I couldn't think of a response. Try asking again!";

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Chimmy chat error:', error?.message || error);
    return NextResponse.json(
      { response: "Sorry, something went wrong on my end. Try again in a moment? \u{1F495}" },
      { status: 500 }
    );
  }
}
