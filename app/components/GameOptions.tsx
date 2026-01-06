'use client'

interface GameOptionsProps {
  options: string[]
  onSelect: (option: string) => void
  isLoading: boolean
  animationPhase?: 'idle' | 'tableTalk' | 'story' | 'options' | 'done'
  originalOptions?: string[]
}

export default function GameOptions({ options, onSelect, isLoading, animationPhase = 'idle', originalOptions = [] }: GameOptionsProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-dark-surface border-2 border-dark-border rounded-lg">
        <p className="text-dark-muted text-center">AIが考えています...</p>
      </div>
    )
  }

  if (options.length === 0) {
    return null
  }

  const isTyping = animationPhase === 'options'

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-dark-muted mb-2">選択肢:</h3>
      <div className="grid gap-2">
        {options.map((option, index) => {
          const originalOpt = originalOptions[index] || option
          // 現在タイプライター中の選択肢かどうか（アニメーション中で、まだ完全に表示されていない場合）
          const isCurrentTyping = isTyping && option.length < originalOpt.length
          // この選択肢が完全に表示されているかどうか
          const isFullyDisplayed = !isTyping || option.length >= originalOpt.length
          
          return (
            <button
              key={index}
              onClick={() => onSelect(originalOpt)}
              disabled={isTyping && !isFullyDisplayed}
              className="px-4 py-3 bg-dark-surface border-2 border-dark-border rounded-lg text-dark-text hover:border-blue-500 hover:bg-dark-bg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {option}
              {isCurrentTyping && <span className="animate-pulse">|</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}


