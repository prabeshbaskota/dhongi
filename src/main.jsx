import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { unlockAudio } from './lib/sound.js'

window.addEventListener('pointerdown', unlockAudio, { once: true })

createRoot(document.getElementById('root')).render(<App />)
