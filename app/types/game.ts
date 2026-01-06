export type GameMessage = {
  id: string
  speaker: 'user' | 'gm' | 'system' | 'kaito' | 'yuki' | string
  name: string
  message: string
  timestamp: Date
  gender?: 'male' | 'female' | 'gm'
}

export type WorldSetting = 'academy' | 'sf' | 'fantasy'

export type GameState = {
  worldSetting: WorldSetting
  playerName: string
  messages: GameMessage[]
  fieldStory: string
  options: string[]
  isGameStarted: boolean
}

export type TableTalkMessage = {
  speaker: string
  text: string
  gender?: 'male' | 'female' | 'gm'
}

// ↓この location が追加されていることが超重要です！
export type OpenRouterResponse = {
  tableTalk: TableTalkMessage[]
  story: string
  location: string 
  options: string[]
}