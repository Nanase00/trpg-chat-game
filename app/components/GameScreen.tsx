'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { GameMessage, GameState, WorldSetting } from '../types/game'
import { GAME_CONFIG } from '@/app/lib/config'
import GameField from './GameField'
import TableTalk from './TableTalk'
import GameOptions from './GameOptions'

interface GameScreenProps {
  worldSetting: WorldSetting
  playerName: string
  onReset?: () => void
}

export default function GameScreen({ worldSetting, playerName, onReset }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>({
    worldSetting,
    playerName,
    messages: [],
    fieldStory: '',
    options: [],
    isGameStarted: true,
  })
  
  const [isUiHidden, setIsUiHidden] = useState(false);
  const imageCacheRef = useRef<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'tableTalk' | 'story' | 'options' | 'done'>('idle')
  
  const [pendingTableTalk, setPendingTableTalk] = useState<Array<{ speaker: string; text: string; gender?: 'male' | 'female' | 'gm' }>>([])
  const [displayedTableTalk, setDisplayedTableTalk] = useState<Array<{ speaker: string; text: string; gender?: 'male' | 'female' | 'gm'; displayedText: string; isTyping: boolean }>>([])
  
  // ★重要: ループ防止用のRef
  const displayedTableTalkRef = useRef(displayedTableTalk);

  const [displayedStory, setDisplayedStory] = useState('')
  const [displayedOptions, setDisplayedOptions] = useState<Array<{ text: string; displayedText: string; isTyping: boolean }>>([])
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [isFirstIntroduction, setIsFirstIntroduction] = useState(true)

  useEffect(() => {
    displayedTableTalkRef.current = displayedTableTalk;
  }, [displayedTableTalk]);
  
  // アニメーション用Ref
  const tableTalkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const storyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentTableTalkIndexRef = useRef(0)
  const currentTableTalkCharIndexRef = useRef(0)
  const currentStoryCharIndexRef = useRef(0)
  const currentOptionIndexRef = useRef(0)
  const currentOptionCharIndexRef = useRef(0)
  const isInitializedRef = useRef(false)

  const addMessage = useCallback((speaker: string, name: string, message: string, gender?: any) => {
    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: Date.now().toString(),
        speaker, name, message, timestamp: new Date(), gender
      }]
    }))
  }, [])

  const generateImageFromPrompt = useCallback(async (imagePrompt: string) => {
    if (!GAME_CONFIG.ENABLE_AI_IMAGES || !imagePrompt) return;
    if (imageCacheRef.current[imagePrompt]) {
      setCurrentImageUrl(imageCacheRef.current[imagePrompt]);
      return;
    }
    try {
      setIsGeneratingImage(true);
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePrompt }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        imageCacheRef.current[imagePrompt] = data.imageUrl;
        setCurrentImageUrl(data.imageUrl);
      }
    } catch (e) {
      console.error("Image fetch failed", e);
    } finally {
      setIsGeneratingImage(false);
    }
  }, []);

  const handleUserInput = useCallback(async (input: string, isOptionSelection: boolean = false) => {
    if (!input.trim() || isLoading) return
    
    setIsLoading(true)
    setShowOptions(false)
    setUserInput('')

    // 1. 表示中の会話をアーカイブ
    const currentTalk = displayedTableTalkRef.current;
    const messagesToArchive: GameMessage[] = currentTalk.map((talk, index) => ({
      id: `archived-${Date.now()}-${index}`,
      speaker: talk.speaker === 'GM' ? 'gm' : (talk.speaker === playerName ? 'user' : 'gm'),
      name: talk.speaker,
      message: talk.text,
      timestamp: new Date(),
      gender: talk.gender,
    }));

    // 2. 新規メッセージ作成
    let userNewMessage: GameMessage | null = null;
    let newDisplayedTalk: typeof displayedTableTalk = [];

    if (isOptionSelection) {
      newDisplayedTalk = [{
        speaker: playerName,
        text: input,
        displayedText: input,
        isTyping: false,
        gender: undefined,
      }];
    } else if (input !== 'start') {
      userNewMessage = {
        id: `user-${Date.now()}`,
        speaker: 'user',
        name: playerName,
        message: input,
        timestamp: new Date(),
      };
    }

    // 3. 状態更新（重複防止付き）
    setGameState(prev => {
      const lastMsg = prev.messages[prev.messages.length - 1];
      const newArchive = messagesToArchive.filter(m => {
          if (!lastMsg) return true;
          return !(lastMsg.name === m.name && lastMsg.message === m.message);
      });

      const newMessages = [...prev.messages, ...newArchive];
      if (userNewMessage) {
        newMessages.push(userNewMessage);
      }
      return { ...prev, messages: newMessages };
    });

    setDisplayedTableTalk(newDisplayedTalk);

    try {
      const historySource = [...gameState.messages, ...messagesToArchive];
      if (userNewMessage) historySource.push(userNewMessage);
      const recentHistory = historySource.slice(-20).map(m => ({ speaker: m.speaker, name: m.name, message: m.message }));
      
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, worldSetting, userInput: input, conversationHistory: recentHistory }),
      });

      if (!res.ok) throw new Error('API Error');
      const response = await res.json();

      const isFirstMessage = input === 'start' || gameState.messages.length === 0
      const storyText = response.story || ''
      const isEnding = storyText.includes('エピローグ') || storyText.includes('エンディング') || storyText.includes('最終話')
      
      if (GAME_CONFIG.ENABLE_AI_IMAGES && response.imagePrompt) {
        if (isFirstMessage || isEnding) {
          generateImageFromPrompt(response.imagePrompt)
        }
      }

      const isUserIntroductionInput = input !== 'start' && (
        input.includes('名乗る') || input.includes('挨拶') || input.includes('自己紹介') || input.includes('生徒会')
      )
      const isIntroductionOption = response.options?.some((opt: string) => 
        opt.includes('名乗る') || opt.includes('挨拶') || opt.includes('自己紹介')
      )
      if (isFirstIntroduction && (isUserIntroductionInput || (!isIntroductionOption && input !== 'start'))) {
        setIsFirstIntroduction(false)
      }

      setGameState(prev => ({
        ...prev,
        fieldStory: response.story,
        options: response.options
      }))

      currentTableTalkIndexRef.current = 0
      currentTableTalkCharIndexRef.current = 0
      currentStoryCharIndexRef.current = 0
      currentOptionIndexRef.current = 0
      currentOptionCharIndexRef.current = 0

      if (response.tableTalk?.length) {
        setPendingTableTalk(response.tableTalk)
        setAnimationPhase('tableTalk')
      } else {
        setAnimationPhase('story')
      }
      
      setDisplayedStory('')
      setDisplayedOptions([])

    } catch (e) {
      console.error(e)
      addMessage('gm', 'GM', 'エラーが発生しました')
      setShowOptions(true)
    } finally {
      setIsLoading(false)
    }
  }, [playerName, worldSetting, gameState.messages, isLoading, addMessage, generateImageFromPrompt, isFirstIntroduction]);

  // アニメーションuseEffect群
  useEffect(() => {
    if (animationPhase !== 'tableTalk' || pendingTableTalk.length === 0) return
    if (tableTalkTimeoutRef.current) clearTimeout(tableTalkTimeoutRef.current)

    const animate = () => {
      const msgIdx = currentTableTalkIndexRef.current
      const charIdx = currentTableTalkCharIndexRef.current

      if (msgIdx >= pendingTableTalk.length) {
        setPendingTableTalk([])
        setAnimationPhase('story')
        return
      }

      const currentMessage = pendingTableTalk[msgIdx]
      const fullText = currentMessage.text || ''

      if (charIdx === 0) {
        setDisplayedTableTalk(prev => [
          ...prev,
          {
            speaker: currentMessage.speaker,
            text: fullText,
            gender: currentMessage.gender,
            displayedText: '',
            isTyping: true,
          }
        ])
      }

      if (charIdx < fullText.length) {
        setDisplayedTableTalk(prev => {
          const newArr = [...prev]
          const lastIdx = newArr.length - 1
          if (lastIdx >= 0 && newArr[lastIdx].speaker === currentMessage.speaker) {
            newArr[lastIdx] = {
              ...newArr[lastIdx],
              displayedText: fullText.slice(0, charIdx + 1),
              isTyping: true,
            }
          }
          return newArr
        })
        currentTableTalkCharIndexRef.current++
        tableTalkTimeoutRef.current = setTimeout(animate, 30)
      } else {
        setDisplayedTableTalk(prev => {
          const newArr = [...prev]
          const lastIdx = newArr.length - 1
          if (lastIdx >= 0) newArr[lastIdx].isTyping = false
          return newArr
        })
        setTimeout(() => {
          currentTableTalkIndexRef.current++
          currentTableTalkCharIndexRef.current = 0
          animate()
        }, 500)
      }
    }
    animate()
    return () => { if (tableTalkTimeoutRef.current) clearTimeout(tableTalkTimeoutRef.current) }
  }, [animationPhase, pendingTableTalk])

  useEffect(() => {
    if (animationPhase !== 'story' || !gameState.fieldStory) return
    if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current)

    const fullText = gameState.fieldStory.replace(/\\n/g, '\n').replace(/\\n\\n/g, '\n\n')
    let currentCharIndex = currentStoryCharIndexRef.current

    const animate = () => {
      if (currentCharIndex < fullText.length) {
        setDisplayedStory(fullText.slice(0, currentCharIndex + 1))
        currentCharIndex++
        currentStoryCharIndexRef.current = currentCharIndex
        storyTimeoutRef.current = setTimeout(animate, 40)
      } else {
        setAnimationPhase('options')
      }
    }
    setDisplayedStory('')
    currentStoryCharIndexRef.current = 0
    animate()
    return () => { if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current) }
  }, [animationPhase, gameState.fieldStory])

  useEffect(() => {
    if (animationPhase !== 'options' || gameState.options.length === 0) return
    if (optionsTimeoutRef.current) clearTimeout(optionsTimeoutRef.current)

    const animate = () => {
      const optIdx = currentOptionIndexRef.current
      const charIdx = currentOptionCharIndexRef.current

      if (optIdx >= gameState.options.length) {
        setAnimationPhase('done')
        setShowOptions(true)
        return
      }

      const currentOption = gameState.options[optIdx]
      const fullText = currentOption || ''

      if (charIdx === 0) {
        setDisplayedOptions(prev => [...prev, { text: fullText, displayedText: '', isTyping: true }])
      }

      if (charIdx < fullText.length) {
        setDisplayedOptions(prev => {
          const newArr = [...prev]
          const lastIdx = newArr.length - 1
          if (lastIdx >= 0) newArr[lastIdx].displayedText = fullText.slice(0, charIdx + 1)
          return newArr
        })
        currentOptionCharIndexRef.current++
        optionsTimeoutRef.current = setTimeout(animate, 30)
      } else {
        setDisplayedOptions(prev => {
          const newArr = [...prev]
          const lastIdx = newArr.length - 1
          if (lastIdx >= 0) newArr[lastIdx].isTyping = false
          return newArr
        })
        setTimeout(() => {
          currentOptionIndexRef.current++
          currentOptionCharIndexRef.current = 0
          animate()
        }, 300)
      }
    }
    setDisplayedOptions([])
    currentOptionIndexRef.current = 0
    currentOptionCharIndexRef.current = 0
    animate()
    return () => { if (optionsTimeoutRef.current) clearTimeout(optionsTimeoutRef.current) }
  }, [animationPhase, gameState.options])

  const initializeGame = useCallback(async () => {
    if (isInitializedRef.current) return
    if (gameState.messages.length > 0) {
      isInitializedRef.current = true
      return
    }
    isInitializedRef.current = true
    await handleUserInput('start')
  }, [gameState.messages.length, handleUserInput])

  useEffect(() => {
    if (isInitializedRef.current) return
    if (gameState.messages.length === 0) initializeGame()
  }, [])

  const handleReset = useCallback(() => {
    imageCacheRef.current = {};
    setCurrentImageUrl(null);
    setIsFirstIntroduction(true);
    isInitializedRef.current = false;
    if (onReset) onReset()
    else window.location.reload()
  }, [onReset])

  return (
    <div className="h-screen flex flex-col bg-dark-bg p-2 md:p-4 gap-2 md:gap-4 relative overflow-hidden">
      {currentImageUrl && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
          style={{ backgroundImage: `url(${currentImageUrl})`, opacity: isUiHidden ? 1 : 0.3 }}
        />
      )}
      <div className={`absolute inset-0 bg-black/60 z-0 transition-opacity ${isUiHidden ? 'opacity-0' : 'opacity-100'}`} />

      <div className="absolute top-2 right-2 z-50 flex gap-2">
        <button 
          onMouseDown={() => setIsUiHidden(true)} 
          onMouseUp={() => setIsUiHidden(false)}
          onMouseLeave={() => setIsUiHidden(false)}
          onTouchStart={(e) => { setIsUiHidden(true); }}
          onTouchEnd={(e) => { e.preventDefault(); setIsUiHidden(false); }}
          onContextMenu={(e) => e.preventDefault()}
          className="px-3 py-1.5 bg-gray-800/90 text-white rounded border border-gray-600 text-xs md:text-sm shadow-lg select-none active:bg-gray-700"
        >
          👁️ 画像
        </button>
        <button onClick={handleReset} className="px-3 py-1.5 bg-red-600/90 text-white rounded text-xs md:text-sm shadow-lg">
          TOP
        </button>
      </div>

      <div className={`relative z-10 flex flex-col h-full gap-2 md:gap-4 transition-opacity ${isUiHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* メインレイアウトコンテナ */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 min-h-0">
          
          {/* 【レイアウト修正ポイント】
            スマホ(default): 
              - flex-col
              - TableTalk (上) -> order-1, flex-[0.35] (高さ35%)
              - Field+Options (下) -> order-2, flex-[0.65] (高さ65%)
            PC(md): 
              - flex-row
              - TableTalk (左) -> order-1, flex-[0.35] (幅35%)
              - Field+Options (右) -> order-2, flex-[0.65] (幅65%)
          */}

          {/* 1. テーブルトーク (上/左) */}
          <div className="order-1 md:order-1 flex-[0.35] md:flex-[0.35] min-h-0 flex flex-col bg-black/20 rounded overflow-hidden">
             <TableTalk 
               messages={gameState.messages} 
               displayedTableTalk={displayedTableTalk} 
               animationPhase={animationPhase as any} 
               playerName={playerName} 
             />
          </div>

          {/* 2. フィールド & 選択肢 (下/右) */}
          <div className="order-2 md:order-2 flex-[0.65] md:flex-[0.65] flex flex-col gap-2 min-h-0">
            {/* フィールド: 残りのスペースを全て使う (flex-1) */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <GameField displayedStory={displayedStory} animationPhase={animationPhase as any} imageUrl={null} isGeneratingImage={isGeneratingImage} />
            </div>
            {/* 選択肢 & 入力: 下部に配置 */}
            <div className="mt-auto flex flex-col gap-2 p-1">
               <div className={`${showOptions ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                 <GameOptions 
                   options={gameState.options} 
                   onSelect={o => {setShowOptions(false); handleUserInput(o, true)}} 
                   isLoading={isLoading} 
                   animationPhase={animationPhase} 
                   originalOptions={gameState.options}
                   displayedOptions={displayedOptions}
                 />
               </div>
               <div className="flex gap-2">
                 <input 
                   value={userInput} 
                   onChange={e => setUserInput(e.target.value)} 
                   disabled={isLoading || isFirstIntroduction} 
                   className="flex-1 px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 focus:border-blue-500 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed" 
                   placeholder={isFirstIntroduction ? "まずは選択肢から選んでください" : "自由記入..."} 
                 />
                 <button 
                   onClick={() => handleUserInput(userInput)} 
                   disabled={isLoading || isFirstIntroduction} 
                   className="px-4 py-2 bg-blue-600 rounded text-white font-bold text-sm md:text-base whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   送信
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}