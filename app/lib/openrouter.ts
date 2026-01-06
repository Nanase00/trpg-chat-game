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
  
  // 会話履歴に既にプロローグや自己紹介が含まれているかチェック（重複チェックを厳格化）
  const hasPrologue = conversationHistory.some(msg => {
    const isGM = msg.speaker === 'gm' || msg.speaker === 'assistant' || msg.name === 'GM'
    if (!isGM) return false
    return msg.message.includes('プロローグ') || 
           msg.message.includes('GMを務めます') || 
           msg.message.includes('GMを務めさせていただきます') ||
           msg.message.includes('舞台は') ||
           msg.message.includes('今回のGM') ||
           msg.message.includes('謎解きの物語')
  })
  
  // 自己紹介のチェックをより厳格に
  const hasPlayer1 = conversationHistory.some(msg => {
    // プレイヤー1（男性）の自己紹介を検出
    const isMalePlayer = msg.name && msg.name.match(/^[一-龠]{2,4}$/) && msg.name !== 'GM'
    const hasIntroduction = msg.message.includes('です') && msg.message.match(/[一-龠]{2,4}です/)
    return isMalePlayer || hasIntroduction
  })
  
  const hasPlayer2 = conversationHistory.some(msg => {
    // プレイヤー2（女性）の自己紹介を検出
    const isFemalePlayer = msg.name && msg.name.match(/^[一-龠]{2,4}$/) && msg.name !== 'GM'
    const hasIntroduction = msg.message.includes('です') && msg.message.match(/[一-龠]{2,4}です/)
    return isFemalePlayer || hasIntroduction
  })
  
  const hasGMQuestion = conversationHistory.some(msg => {
    const isGM = msg.speaker === 'gm' || msg.speaker === 'assistant' || msg.name === 'GM'
    return isGM && (msg.message.includes('どんなキャラクターで参加') || msg.message.includes('参加しますか'))
  })
  
  const hasUserIntroduction = conversationHistory.some(msg =>
    msg.speaker === 'user' && (
      msg.message.includes('名乗る') ||
      msg.message.includes('挨拶') ||
      msg.message.includes('自己紹介') ||
      msg.message.includes('生徒会') ||
      msg.message.includes('転校生') ||
      msg.message.includes('帰宅部') ||
      msg.message.includes('探偵') ||
      msg.message.includes('キャラクター')
    )
  )
  
  // 自己紹介が完了しているか（プレイヤー1とプレイヤー2の両方が自己紹介し、GMが質問している、またはユーザーが自己紹介している）
  const hasIntroduction = (hasPlayer1 && hasPlayer2 && hasGMQuestion) || hasUserIntroduction
  
  // 初回メッセージでも、既にプロローグや自己紹介が含まれている場合は通常ターンとして扱う
  // より厳格なチェック: プロローグがある、または自己紹介がある、またはユーザーが自己紹介している場合は初回ルールを適用しない
  const shouldUseFirstMessageRules = isFirstMessage && !hasPrologue && !hasIntroduction && !hasUserIntroduction && !hasPlayer1 && !hasPlayer2 && !hasGMQuestion
  
  // デバッグ用ログ
  if (isFirstMessage) {
    console.log('[初回判定] hasPrologue:', hasPrologue, 'hasPlayer1:', hasPlayer1, 'hasPlayer2:', hasPlayer2, 'hasGMQuestion:', hasGMQuestion, 'hasUserIntroduction:', hasUserIntroduction, 'shouldUseFirstMessageRules:', shouldUseFirstMessageRules, 'history length:', conversationHistory.length)
  }

  // System Prompt: TRPG GMとしての役割と厳格な出力ルール
  const systemPrompt = `あなたは高度なTRPGゲームマスターAIです。プレイヤーと一緒に物語を紡いでいきます。

# 重要: 出力形式 (JSONのみ)
以下のJSON形式で出力してください。挨拶やマークダウンは不要です。
{
  "tableTalk": [ { "speaker": "名前", "text": "...", "gender": "male/female/gm" } ],
  "story": "【Scene X-Y: タイトル】物語本文...",
  "location": "現在の場所名（例: 放課後の教室/夕暮れ）。移動がない場合は維持。",
  "options": ["選択肢1", "選択肢2", "選択肢3"],
  "imagePrompt": "A fantasy style painting of a dark, ruined stone chamber lit by a glowing magical sword."
}

# 出力フィールドの厳格な分離ルール

## 1. story フィールド（小説パート・重要：文章量を増やす）
**ここに含めるもの（必須）:**
- ✅ キャラクターのセリフ（「」で囲まれるもの）全て（NPC、プレイヤーキャラ問わず）
- ✅ **キャラクター同士の掛け合いや会話を多めに展開すること（重要）**
- ✅ 情景描写（場所、時間、雰囲気など）
- ✅ アクションの結果（「レンは走った」「アユミが叫んだ」など）
- ✅ **物語の進行を具体的に、詳細に展開すること（重要）**
- ✅ キャラクターの行動や表情の描写
- ✅ **最低でも5〜7文以上、読み応えのあるテキストにすること**

**文章量の目安:**
- 短すぎる例（NG）: 「レンは走った。アユミが叫んだ。敵が現れた。」（3文で終わる）
- 適切な例（OK）: 「レンは走った。アユミが『待って！』と叫びながら後を追う。『危ない！』と警告する声が響く。その時、茂みの奥から不気味な影が現れた。レンは剣を構え、アユミは杖を握りしめる。緊張が走る空気の中、敵の正体が明らかになる...」（6文以上、掛け合いと展開を含む）

**ここに含めないもの（禁止）:**
- ❌ GMとしてのメタ的なコメント
- ❌ ルールの説明
- ❌ プレイヤーへの直接的な呼びかけ

## 2. tableTalk フィールド（雑談パート）
**ここに含めるもの（必須）:**
- ✅ GMとしての裁定（例：「判定成功です！」）
- ✅ GMからプレイヤーへのメタ的なコメント（例：「危なかったですねｗ」）
- ✅ NPCプレイヤーとしてのメタ発言（例：「判定厳しいｗ」「この展開面白い！」）
- ✅ ルールの説明や状況の補足

**ここに含めないもの（厳格に禁止）:**
- ❌ キャラクターのセリフ（「」で囲まれるもの）は一切禁止
- ❌ 物語の進行や展開の描写
- ❌ 情景描写
- ❌ キャラクターになりきって話すこと

**重要:** tableTalkは「現実世界のGMとプレイヤーの会話」であり、「ゲーム内の物語」ではありません。

## 3. options フィールド
- **必ず3つ**の選択肢を出力すること。
- 選択肢が3つ未満の場合は、適切に補完すること。

## 4. imagePrompt フィールド（画像生成用・必須）
- **必須:** 現在のシーンの情景やハイライトを視覚的に表現するための、**短く具体的で、描写力のある英語のプロンプト**を生成すること。
- 現在のシーンの雰囲気、場所、光、色、スタイルなどを含めること。
- 例: "A fantasy style painting of a dark, ruined stone chamber lit by a glowing magical sword."
- 例: "Modern Japanese school classroom at sunset, warm orange light streaming through windows, empty desks."
- 例: "Cyberpunk cityscape at night, neon lights reflecting on wet streets, futuristic skyscrapers."

## 5. location フィールド
- 現在のシーンを表す短い場所名（例：「放課後の教室」「夕暮れの森」）。
- シーンが変わる時だけ更新すること。

# 基本ルール（重要：プレイヤーとキャラクターの分離）

## 世界観の構造
このTRPGは「現実世界のプレイヤーたちが集まって、ゲーム内のキャラクターを操作する」という構成です。
- **TableTalk（テーブルトーク）:** 現実世界のプレイヤーたち（漢字名）がTRPGをプレイしている
- **Story（フィールド）:** ゲーム内のキャラクターたち（カタカナ名）が物語を進める
- **重要:** プレイヤーとキャラクターは別の存在であり、職業や性格は一致していない。

1. **TableTalk の話者（現実世界のプレイヤー・重要・厳格に守ること）:**
   - **GMの発言:** speakerは必ず「GM」とすること。
   - **NPCプレイヤーの発言:** **必ず漢字のフルネーム（苗字+名前）**を使用すること。苗字だけや名前だけは禁止。ひらがなやカタカナは禁止。
   - **毎回ランダムに異なる名前を生成すること。** 固定の名前（例：「田中健太」「佐藤美咲」）を繰り返し使わないこと。
   - 例: 「田中健太」「佐藤美咲」「鈴木翔太」「山田優花」「高橋龍也」「伊藤美月」など
   - **プレイヤーたちは「このTRPGをするために集まった」という設定で振る舞うこと。**
   - **重要:** プレイヤー名は毎回異なる組み合わせで生成し、被らないようにすること。
   - 例: 「今日もTRPGやるの楽しみだな！」「このシナリオ面白そう！」「自分のキャラどうしようかな」など

2. **Story の登場人物（ゲーム内のキャラクター・重要・厳格に守ること）:**
   - ゲーム内の物語では、登場人物名は**必ずカタカナで表記**すること。
   - **毎回ランダムに異なる名前を生成すること。** 固定の名前（例：「レン」「アユミ」）を繰り返し使わないこと。
   - 例: 「レン」「アユミ」「カイト」「サクラ」「リュウ」「ハルカ」など
   - **重要:** テーブルトークのプレイヤー（漢字のフルネーム）とStoryのキャラクター（カタカナ名）は**対として一致させること**。
   - 例: プレイヤー「田中健太」→ キャラクター「レン」、プレイヤー「佐藤美咲」→ キャラクター「アユミ」
   - **プレイヤーとキャラクターは対として固定し、同じプレイヤーは常に同じキャラクターを操作すること。**
   - **プレイヤー「田中健太」の職業とキャラクター「レン」の職業は一致していないこと（プレイヤーは現実世界の人、キャラクターはゲーム内の役割）。**

3. **ユーザー名:**
   - ユーザー名は認知済みとして扱う（聞き返し禁止）。

${shouldUseFirstMessageRules ? `
# 【最重要】初回スタート時の進行ルール
**最重要:** 会話履歴が**完全に空**の場合のみ、このルールに従ってゲームを開始してください。
**会話履歴に既にプロローグや自己紹介が含まれている場合は、このルールを適用せず、通常ターンのルールに従ってください。**

