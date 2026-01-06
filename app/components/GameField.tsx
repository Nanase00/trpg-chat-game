'use client'

import { useState, useEffect, useRef } from 'react'

interface GameFieldProps {
  displayedStory: string
  animationPhase?: 'idle' | 'tableTalk' | 'story' | 'options' | 'done'
  imageUrl?: string | null
  isGeneratingImage?: boolean
}

export default function GameField({ 
  displayedStory, 
  animationPhase = 'idle',
  imageUrl,
  isGeneratingImage = false
}: GameFieldProps) {
  const isTyping = animationPhase === 'story'

  return (
    <div className="h-full bg-dark-surface/90 border-2 border-dark-border rounded-lg p-8 overflow-y-auto scrollbar-hide shadow-inner">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-dark-text border-b border-dark-border pb-2">
          フィールド
        </h2>
        
        {/* 画像表示エリア（画像がある場合のみ表示） */}
        {imageUrl && (
          <div className="mb-4">
            <img 
              src={imageUrl} 
              alt="Scene illustration" 
              className="w-full max-w-2xl mx-auto rounded-lg border-2 border-dark-border shadow-lg"
            />
          </div>
        )}
        
        {/* 画像生成中のインジケーター */}
        {isGeneratingImage && !imageUrl && (
          <div className="mb-4 text-center text-dark-muted text-sm">
            <span className="animate-pulse">画像を生成中...</span>
          </div>
        )}
        
        <div className="text-dark-text whitespace-pre-wrap leading-relaxed font-mono text-base min-h-[200px]">
          {displayedStory || '物語が始まります...'}
          {isTyping && <span className="animate-pulse">|</span>}
        </div>
      </div>
    </div>
  )
}


