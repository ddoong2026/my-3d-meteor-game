import { useState } from 'react'
import MainMenu from './components/MainMenu'
import MeteorGame from './games/MeteorGame'
import HoshikGame from './games/HoshikGame'
import TempleGame from './games/TempleGame'
import HoshikGame2 from './games/HoshikGame2'
import FallGuysGame from './games/fallguys/FallGuysGame'
import HosikSoccerGame from './games/HosikSoccerGame'
import { soundManager } from './utils/SoundManager'

export default function App() {
  const [mode, setMode] = useState<'menu' | 'meteor' | 'hoshik' | 'temple' | 'hoshik2' | 'fallguys' | 'soccer'>('menu')

  if (mode === 'menu') {
    return <MainMenu onSelectMode={(m) => {
      soundManager.init()
      setMode(m)
    }} />
  }

  if (mode === 'meteor') {
    return <MeteorGame onBack={() => setMode('menu')} />
  }

  if (mode === 'hoshik') {
    return <HoshikGame onBack={() => setMode('menu')} />
  }

  if (mode === 'temple') {
    return <TempleGame onBack={() => setMode('menu')} />
  }

  if (mode === 'hoshik2') {
    return <HoshikGame2 onBack={() => setMode('menu')} />
  }

  if (mode === 'fallguys') {
    return <FallGuysGame onBack={() => setMode('menu')} />
  }

  if (mode === 'soccer') {
    return <HosikSoccerGame onBack={() => setMode('menu')} />
  }

  return null
}