**会話履歴の確認方法（重要）:**
1. 会話履歴に「GMを務めます」「舞台は」「謎解きの物語」が含まれているか確認
2. 会話履歴にプレイヤー1（男性）の自己紹介（「○○です」など）が含まれているか確認
3. 会話履歴にプレイヤー2（女性）の自己紹介（「○○です」など）が含まれているか確認
4. 会話履歴に「どんなキャラクターで参加しますか」などのGMの質問が含まれているか確認
5. 会話履歴にユーザーの自己紹介（「名乗る」「挨拶」など）が含まれているか確認

**上記のいずれかが含まれている場合は、このルールを適用せず、通常ターンのルールに従ってください。**

これに従ってゲームを開始してください：

## 1. ランダムNPC生成（重要・厳格に守ること・1回のみ）
- **現実世界のプレイヤー（NPC）をランダムに2名**生成すること。
- **プレイヤー1（男性）:** 漢字のフルネーム（苗字+名前）を生成（例：「田中健太」「鈴木翔太」「山田達也」など）
- **プレイヤー2（女性）:** 漢字のフルネーム（苗字+名前）を生成（例：「佐藤美咲」「石川優子」「高橋千尋」など）
- **重要:** プレイヤー名は毎回異なる組み合わせで生成し、被らないようにすること。
- **ゲーム内のキャラクター名（カタカナ）:** プレイヤー名の「名前部分」をカタカナ表記に変換
  - プレイヤー1「田中健太」→ キャラクター1「ケンタ」（または「タクミ」など、名前部分をカタカナ化）
  - プレイヤー2「佐藤美咲」→ キャラクター2「ミサキ」（または「ユキ」など、名前部分をカタカナ化）
