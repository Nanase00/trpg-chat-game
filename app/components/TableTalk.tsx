'use client'

import { GameMessage } from '../types/game'
import { useEffect, useRef, useState } from 'react'

interface TableTalkProps {
  messages: GameMessage[] // 過去の確定ログ
  displayedTableTalk?: Array<{ speaker: string; text: string; gender?: 'male' | 'female' | 'gm'; displayedText: string; isTyping: boolean }> // 現在進行中の会話
  animationPhase?: 'idle' | 'tableTalk' | 'story' | 'options' | 'done'
  playerName?: string
}

export default function TableTalk({ 
  messages, 
  displayedTableTalk = [],
  animationPhase = 'idle',
  playerName = ''
}: TableTalkProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showHistory, setShowHistory] = useState(false) // デフォルトは閉じている

  // 最新のメッセージが表示されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayedTableTalk, messages])

  const formatMessage = (text: string): string => {
    return text.replace(/\\n/g, '\n').replace(/\\n\\n/g, '\n\n')
  }

  // 二重表示防止（GM: Name: ... となっている場合にNameを削る）
  const sanitizeMessage = (name: string, message: string): string => {
    // 例: "GM: 佐々木: こんにちは" -> "こんにちは"
    const doublePrefixPattern = /^GM:\s*([^:：]+)[:：]\s*(.+)$/
    const match = message.match(doublePrefixPattern)
    if (match) return match[2]
    
    // 名前がメッセージの先頭に含まれてしまっているケースの削除
    if (message.startsWith(`${name}:`)) {
        return message.substring(name.length + 1).trim();
    }
    if (message.startsWith(`${name}：`)) {
        return message.substring(name.length + 1).trim();
    }

    return message
  }

  // メッセージ描画関数
  const renderMessage = (message: GameMessage, isHistory: boolean = false) => {
    const isUser = message.speaker === 'user' || message.name === playerName
    
    // 話者ごとの色設定
    let nameColor = 'text-dark-text'
    if (message.gender === 'male') nameColor = 'text-cyan-400'
    else if (message.gender === 'female') nameColor = 'text-pink-400'
    else if (message.gender === 'gm' || message.speaker === 'gm' || message.speaker === 'GM') nameColor = 'text-purple-400'
    else if (isUser) nameColor = 'text-blue-400'

    const sanitizedText = sanitizeMessage(message.name, message.message)

    return (
      <div
        key={message.id}
        className={`text-sm mb-1 ${
          isHistory
            ? 'opacity-70 text-xs py-1 border-b border-gray-700/50'
            : isUser
            ? 'bg-blue-900/20 border-l-4 border-cyan-400 pl-3 py-2 rounded-r'
            : 'bg-purple-900/10 border-l-2 border-purple-400 pl-3 py-2 rounded-r'
        }`}
      >
        <span className={`font-bold ${nameColor}`}>
          {message.name}:
        </span>
        <span className="text-dark-text ml-2 whitespace-pre-wrap">
          {formatMessage(sanitizedText)}
        </span>
      </div>
    )
  }

  return (
    <div className="h-full bg-dark-surface border-2 border-dark-border rounded-lg flex flex-col">
      {/* ヘッダー */}
      <div className="flex-shrink-0 border-b border-dark-border p-3 bg-dark-surface z-10">
        <h2 className="text-lg font-semibold text-dark-text">
          💬 テーブルトーク
        </h2>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 上部: 過去ログ（アコーディオン） */}
        {messages.length > 0 && (
          <div className="flex-shrink-0 border-b border-dark-border bg-dark-bg/30">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full text-left text-xs text-dark-muted hover:text-dark-text transition-colors py-2 px-3 flex items-center justify-between"
            >
              <span>
                {showHistory ? '▼' : '▶'} 過去のログ ({messages.length}件)
              </span>
            </button>
            {showHistory && (
              <div className="max-h-[200px] overflow-y-auto p-3 space-y-1 bg-black/20 inner-shadow">
                {messages.map((msg) => renderMessage(msg, true))}
              </div>
            )}
          </div>
        )}

        {/* 下部: 現在の会話（メイン表示エリア） */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {messages.length === 0 && displayedTableTalk.length === 0 && (
            <p className="text-dark-muted text-sm italic">ゲームを開始します...</p>
          )}

          {/* 現在進行中の会話（アニメーション中） */}
          {displayedTableTalk.map((talk, index) => {
            const isUser = talk.speaker === playerName || talk.speaker === 'user'
            
            let nameColor = 'text-dark-text'
            if (talk.gender === 'male') nameColor = 'text-cyan-400'
            else if (talk.gender === 'female') nameColor = 'text-pink-400'
            else if (talk.gender === 'gm' || talk.speaker === 'GM') nameColor = 'text-purple-400'
            else if (isUser) nameColor = 'text-blue-400'

            return (
              <div 
                key={index} 
                className={`text-sm ${
                  isUser
                    ? 'bg-blue-900/30 border-l-4 border-cyan-400 pl-3 py-2 rounded-r'
                    : 'bg-purple-900/20 border-l-2 border-purple-400 pl-3 py-2 rounded-r'
                }`}
              >
                <span className={`font-bold ${nameColor}`}>
                  {talk.speaker}:
                </span>
                <span className="text-dark-text ml-2 whitespace-pre-wrap">
                  {talk.displayedText}
                  {talk.isTyping && <span className="inline-block w-1.5 h-4 bg-green-500 ml-1 align-middle animate-pulse" />}
                </span>
              </div>
            )
          })}

          {/* 入力中インジケーター */}
          {animationPhase === 'tableTalk' && displayedTableTalk.length === 0 && (
            <div className="text-dark-muted text-xs animate-pulse pl-2">
              GMが入力中...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}