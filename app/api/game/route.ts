import { OpenAI } from 'openai'
import { NextResponse } from 'next/server'
// import { GAME_CONFIG } from '@/app/lib/config' // 必要に応じてコメントアウトを解除

// レスポンスの型定義
interface GameResponse {
  story: string;
  tableTalk: { speaker: string; name: string; text: string; gender?: string }[];
  options: string[];
  location: string;
  imagePrompt?: string;
}

export async function POST(req: Request) {
  console.log("★API処理開始: route.ts");

  try {
    const body = await req.json()
    const { playerName, worldSetting, userInput, conversationHistory } = body

    // 1. 環境変数のチェック
    const apiKey = process.env.OPENROUTER_API_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'TRPG Game'
    // モデル名はここで直接指定するか、configから読み込む
    const aiModel = 'google/gemini-2.0-flash-exp'; 

    if (!apiKey) {
      console.error("API Keyが見つかりません");
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 })
    }

    // 2. OpenAIクライアントの初期化 (OpenRouter接続)
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': siteUrl,
        'X-Title': siteName,
      },
    })

    // 3. 世界設定の定義
    const worldPrompts = {
      academy: "現代学園ミステリー。プレイヤーは学生。日常に潜む謎や怪異を追う。トーンは青春・少しシリアス。",
      sf: "サイバーパンクSF。プレイヤーはハッカーや傭兵。AI、電脳、巨大企業が支配する世界。トーンはハードボイルド。",
      fantasy: "王道ファンタジー。剣と魔法の世界。冒険者として魔物と戦う。トーンは冒険活劇。"
    }
    const currentWorldPrompt = worldPrompts[worldSetting as keyof typeof worldPrompts] || worldPrompts.academy

    // 4. システムプロンプト（AIへの指示書）の構築
    const systemPrompt = `
    あなたはTRPGのゲームマスター(GM)です。以下の設定でゲームを進行してください。
    
    【世界設定】
    ${currentWorldPrompt}
    プレイヤー名: ${playerName}

    【重要：NPCの生成とロールプレイ】
    - ゲーム開始時（または会話履歴からNPCがいないと判断できる場合）、その世界観に合った**「架空のプレイヤーキャラクター(NPC)」をランダムに2名**生成し、AIが操作してください。
    - 名前、性格、口調、役割（部活や職業）は毎回ランダムに決定すること。
    - NPCもプレイヤーと同様に、推理したり、戦ったり、感想を述べたりします。

    【ゲーム進行ルール】
    1. **オープニング進行**:
       - 履歴がない場合、GMの導入→NPC A自己紹介→NPC B自己紹介→プレイヤーへの促し、の順で進行してください。
    
    2. **エンディングの分岐（最重要）**:
       - 物語が**「事件解決」「問題解決」「ハッピーエンド」「バッドエンド」**のいずれかの状態に達した、あるいは区切りがついたと判断した場合、必ず選択肢の最後に**「エンディングを迎える」**という選択肢を追加してください。
       - ユーザーが「エンディングを迎える」を選択した場合：
         - storyフィールドには、「エンディング」または「エピローグ」という言葉を含めて、物語の結末を描写してください。
         - imagePromptフィールドには、そのラストシーンを象徴する**感動的で美しい情景描写（英語）**を必ず出力してください。

    【出力フォーマット (JSON)】
    必ず以下のJSON形式で出力してください。Markdownのコードブロックは不要です。

    {
      "story": "小説パートの文章。キャラクターのセリフも含む。",
      "tableTalk": [
        {"speaker": "GM", "name": "GM", "text": "GMの発言", "gender": "gm"},
        {"speaker": "NPC", "name": "キャラ名", "text": "NPCのメタ発言", "gender": "male/female"} 
      ],
      "location": "現在の場所名",
      "options": ["選択肢1", "選択肢2", "選択肢3"],
      "imagePrompt": "A detailed english description of the current scene for image generation."
    }

    - imagePromptは、**オープニング（開始時）**と**エンディング（終了時）**では必ず出力してください。それ以外でもシーンが大きく変わった時は出力してください。
    `

    // 5. 会話履歴の整形 (直近20件)
    const recentHistory = conversationHistory ? conversationHistory.slice(-20).map((msg: any) => {
       return `${msg.speaker === 'user' ? 'プレイヤー' : 'GM'}: ${msg.message}`;
    }).join("\n") : "";

    // 6. AIへのリクエスト実行
    const completion = await openai.chat.completions.create({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `これまでの会話履歴:\n${recentHistory}\n\nプレイヤーの行動: ${userInput}\n\nJSON形式でレスポンスを生成してください。` }
      ],
      response_format: { type: "json_object" }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('No content received from AI')

    // 7. 結果のパースと返却
    const parsedContent = JSON.parse(content)
    console.log("★AI応答成功:", parsedContent.location); // デバッグ用ログ

    return NextResponse.json(parsedContent)

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}