'use client'

interface GameOptionsProps {
  options: string[]
  onSelect: (option: string) => void
  isLoading: boolean
  animationPhase?: 'idle' | 'tableTalk' | 'story' | 'options' | 'done'
  originalOptions?: string[]
  displayedOptions?: Array<{ text: string; displayedText: string; isTyping: boolean }>
}

export default function GameOptions({ 
  options, 
  onSelect, 
  isLoading, 
  animationPhase = 'idle', 
  originalOptions = [],
  displayedOptions = []
}: GameOptionsProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-dark-surface border-2 border-dark-border rounded-lg">
        <p className="text-dark-muted text-center">AIが考えています...</p>
      </div>
    )
  }

  if (options.length === 0 && displayedOptions.length === 0) {
    return null
  }

  const isTyping = animationPhase === 'options'

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-dark-muted mb-2">選択肢:</h3>
      <div className="grid gap-2">
        {(displayedOptions.length > 0 ? displayedOptions : options.map((opt, idx) => ({ text: opt, displayedText: opt, isTyping: false }))).map((displayedOpt, index) => {
          const originalOpt = originalOptions[index] || displayedOpt.text
          const displayText = displayedOpt.displayedText || displayedOpt.text
          const isCurrentTyping = displayedOpt.isTyping
          const isFullyDisplayed = !isCurrentTyping
          
          return (
            <button
              key={index}
              onClick={() => onSelect(originalOpt)}
              disabled={isTyping && !isFullyDisplayed}
              className="px-4 py-3 bg-dark-surface border-2 border-dark-border rounded-lg text-dark-text hover:border-blue-500 hover:bg-dark-bg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {displayText}
              {isCurrentTyping && (
                <span className="inline-block w-1.5 h-4 bg-green-500 ml-1 align-middle animate-pulse" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}


