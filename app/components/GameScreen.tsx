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
  
  // キャッシュ
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
  
  // Refs
  const currentTableTalkIndexRef = useRef(0)
  const currentTableTalkCharIndexRef = useRef(0)
  const currentOptionIndexRef = useRef(0)
  const currentOptionCharIndexRef = useRef(0)
  const tableTalkTimeoutRef = useRef<any>(null)
  const storyTimeoutRef = useRef<any>(null)
  const optionsTimeoutRef = useRef<any>(null)
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

  // 画像生成関数
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

      // ★鉄壁のロックロジック (SessionStorage使用)★
      const SESSION_KEY = 'has_generated_start_image';
      const hasGenerated = sessionStorage.getItem(SESSION_KEY);

      const isEnding = storyTitle.includes('エピローグ') || 
                       storyTitle.includes('エンディング') || 
                       storyTitle.includes('最終話') ||
                       storyTitle.includes('True End') ||
                       storyTitle.includes('Game Clear');

      if (newLocation) {
        if (!hasGenerated) {
          // ★まだ生成していない（初回）
          console.log("【画像生成: START】初回生成を実行し、ロックをかけます。");
          setCurrentLocation(newLocation);
          generateImageDirectly(newLocation, "START");
          
          // ★ブラウザに「生成済み」の証拠を残す
          sessionStorage.setItem(SESSION_KEY, 'true');

        } else if (isEnding) {
          // ★エンディング
          console.log("【画像生成: ENDING】エンディングのため生成します。");
          setCurrentLocation(newLocation);
          generateImageDirectly(newLocation, "ENDING");

        } else {
          // ★それ以外（ロック済み）→ 絶対に生成しない
          console.log("【画像生成スキップ】既に初回生成済みのため、リクエストを破棄しました。");
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
      currentOptionIndexRef.current = 0
      currentOptionCharIndexRef.current = 0

    } catch (e) {
      console.error(e)
      addMessage('gm', 'GM', 'エラーが発生しました')
      setShowOptions(true)
    } finally {
      setIsLoading(false)
    }
  }, [playerName, worldSetting, gameState.messages, isLoading, addMessage, generateImageDirectly])

  // アニメーション制御
  useEffect(() => {
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
        pendingTableTalk.forEach(t => addMessage(t.speaker === 'GM' ? 'gm' : 'kaito', t.speaker, t.text, t.gender))
        setPendingTableTalk([])
        setAnimationPhase('story')
      }
      animate()
    } else if (animationPhase === 'story') {
      if (gameState.fieldStory) {
        setDisplayedStory(gameState.fieldStory)
        setTimeout(() => setAnimationPhase('options'), 500)
      }
    } else if (animationPhase === 'options') {
      setDisplayedOptions(gameState.options)
      setTimeout(() => { setAnimationPhase('done'); setShowOptions(true) }, 100)
    }
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
    // リセット時はブラウザの記憶（ロック）も解除する
    sessionStorage.removeItem('has_generated_start_image');
    imageCacheRef.current = {};
    setCurrentLocation(null);
    isInitializedRef.current = false;
    
    if (onReset) onReset()
    else window.location.reload()
  }, [onReset])

  return (
    <div className="h-screen flex flex-col bg-dark-bg p-4 gap-4 relative overflow-hidden">
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

      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button 
          onMouseDown={() => setIsUiHidden(true)} 
          onMouseUp={() => setIsUiHidden(false)}
          className="px-4 py-2 bg-gray-800 text-white rounded border border-gray-600"
        >
          👁️ 画像を見る
        </button>
        <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white rounded">
          TOPに戻る
        </button>
      </div>

      <div className={`relative z-10 flex flex-col h-full gap-4 transition-opacity ${isUiHidden ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex justify-end mb-2 min-h-[40px]" />
        
        <div className="flex-[0.35] min-h-0 flex gap-4">
          <div className="flex-[0.6]">
            <TableTalk messages={gameState.messages} displayedTableTalk={displayedTableTalk} animationPhase={animationPhase as any} playerName={playerName} />
          </div>
          <div className="flex-[0.4] flex flex-col gap-4">
             <div className={showOptions ? 'opacity-100' : 'opacity-0'}>
               <GameOptions options={gameState.options} onSelect={o => {setShowOptions(false); handleUserInput(o)}} isLoading={isLoading} animationPhase={animationPhase} originalOptions={gameState.options} />
             </div>
             <div className="flex gap-2 mt-auto">
               <input value={userInput} onChange={e => setUserInput(e.target.value)} disabled={isLoading} className="flex-1 px-4 py-2 rounded bg-gray-800 text-white" placeholder="メッセージ..." />
               <button onClick={() => handleUserInput(userInput)} disabled={isLoading} className="px-6 py-2 bg-blue-600 rounded text-white">送信</button>
             </div>
          </div>
        </div>

        <div className="flex-[0.65]">
          <GameField displayedStory={displayedStory} animationPhase={animationPhase as any} imageUrl={null} isGeneratingImage={isGeneratingImage} />
        </div>
      </div>
    </div>
  )
}