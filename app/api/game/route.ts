import { NextRequest, NextResponse } from 'next/server'
import { generateGameResponse } from '@/app/lib/openrouter'
import { WorldSetting } from '@/app/types/game'

export async function POST(request: NextRequest) {
  // ★ここに「診察器」を入れました
  console.log("★APIキーチェック:", process.env.OPENROUTER_API_KEY ? "あり" : "なし");

  try {
    const body = await request.json()
    const { playerName, worldSetting, userInput, conversationHistory } = body

    if (!playerName || !worldSetting || !userInput) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const response = await generateGameResponse(
      playerName,
      worldSetting as WorldSetting,
      userInput,
      conversationHistory || []
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}