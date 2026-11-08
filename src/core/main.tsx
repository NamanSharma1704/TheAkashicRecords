import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import App from './App'
import ErrorBoundary from '../components/system/ErrorBoundary'
import '../styles/index.css'

// On iPhone and iPad, every browser (Safari, Edge, Chrome, Firefox) runs Safari's engine, and
// it zooms into any text field under 16px the moment it is focused, then stays zoomed: the
// chapter field, the search, the editor's fields. A viewport capped at maximum-scale=1 stops
// that, and iOS still lets the reader pinch-zoom (it ignores the cap for gestures). iOS only:
// Android browsers do not auto-zoom, and there the cap would block pinch-zoom. Here rather
// than in index.html because the site's CSP allows no inline script.
{
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
    const viewport = document.querySelector('meta[name="viewport"]');
    if (ios && viewport && !/maximum-scale/.test(viewport.getAttribute('content') || '')) {
        viewport.setAttribute('content', `${viewport.getAttribute('content')}, maximum-scale=1`);
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {/* "user": under prefers-reduced-motion, motion drops transform and layout
            animation (spins, drifts, slides, springs) and keeps opacity and colour, so
            state changes still read without anything travelling across the screen. */}
        <MotionConfig reducedMotion="user">
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </MotionConfig>
    </React.StrictMode>,
)
