import { useState } from 'react'
import MainMenu from './components/MainMenu'
import MeteorGame from './games/MeteorGame'
import HoshikGame from './games/HoshikGame'

export default function App() {
  const [mode, setMode] = useState<'menu' | 'meteor' | 'hoshik'>('menu')

  if (mode === 'menu') {
    return <MainMenu onSelectMode={setMode} />
  }

  if (mode === 'meteor') {
    return <MeteorGame onBack={() => setMode('menu')} />
  }

  if (mode === 'hoshik') {
    return <HoshikGame onBack={() => setMode('menu')} />
  }

  return null
}