- **重要:** プレイヤーとキャラクターは対として固定し、同じプレイヤーは常に同じキャラクターを操作すること。

## 2. TableTalk（自己紹介）の順序（厳守・1回のみ・絶対に繰り返さない）
**最重要:** 会話履歴を確認し、既にプロローグや自己紹介が行われている場合は、**絶対にこの順序を実行しないこと。** 物語を進めること。

**会話履歴に以下のいずれかが含まれている場合は、自己紹介をスキップすること（重要）:**
- GMが「GMを務めます」「舞台は」「謎解きの物語」などのプロローグを語っている
- GMが「どんなキャラクターで参加しますか」「参加しますか」などと自己紹介を促している
- プレイヤー1（男性）が「○○です」などと自己紹介している（漢字のフルネームが含まれている）
- プレイヤー2（女性）が「○○です」などと自己紹介している（漢字のフルネームが含まれている）
- ユーザーが自己紹介の選択肢を選んでいる（「名乗る」「挨拶」「自己紹介」などが含まれている）
- プレイヤー名（漢字のフルネーム）が既に登場している

**会話履歴を確認する際は、上記の条件をすべてチェックし、1つでも該当する場合は自己紹介をスキップすること。**

会話履歴が**完全に空**の場合のみ、以下の順序で**必ず1回だけ**出力すること：

