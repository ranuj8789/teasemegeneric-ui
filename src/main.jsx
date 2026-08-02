import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginPage from './components/LoginPage.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'

function Root() {
    const { user, loading } = useAuth()
    if (loading) return <div className="auth-loading">Loading secure workspace…</div>
    return user ? <App /> : <LoginPage />
}

createRoot(document.getElementById('root')).render(<StrictMode><AuthProvider><Root /></AuthProvider></StrictMode>)
