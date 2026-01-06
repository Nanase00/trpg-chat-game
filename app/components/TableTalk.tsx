'use client'

import { GameMessage } from '../types/game'
import { useEffect, useRef, useState, useMemo } from 'react'

interface TableTalkProps {
  messages: GameMessage[]
  displayedTableTalk?: Array<{ speaker: string; text: string; gender?: 'male' | 'female' | 'gm'; displayedText: string; isTyping: boolean; speakerType?: 'user' | 'gm' | 'kaito' | 'yuki' | 'system' }>
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
  const [showHistory, setShowHistory] = useState(true)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, displayedTableTalk])

  // スマート表示ルール: メッセージ数に応じて表示方法を変更
  const MESSAGE_THRESHOLD = 5 // この数以下ならアコーディオン非表示
  const RECENT_MESSAGE_COUNT = 4 // 最新のメッセージ数（常に表示）

  const shouldShowAccordion = useMemo(() => {
    return messages.length > MESSAGE_THRESHOLD
  }, [messages.length])

  const recentMessages = useMemo(() => {
    if (messages.length === 0) return []
    if (!shouldShowAccordion) {
      // メッセージが少ない時はすべて表示
      return messages
    }
    // メッセージが多い時は最新の数件だけ表示
    const startIndex = Math.max(0, messages.length - RECENT_MESSAGE_COUNT)
    return messages.slice(startIndex)
  }, [messages, shouldShowAccordion])

  const historyMessages = useMemo(() => {
    if (messages.length === 0) return []
    if (!shouldShowAccordion) {
      // メッセージが少ない時は履歴なし
      return []
    }
    // メッセージが多い時は古いものを履歴に
    const startIndex = Math.max(0, messages.length - RECENT_MESSAGE_COUNT)
    return messages.slice(0, startIndex)
  }, [messages, shouldShowAccordion])

  const getSpeakerColor = (message: GameMessage) => {
    // genderに応じた色分けを優先
    if (message.gender) {
      switch (message.gender) {
        case 'male':
          return 'text-cyan-400' // 水色・青系
        case 'female':
          return 'text-pink-400' // ピンク・赤系
        case 'gm':
          return 'text-purple-400' // 紫（GM）
        default:
          break
      }
    }
    
    // genderが設定されていない場合は従来のロジック
    switch (message.speaker) {
      case 'user':
        return 'text-blue-400'
      case 'gm':
        return 'text-purple-400'
      case 'kaito':
        return 'text-orange-400'
      case 'yuki':
        return 'text-cyan-400'
      case 'system':
        return 'text-dark-muted'
      default:
        return 'text-dark-text'
    }
  }

  // リテラルの\n文字列を実際の改行コードに置換
  const formatMessage = (text: string): string => {
    return text.replace(/\\n/g, '\n').replace(/\\n\\n/g, '\n\n')
  }

  // 話者表示のバグ修正: GM: キャラ名: 『セリフ』のような二重表示を防ぐ
  const sanitizeMessage = (name: string, message: string): string => {
    // GM: で始まっていて、その後に名前: が続いている場合、先頭のGM: を削除
    // パターン1: GM: キャラ名: 『セリフ』
    // パターン2: GM: キャラ名: セリフ
    const doublePrefixPattern1 = /^GM:\s*([^:：]+)[:：]\s*['"「『](.+?)['"」』]/
    const doublePrefixPattern2 = /^GM:\s*([^:：]+)[:：]\s+(.+)$/
    
    let match = message.match(doublePrefixPattern1)
    if (match) {
      // 二重表示を検出した場合、セリフだけを返す
      return match[2]
    }
    
    match = message.match(doublePrefixPattern2)
    if (match) {
      // 二重表示を検出した場合、セリフだけを返す
      return match[2]
    }
    
    // 通常の場合はそのまま返す
    return message
  }

  const renderMessage = (message: GameMessage, isHistory: boolean = false, isLatestGm: boolean = false) => {
    // システムメッセージの場合は特別な表示
    if (message.speaker === 'system') {
      return (
        <div
          key={message.id}
          className={`text-sm text-center italic text-dark-muted py-2 ${
            isHistory ? 'text-xs opacity-70' : ''
          }`}
        >
          <span className="whitespace-pre-wrap">{formatMessage(message.message)}</span>
        </div>
      )
    }
    
    // 話者表示のバグ修正を適用
    const sanitizedMessage = sanitizeMessage(message.name, message.message)
    
    // ユーザーの発言を強調表示
    const isUserMessage = message.speaker === 'user'
    
    return (
      <div
        key={message.id}
        className={`text-sm ${
          isHistory
            ? isUserMessage
              ? 'text-xs opacity-70 bg-blue-900/20 border-l-4 border-cyan-400 rounded px-2 py-1'
              : 'text-xs opacity-70 bg-dark-bg/30 rounded px-2 py-1'
            : isUserMessage
            ? 'bg-blue-900/30 border-l-4 border-cyan-400 pl-3 py-2 rounded-r font-semibold'
            : isLatestGm
            ? 'bg-purple-900/20 border-l-2 border-purple-400 pl-3 py-2 rounded-r'
            : ''
        }`}
      >
        <span className={`${isUserMessage ? 'font-bold' : 'font-semibold'} ${getSpeakerColor(message)}`}>
          {message.name}:
        </span>
        <span className={`${isUserMessage ? 'font-semibold' : ''} text-dark-text ml-2 whitespace-pre-wrap`}>
          {formatMessage(sanitizedMessage)}
        </span>
      </div>
    )
  }

  return (
    <div className="h-full bg-dark-surface border-2 border-dark-border rounded-lg p-4 flex flex-col">
      <h2 className="text-lg font-semibold text-dark-text border-b border-dark-border pb-2 mb-3">
        テーブルトーク
      </h2>
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
        {messages.length === 0 ? (
          <p className="text-dark-muted text-sm">会話が始まります...</p>
        ) : (
          <>
            {/* 過去のログ（折りたたみ可能） - メッセージが多い時のみ表示 */}
            {shouldShowAccordion && historyMessages.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full text-left text-xs text-dark-muted hover:text-dark-text transition-colors py-1 px-2 bg-dark-bg/50 rounded border border-dark-border hover:border-dark-muted"
                >
                  {showHistory ? '▼' : '▶'} 過去のログを隠す ({historyMessages.length}件)
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-dark-border">
                    {historyMessages.map((message) => renderMessage(message, true))}
                  </div>
                )}
              </div>
            )}

            {/* 最新のメッセージ */}
            <div className="space-y-2">
              {recentMessages.map((message, index) => {
                const isLatestGm = message.speaker === 'gm' && index === recentMessages.length - 1
                return renderMessage(message, false, isLatestGm)
              })}
              
              {/* タイプライター中のメッセージ */}
              {displayedTableTalk.map((talk, index) => {
                const getColor = () => {
                  if (talk.gender === 'male') return 'text-cyan-400'
                  if (talk.gender === 'female') return 'text-pink-400'
                  if (talk.gender === 'gm') return 'text-purple-400'
                  return 'text-dark-text'
                }
                
                // ユーザーの発言を強調表示
                const isUserMessage = talk.speakerType === 'user'
                
                return (
                  <div 
                    key={index} 
                    className={`text-sm ${
                      isUserMessage
                        ? 'bg-blue-900/30 border-l-4 border-cyan-400 pl-3 py-2 rounded-r font-semibold'
                        : ''
                    }`}
                  >
                    <span className={`${isUserMessage ? 'font-bold' : 'font-semibold'} ${getColor()}`}>
                      {talk.speaker}:
                    </span>
                    <span className={`${isUserMessage ? 'font-semibold' : ''} text-dark-text ml-2 whitespace-pre-wrap`}>
                      {talk.displayedText}
                      {talk.isTyping && <span className="animate-pulse">|</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}


