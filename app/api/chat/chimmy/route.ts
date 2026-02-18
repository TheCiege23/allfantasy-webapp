import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const message = (formData.get('message') as string) || '';
    const imageFile = formData.get('image') as File | null;

    let userContent: any[] = [{ type: 'text', text: message || 'Analyze this trade screenshot and give me your thoughts.' }];

    if (imageFile && imageFile.size > 0) {
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${imageFile.type};base64,${base64}` }
      });
    }

    const hasImage = imageFile && imageFile.size > 0;

    if (hasImage) {
      const visionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert fantasy football trade analyst. 
Analyze the screenshot of the trade offer and return ONLY valid JSON with this exact structure:

{
  "youGive": ["player names or picks"],
  "youGet": ["player names or picks"],
  "leagueContext": "e.g. 12-team dynasty PPR",
  "notes": "any visible comments or context",
  "fairnessAssessment": "brief one-sentence assessment"
}`
          },
          { role: 'user', content: userContent }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
      });

      const parsedTrade = JSON.parse(visionResponse.choices[0]?.message?.content || '{}');

      const naturalResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are Chimmy, a warm, friendly, female fantasy football AI assistant. 
Speak naturally, use emojis \u{1F496}, be encouraging and helpful. 
Reference the parsed trade data and give honest, fun analysis.`
          },
          {
            role: 'user',
            content: `Trade screenshot analysis: ${JSON.stringify(parsedTrade)}\n\nUser question: ${message || 'What do you think of this trade?'}
Please respond conversationally and offer to explain anything.`
          }
        ],
        temperature: 0.85,
        max_tokens: 700,
      });

      const reply = naturalResponse.choices[0]?.message?.content || "Hmm\u2026 I'm having trouble reading that screenshot. Can you describe the trade? \u{1F495}";

      return NextResponse.json({
        response: reply,
        parsedTrade
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Chimmy, a warm, friendly, female fantasy football AI assistant. 
Speak naturally, use emojis \u{1F496}, be encouraging and helpful.
You help with trades, waivers, roster analysis, dynasty strategy, and anything fantasy football.
Be honest and straightforward — never encourage exploiting other managers.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.85,
      max_tokens: 700,
    });

    const reply = response.choices[0]?.message?.content || "Hmm\u2026 something went wrong. Try again? \u{1F495}";

    return NextResponse.json({ response: reply });

  } catch (error) {
    console.error('[Chimmy Vision]', error);
    return NextResponse.json({
      response: "Sorry, I had trouble with that. Can you try again or describe the trade? \u{1F495}"
    });
  }
}
