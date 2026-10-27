import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  return <Dashboard dark={dark} onToggleDark={() => setDark(d => !d)} />
}
