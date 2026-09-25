import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import App from './App'
import '../styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {/* "user": under prefers-reduced-motion, motion drops transform and layout
            animation (spins, drifts, slides, springs) and keeps opacity and colour, so
            state changes still read without anything travelling across the screen. */}
        <MotionConfig reducedMotion="user">
            <App />
        </MotionConfig>
    </React.StrictMode>,
)
