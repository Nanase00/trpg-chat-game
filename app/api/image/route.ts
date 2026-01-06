import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ imageUrl: null });

    const openai = new OpenAI({ apiKey });
    const { sceneText } = await req.json();

    if (!sceneText) return NextResponse.json({ imageUrl: null });

    // ★品質向上のためのプロンプト修正
    // "Anime style" だけでなく "Visual novel background" や "Concept art" を追加し、
    // 書き込み密度(highly detailed)と光の表現(Cinematic lighting)を強化。
    const imagePrompt = `
      High-quality Visual Novel Background Art, Digital Concept Art, 4k Resolution.
      Style: Makoto Shinkai inspired, atmospheric lighting, depth of field, detailed architecture, scenic, vivid colors.
      Subject: ${sceneText.substring(0, 200)}
      
      Constraints: 
      - NO humans, NO characters, NO animals (Empty scenery).
      - STRICTLY NO TEXT, NO SIGNS, NO UI elements.
      - Maintain a consistent, painted artistic style.
    `.trim();

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard", 
      style: "vivid",
    });

    return NextResponse.json({ imageUrl: (response as any).data[0].url });

  } catch (error) {
    console.error('Image Error:', error);
    return NextResponse.json({ imageUrl: null });
  }
}