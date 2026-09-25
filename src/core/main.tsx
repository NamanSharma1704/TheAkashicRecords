import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import App from './App'
import '../styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {/* "user" makes every Motion transform and layout animation follow the OS
            prefers-reduced-motion setting — drifts, spins, scales and parallax stop,
            while opacity fades (which carry no movement) still play. */}
        <MotionConfig reducedMotion="user">
            <App />
        </MotionConfig>
    </React.StrictMode>,
)
