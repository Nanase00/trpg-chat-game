import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ imageUrl: null });

    const openai = new OpenAI({ apiKey });
    const { imagePrompt, sceneText } = await req.json();

    // imagePromptが提供されている場合はそれを使用、なければsceneTextから生成
    let finalPrompt: string;
    if (imagePrompt && typeof imagePrompt === 'string') {
      // AIが生成したimagePromptを使用し、品質向上のためのプレフィックスを追加
      finalPrompt = `
        High-quality Visual Novel Background Art, Digital Concept Art, 4k Resolution.
        Style: Makoto Shinkai inspired, atmospheric lighting, depth of field, detailed architecture, scenic, vivid colors.
        ${imagePrompt}
        
        Constraints: 
        - NO humans, NO characters, NO animals (Empty scenery).
        - STRICTLY NO TEXT, NO SIGNS, NO UI elements.
        - Maintain a consistent, painted artistic style.
      `.trim();
    } else if (sceneText && typeof sceneText === 'string') {
      // フォールバック: sceneTextから生成
      finalPrompt = `
        High-quality Visual Novel Background Art, Digital Concept Art, 4k Resolution.
        Style: Makoto Shinkai inspired, atmospheric lighting, depth of field, detailed architecture, scenic, vivid colors.
        Subject: ${sceneText.substring(0, 200)}
        
        Constraints: 
        - NO humans, NO characters, NO animals (Empty scenery).
        - STRICTLY NO TEXT, NO SIGNS, NO UI elements.
        - Maintain a consistent, painted artistic style.
      `.trim();
    } else {
      return NextResponse.json({ imageUrl: null });
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
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