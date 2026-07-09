import { useState } from 'react'
import MainMenu from './components/MainMenu'
import MeteorGame from './games/MeteorGame'
import HoshikGame from './games/HoshikGame'
import TempleGame from './games/TempleGame'
import KartGame from './games/KartGame'

export default function App() {
  const [mode, setMode] = useState<'menu' | 'meteor' | 'hoshik' | 'temple' | 'kart'>('menu')

  if (mode === 'menu') {
    return <MainMenu onSelectMode={setMode} />
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

  if (mode === 'kart') {
    return <KartGame onBack={() => setMode('menu')} />
  }



  return null
}
