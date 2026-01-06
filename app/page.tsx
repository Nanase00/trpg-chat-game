'use client'

import { useState } from 'react'
import { WorldSetting } from './types/game'
import GameStartScreen from './components/GameStartScreen'
import GameScreen from './components/GameScreen'

export default function Home() {
  const [worldSetting, setWorldSetting] = useState<WorldSetting | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [gameStarted, setGameStarted] = useState(false)
  const [gameKey, setGameKey] = useState(0) // コンポーネントの強制再マウント用

  const handleStart = (world: WorldSetting, name: string) => {
    // ゲーム開始時にキャッシュを完全削除
    if (typeof window !== 'undefined') {
      // Local Storage / Session Storageのクリア
      localStorage.clear()
      sessionStorage.clear()
    }
    
    setWorldSetting(world)
    setPlayerName(name)
    setGameStarted(true)
    setGameKey(prev => prev + 1) // キーを変更してコンポーネントを強制再マウント
  }

  const handleReset = () => {
    // ゲームリセット時にキャッシュを完全削除
    if (typeof window !== 'undefined') {
      // Local Storage / Session Storageのクリア
      localStorage.clear()
      sessionStorage.clear()
    }
    
    setWorldSetting(null)
    setPlayerName('')
    setGameStarted(false)
    setGameKey(prev => prev + 1) // キーを変更してコンポーネントを強制再マウント
  }

  if (!gameStarted || !worldSetting || !playerName) {
    return <GameStartScreen onStart={handleStart} />
  }

  return <GameScreen key={gameKey} worldSetting={worldSetting} playerName={playerName} onReset={handleReset} />
}


