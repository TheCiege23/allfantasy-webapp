import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const message = formData.get('message') as string;
    const image = formData.get('image') as File;

    let visionContent: any[] = [{ type: 'text', text: message || 'Analyze this trade screenshot' }];

    if (image && image.size > 0) {
      const arrayBuffer = await image.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');

      visionContent.push({
        type: 'image_url',
        image_url: { url: `data:${image.type};base64,${base64Image}` }
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Chimmy, a warm, helpful, female fantasy football AI assistant. 
Be friendly, use emojis \u{1F496}, explain things clearly, and reference any previous tool outputs or screenshots if relevant.
If a screenshot was uploaded, analyze the trade shown (players, picks, values) and answer questions about it.`
        },
        { role: 'user', content: visionContent }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const reply = response.choices[0]?.message?.content || "Hmm\u2026 something went wrong. Try again? \u{1F495}";

    return NextResponse.json({ response: reply });
  } catch (error) {
    console.error('[Chimmy Chat]', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
