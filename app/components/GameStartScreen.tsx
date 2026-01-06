'use client'

import { useState } from 'react'
import { WorldSetting } from '../types/game'

interface GameStartScreenProps {
  onStart: (worldSetting: WorldSetting, playerName: string) => void
}

export default function GameStartScreen({ onStart }: GameStartScreenProps) {
  const [selectedWorld, setSelectedWorld] = useState<WorldSetting | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)

  const worldOptions = [
    { value: 'academy' as WorldSetting, label: '学園', description: '現代日本の学園を舞台にした物語' },
    { value: 'sf' as WorldSetting, label: 'SF', description: '未来の宇宙やサイバーパンクな世界' },
    { value: 'fantasy' as WorldSetting, label: 'ファンタジー', description: '魔法や剣と魔法の世界' },
  ]

  const handleWorldSelect = (world: WorldSetting) => {
    setSelectedWorld(world)
    setShowNameInput(true)
  }

  const handleStart = () => {
    if (selectedWorld && playerName.trim()) {
      onStart(selectedWorld, playerName.trim())
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-bg p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-dark-text">TRPG Chat Game</h1>
          <p className="text-dark-muted">ブラウザで遊べるTRPG風チャットゲーム</p>
        </div>

        {!showNameInput ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-center text-dark-text mb-6">
              世界観を選択してください
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {worldOptions.map((world) => (
                <button
                  key={world.value}
                  onClick={() => handleWorldSelect(world.value)}
                  className="p-6 bg-dark-surface border-2 border-dark-border rounded-lg hover:border-blue-500 transition-colors text-left group"
                >
                  <h3 className="text-xl font-semibold mb-2 text-dark-text group-hover:text-blue-400">
                    {world.label}
                  </h3>
                  <p className="text-sm text-dark-muted">{world.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-center text-dark-text mb-2">
                プレイヤー名を入力してください
              </h2>
              <p className="text-center text-dark-muted mb-6">
                選択した世界観: {worldOptions.find(w => w.value === selectedWorld)?.label}
              </p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleStart()}
                placeholder="あなたの名前を入力"
                className="w-full px-4 py-3 bg-dark-surface border-2 border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowNameInput(false)
                    setPlayerName('')
                  }}
                  className="flex-1 px-6 py-3 bg-dark-surface border-2 border-dark-border rounded-lg text-dark-text hover:border-gray-500 transition-colors"
                >
                  戻る
                </button>
                <button
                  onClick={handleStart}
                  disabled={!playerName.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
                >
                  ゲーム開始
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


