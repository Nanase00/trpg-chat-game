import { OpenRouterResponse, WorldSetting } from '../types/game'
import { jsonrepair } from 'jsonrepair'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-3.5-sonnet'

const getWorldSettingDescription = (setting: WorldSetting): string => {
  switch (setting) {
    case 'academy': return '【Case B: 学園】現代日本の学園ミステリー。魔法禁止。ヒロイン候補が登場。'
    case 'sf': return '【Case A: SF】宇宙、サイバーパンク、AI、企業陰謀。'
    case 'fantasy': return '【Case C: ファンタジー】剣と魔法、冒険、魔王。'
  }
  return ''
}

export const generateGameResponse = async (
  playerName: string,
  worldSetting: WorldSetting,
  userInput: string,
  conversationHistory: Array<{ speaker: string; name: string; message: string }>
): Promise<OpenRouterResponse> => {
  const isFirstMessage = conversationHistory.length === 0

  // プロンプト修正：GMの表記を「GM」に固定するルールを追加
  const systemPrompt = `あなたは高度なTRPGゲームマスターAIです。

# 重要: 出力形式 (JSONのみ)
以下のJSON形式で出力してください。挨拶やマークダウンは不要です。
{
  "tableTalk": [ { "speaker": "名前", "text": "...", "gender": "male/female/gm" } ],
  "story": "【Scene X-Y: タイトル】物語本文...",
  "location": "現在の場所名（例: 放課後の教室/夕暮れ）。移動がない場合は維持。",
  "options": ["選択肢1", "選択肢2", "選択肢3"]
}

# 基本ルール
1. **TableTalk (重要):**
   - **GMの発言:** speakerは必ず「GM」とすること。（「神田」「田中」などの固有名詞は禁止）。
   - **他PLの発言:** ランダムな日本人名（漢字/ひらがな）。
2. **location:** 画像生成用に「場所名+雰囲気」を短く出力。
3. **Story:** ゲーム内の物語。登場人物名はカタカナ。
4. **名前:** ユーザー名は認知済みとして扱う（聞き返し禁止）。

${isFirstMessage ? `
# 【最重要】初回スタート時の進行ルール
これに従ってゲームを開始してください：

1. **ランダムNPC生成:**
   - 毎回異なる名前・性格のNPCプレイヤーを2名生成する。
2. **TableTalk (自己紹介):**
   - **GM:** 「みなさん、こんにちは。今回のGMを務めます。」と挨拶する（名前は名乗らない）。
   - **NPC1 & NPC2:** 自分の役割（設定）を含めて自己紹介する。
   - 最後にGMがユーザーに自己紹介を促す。
3. **Story (プロローグ):**
   - **【Scene 1-1: プロローグ】** から始める。
   - **まだ事件は起こさない。** 舞台の情景描写に徹する。
4. **Options (役割選択):**
   - ユーザーが自分の「役割」や「立ち位置」を決めるための選択肢を出す。
` : `
# 通常ターンのルール
- ユーザーが自己紹介や行動をしたら、**Phase B（事件発生）** へ移行し、物語を動かす。
- storyには必ず【Scene X-Y: タイトル】をつける。
`}

現在の設定: ${getWorldSettingDescription(worldSetting)}
`

  const apiKey = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_OPENROUTER_API_KEY 
    : process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY

  if (!apiKey) throw new Error('API Key mismatch')

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.speaker === 'user' ? 'user' as const : 'assistant' as const,
        content: `${msg.name}: ${msg.message}`
      })),
      { role: 'user' as const, content: userInput }
    ]

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'TRPG Chat Game',
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.9, max_tokens: 4000 }),
    })

    if (!response.ok) throw new Error('API Error')

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    // JSON抽出と修復
    let jsonText = content.replace(/^```json\s*|\s*```$/g, '').trim()
    const firstBrace = jsonText.indexOf('{')
    const lastBrace = jsonText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1)
    }

    let parsed: OpenRouterResponse
    try {
      parsed = JSON.parse(jsonrepair(jsonText))
    } catch (e) {
      console.error('Parse error', e)
      throw new Error('AI Response Parse Error')
    }

    // locationの補正
    if (!parsed.location || typeof parsed.location !== 'string') {
      parsed.location = '不明な場所'
    }

    return parsed
  } catch (error) {
    console.error(error)
    throw error
  }
}