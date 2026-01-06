'use client'

import { useState } from 'react'
import { WorldSetting } from '../types/game'

interface GameStartScreenProps {
  onStart: (world: WorldSetting, name: string) => void
}

export default function GameStartScreen({ onStart }: GameStartScreenProps) {
  const [name, setName] = useState('')
  const [world, setWorld] = useState<WorldSetting>('academy')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onStart(world, name)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 shadow-2xl border border-gray-700">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-400">
          TRPG Chat Game
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-300 text-sm font-bold mb-2">
              プレイヤー名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              placeholder="あなたの名前を入力"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-bold mb-2">
              ワールド設定
            </label>
            <div className="space-y-2">
              <label className={`flex items-center p-3 rounded cursor-pointer border transition-colors ${world === 'academy' ? 'bg-blue-900/50 border-blue-500' : 'bg-gray-700 border-transparent hover:bg-gray-600'}`}>
                <input
                  type="radio"
                  name="world"
                  value="academy"
                  checked={world === 'academy'}
                  onChange={(e) => setWorld(e.target.value as WorldSetting)}
                  className="mr-3"
                />
                <span className="text-white">🏫 学園ミステリー</span>
              </label>

              <label className={`flex items-center p-3 rounded cursor-pointer border transition-colors ${world === 'sf' ? 'bg-purple-900/50 border-purple-500' : 'bg-gray-700 border-transparent hover:bg-gray-600'}`}>
                <input
                  type="radio"
                  name="world"
                  value="sf"
                  checked={world === 'sf'}
                  onChange={(e) => setWorld(e.target.value as WorldSetting)}
                  className="mr-3"
                />
                <span className="text-white">🚀 SFサイバーパンク</span>
              </label>

              <label className={`flex items-center p-3 rounded cursor-pointer border transition-colors ${world === 'fantasy' ? 'bg-green-900/50 border-green-500' : 'bg-gray-700 border-transparent hover:bg-gray-600'}`}>
                <input
                  type="radio"
                  name="world"
                  value="fantasy"
                  checked={world === 'fantasy'}
                  onChange={(e) => setWorld(e.target.value as WorldSetting)}
                  className="mr-3"
                />
                <span className="text-white">⚔️ 異世界ファンタジー</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ゲームスタート
          </button>
        </form>
      </div>
    </div>
  )
}