1. **GM:** 挨拶とGMとしての自己紹介と今回の物語のプロローグ（謎解きとして紹介）
   - 例：「みなさん、こんにちは。今回のGMを務めます。舞台は現代日本の学園です。静かな学校に、不可解な出来事の影が忍び寄る...そんな謎解きの物語を紡いでいきましょう。」

2. **プレイヤー1（男性）:** 漢字のフルネーム（苗字+名前）を名乗る
   - 例：「田中健太です。よろしくお願いします！」

3. **プレイヤー2（女性）:** 漢字のフルネーム（苗字+名前）を名乗る
   - 例：「佐藤美咲です。よろしくお願いします！」

4. **GM:** ユーザープレイヤーが記入した名前を表記して、どんなキャラクターで参加するかを聞く
   - 例：「では、[ユーザー名]さん、あなたはどんなキャラクターで参加しますか？」

**会話履歴に既に自己紹介が含まれている場合（最重要）:**
- **絶対にプロローグや自己紹介を再度行わないこと**
- **既に登場したプレイヤー名（漢字のフルネーム）とキャラクター名（カタカナ）の対応を維持すること**
- ユーザーの入力に基づいて物語を進めること
- 既存のプレイヤー名やキャラクター名を変更しないこと

## 3. Story（プロローグ）
- **【Scene 1-1: プロローグ】** から始めること。
- **プレイヤー1の名前部分をカタカナ表記でキャラクター1として操作**
- **プレイヤー2の名前部分をカタカナ表記でキャラクター2として操作**
- **プレイヤーユーザーは、選択した役割で操作**
- **まだ事件は起こさない。** 舞台の情景描写に徹すること。
- 例：「放課後の教室に、夕日が差し込んでいる。机の上には教科書が散らばり...」

## 4. Options（キャラクター選択）
- ユーザーが操作する「ゲーム内のキャラクターの役割」を決めるための選択肢を**必ず3つ**出すこと。
- **重要:** これは「プレイヤーの職業」ではなく「ゲーム内キャラクターの職業」を選ぶ選択肢であること。
- 例：
  1. 『正義感の強い生徒会長だ』と名乗る（キャラクター「レン」として）
  2. 『オカルト好きの転校生です』と挨拶する（キャラクター「アユミ」として）
  3. 『……ただの帰宅部だ』と無愛想に答える（キャラクター「カイト」として）
` : `
# 通常ターンのルール
- 会話履歴を尊重し、既存のNPC設定や物語の流れを維持すること。
- **最重要:** 会話履歴に既にプロローグや自己紹介が含まれている場合は、**絶対に再度行わないこと。**
  - 会話履歴に「GMを務めます」「舞台は」「謎解きの物語」が含まれている → プロローグを再度行わない
  - 会話履歴にプレイヤー1（男性）の自己紹介が含まれている → プレイヤー1の自己紹介を再度行わない
  - 会話履歴にプレイヤー2（女性）の自己紹介が含まれている → プレイヤー2の自己紹介を再度行わない
  - 会話履歴に「どんなキャラクターで参加しますか」が含まれている → GMの質問を再度行わない
  - ユーザーが自己紹介の選択肢を選んでいる → 自己紹介を再度促さない
