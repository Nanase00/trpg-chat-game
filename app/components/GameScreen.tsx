'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { GameMessage, GameState, WorldSetting, OpenRouterResponse } from '../types/game'
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
  
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  
  const imageCacheRef = useRef<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'tableTalk' | 'story' | 'options' | 'done'>('idle')
  const [pendingTableTalk, setPendingTableTalk] = useState<any[]>([])
  const [displayedTableTalk, setDisplayedTableTalk] = useState<any[]>([])
  const [displayedStory, setDisplayedStory] = useState('')
  const [displayedOptions, setDisplayedOptions] = useState<string[]>([])
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  
  const currentTableTalkIndexRef = useRef(0)
  const currentTableTalkCharIndexRef = useRef(0)
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

  const generateImageDirectly = useCallback(async (locationText: string, reason: string) => {
    if (!GAME_CONFIG.ENABLE_AI_IMAGES || !locationText) return;

    if (imageCacheRef.current[locationText]) {
      console.log(`[画像] キャッシュ使用 (${reason}): ${locationText}`);
      setBgImageUrl(imageCacheRef.current[locationText]);
      return;
    }

    try {
      setIsGeneratingImage(true);
      console.log(`[★画像生成] APIコール実行 (${reason}): ${locationText}`);
      
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneText: locationText }),
      });
      
      const data = await res.json();
      if (data.imageUrl) {
        imageCacheRef.current[locationText] = data.imageUrl;
        setBgImageUrl(data.imageUrl);
      }
    } catch (e) {
      console.error("Image fetch failed", e);
    } finally {
      setIsGeneratingImage(false);
    }
  }, []);

  const handleUserInput = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    setShowOptions(false)
    setUserInput('')

    if (input !== 'start') addMessage('user', playerName, input)

    try {
      const history = gameState.messages.map(m => ({ speaker: m.speaker, name: m.name, message: m.message }))
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, worldSetting, userInput: input, conversationHistory: history }),
      })

      if (!res.ok) throw new Error('API Error')
      const response: OpenRouterResponse = await res.json()

      const newLocation = response.location;
      const storyTitle = response.story || "";
      const SESSION_KEY = 'has_generated_start_image';
      const hasGenerated = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null;

      const isEnding = storyTitle.includes('エピローグ') || storyTitle.includes('エンディング') || storyTitle.includes('最終話');

      if (newLocation) {
        if (!hasGenerated) {
          setCurrentLocation(newLocation);
          generateImageDirectly(newLocation, "START");
          sessionStorage.setItem(SESSION_KEY, 'true');
        } else if (isEnding) {
          setCurrentLocation(newLocation);
          generateImageDirectly(newLocation, "ENDING");
        }
      }

      setGameState(prev => ({
        ...prev,
        fieldStory: response.story,
        options: response.options
      }))

      if (response.tableTalk?.length) {
        setPendingTableTalk(response.tableTalk)
        setAnimationPhase('tableTalk')
      } else {
        setAnimationPhase('story')
      }
      
      setDisplayedStory('')
      setDisplayedTableTalk([])
      setDisplayedOptions([])
      currentTableTalkIndexRef.current = 0
      currentTableTalkCharIndexRef.current = 0

    } catch (e) {
      console.error(e)
      addMessage('gm', 'GM', 'エラーが発生しました')
      setShowOptions(true)
    } finally {
      setIsLoading(false)
    }
  }, [playerName, worldSetting, gameState.messages, isLoading, addMessage, generateImageDirectly])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (animationPhase === 'tableTalk' && pendingTableTalk.length > 0) {
      const animate = () => {
        const idx = currentTableTalkIndexRef.current
        if (idx >= pendingTableTalk.length) {
          pendingTableTalk.forEach(t => addMessage(t.speaker === 'GM' ? 'gm' : 'kaito', t.speaker, t.text, t.gender))
          setPendingTableTalk([])
          setDisplayedTableTalk([])
          setAnimationPhase('story')
          return
        }
        // 簡易演出
        pendingTableTalk.forEach(t => addMessage(t.speaker === 'GM' ? 'gm' : 'kaito', t.speaker, t.text, t.gender))
        setPendingTableTalk([])
        setAnimationPhase('story')
      }
      animate()
    } else if (animationPhase === 'story') {
      if (gameState.fieldStory) {
        setDisplayedStory(gameState.fieldStory)
        timeoutId = setTimeout(() => setAnimationPhase('options'), 500)
      }
    } else if (animationPhase === 'options') {
      setDisplayedOptions(gameState.options)
      timeoutId = setTimeout(() => { setAnimationPhase('done'); setShowOptions(true) }, 100)
    }
    return () => clearTimeout(timeoutId);
  }, [animationPhase, pendingTableTalk, gameState.fieldStory, gameState.options, addMessage])

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
    if (gameState.messages.length === 0) {
      initializeGame()
    }
  }, [])

  const handleReset = useCallback(() => {
    sessionStorage.removeItem('has_generated_start_image');
    imageCacheRef.current = {};
    setCurrentLocation(null);
    isInitializedRef.current = false;
    if (onReset) onReset()
    else window.location.reload()
  }, [onReset])

  return (
    <div className="h-screen flex flex-col bg-dark-bg p-2 md:p-4 gap-2 md:gap-4 relative overflow-hidden">
      {bgImageUrl && (
        <div 
          className="absolute inset-0 z-0 transition-opacity duration-1000"
          style={{ 
            backgroundImage: `url(${bgImageUrl})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            opacity: isUiHidden ? 1 : 0.4
          }}
        />
      )}
      <div className={`absolute inset-0 bg-black/60 z-0 transition-opacity ${isUiHidden ? 'opacity-0' : 'opacity-100'}`} />

      {/* ヘッダーボタン (右上に固定) */}
      <div className="absolute top-2 right-2 z-50 flex gap-2">
        <button 
          onMouseDown={() => setIsUiHidden(true)} 
          onMouseUp={() => setIsUiHidden(false)}
          onMouseLeave={() => setIsUiHidden(false)}
          // スマホ用タッチイベントを追加 & コンテキストメニュー(長押しメニュー)を無効化
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

      {/* メインレイアウトエリア */}
      <div className={`relative z-10 flex flex-col h-full gap-2 md:gap-4 transition-opacity ${isUiHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* スマホレイアウト対応: 
            md:flex-row (PCは横並び)
            flex-col (スマホは縦並び) 
        */}
        
        {/* エリア1: ゲームフィールド(物語) 
            スマホ: 上部に配置 (order-1)
            PC: 下部に配置 (flex-[0.65]) ※元のデザイン維持のため構造変更が必要
            元のデザイン: 上段(トーク+選択肢) / 下段(フィールド)
            
            ★スマホ最適化レイアウトに変更★
            スマホ: 上(フィールド) -> 中(トーク) -> 下(選択肢)
            PC: 左(トーク) / 右(選択肢) / 下(フィールド) というより、
            元のコードは Flex分割でした。
            ここではスマホで見やすいように「縦積み」にします。
        */}
        
        {/* PC: 上部 (トーク & 選択肢), スマホ: コンテンツ全体を縦並びにするため構造整理 */}
        
        <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 min-h-0">
          
          {/* 左カラム (PC) / 中段 (スマホ): テーブルトーク */}
          {/* スマホでは高さを確保しつつスクロールさせる */}
          <div className="order-2 md:order-1 flex-[0.6] md:flex-[0.35] min-h-0 flex flex-col bg-black/20 rounded overflow-hidden">
             <TableTalk messages={gameState.messages} displayedTableTalk={displayedTableTalk} animationPhase={animationPhase as any} playerName={playerName} />
          </div>

          {/* 右カラム (PC) / 上段 (スマホ): フィールド & 選択肢 */}
          <div className="order-1 md:order-2 flex-[0.4] md:flex-[0.65] flex flex-col gap-2 min-h-0">
            
            {/* 物語表示 (スマホでは一番上に見せたいのでこれを含む) */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <GameField displayedStory={displayedStory} animationPhase={animationPhase as any} imageUrl={null} isGeneratingImage={isGeneratingImage} />
            </div>

            {/* 下部固定エリア: 選択肢 & 入力 */}
            <div className="mt-auto flex flex-col gap-2 p-1">
               <div className={`${showOptions ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                 <GameOptions options={gameState.options} onSelect={o => {setShowOptions(false); handleUserInput(o)}} isLoading={isLoading} animationPhase={animationPhase} originalOptions={gameState.options} />
               </div>
               
               <div className="flex gap-2">
                 <input 
                    value={userInput} 
                    onChange={e => setUserInput(e.target.value)} 
                    disabled={isLoading} 
                    className="flex-1 px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 focus:border-blue-500 text-sm md:text-base" 
                    placeholder="メッセージ..." 
                 />
                 <button 
                    onClick={() => handleUserInput(userInput)} 
                    disabled={isLoading} 
                    className="px-4 py-2 bg-blue-600 rounded text-white font-bold text-sm md:text-base whitespace-nowrap"
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