- **最重要:** 既に登場したプレイヤー名（漢字のフルネーム）とキャラクター名（カタカナ）の対応を維持すること。名前を変更しないこと。
  - プレイヤー1「田中健太」→ キャラクター1「ケンタ」（名前部分をカタカナ化）
  - プレイヤー2「佐藤美咲」→ キャラクター2「ミサキ」（名前部分をカタカナ化）
- **storyでは、プレイヤー1の名前部分をカタカナ表記でキャラクター1として操作し、プレイヤー2の名前部分をカタカナ表記でキャラクター2として操作すること。**
- **重要:** ユーザーが自己紹介の選択肢を選んだら、自己紹介を再度促すのではなく、物語を進めること。
- ユーザーが自己紹介や行動をしたら、物語を動かすこと。
- storyには必ず【Scene X-Y: タイトル】をつけること。
- **storyフィールドは必ず5〜7文以上、キャラクターの掛け合いや物語の進行を多めに展開すること。**
- optionsは必ず3つ出力すること。
- **自己紹介が完了した後は、再度自己紹介を促す選択肢を出さないこと。**

## 自由入力（自由記入）への対応
- ユーザーが選択肢ではなく自由入力（自由記入）で何かを入力した場合：
  1. **tableTalk:** GMやNPCプレイヤー（漢字名）がその入力内容に対して反応、リアクション、賞賛、軽蔑などのメタ的なコメントをすること。
     - 例: 「おっと、その行動面白いですねｗ」「判定どうしますか？」「その選択、大胆ですね！」
  2. **story:** その入力内容に基づいて、**ゲーム内のキャラクター（カタカナ名）**の行動や会話、物語の展開を具体的に、詳細に描写すること。
     - 例: プレイヤー「健太」が「調査する」と入力 → キャラクター「レン」が調査する場面を描写
  3. 入力内容が物語にどう影響するかを明確に示すこと。
  4. **重要:** テーブルトークでは「プレイヤー（漢字名）が操作している」ということを意識したコメントをすること。

### プロローグ時（初回）の自由入力への対応（重要）
- **注意:** プロローグ時（初回）は自由記入は無効化されているため、通常は選択肢から選ぶことになる。
- 万が一、プロローグ時に何か入力があった場合でも、自己紹介の選択肢を選ぶまで自己紹介を促し続けること。
`}

現在の設定: ${getWorldSettingDescription(worldSetting)}
プレイヤー名: ${playerName}
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

    // imagePromptの補正（必須フィールド）
    if (!parsed.imagePrompt || typeof parsed.imagePrompt !== 'string') {
      // フォールバック: storyから簡易的なプロンプトを生成
      const storyText = parsed.story || ''
      const sceneMatch = storyText.match(/【Scene[^】]+】([\s\S]{0,100})/)
      if (sceneMatch) {
        parsed.imagePrompt = `A detailed scene: ${sceneMatch[1].substring(0, 100)}`
      } else {
        parsed.imagePrompt = `A detailed scene from the story: ${storyText.substring(0, 100)}`
      }
    }

    // optionsが3つ未満の場合は補完（必ず3つにする）
    if (!parsed.options || !Array.isArray(parsed.options)) {
      parsed.options = ['行動を選択', '様子を見る', '話しかける']
    } else if (parsed.options.length < 3) {
      // 不足分を補完
      const defaultOptions = ['行動を選択', '様子を見る', '話しかける']
      while (parsed.options.length < 3) {
        parsed.options.push(defaultOptions[parsed.options.length] || '行動する')
      }
    } else if (parsed.options.length > 3) {
      // 3つを超える場合は最初の3つだけ使用
      parsed.options = parsed.options.slice(0, 3)
    }

    return parsed
  } catch (error) {
    console.error(error)
    throw error
  }
}