import { LockKeyhole, LoaderCircle, Shirt } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '../api/crmApi'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await login(username, password) } catch (e) { setError(getErrorMessage(e)) } finally { setBusy(false) }
  }

  return <div className="login-page">
    <div className="login-visual">
      <div className="login-brand"><div className="brand-mark"><Shirt size={28}/></div><div><strong>TeaseMe ERP</strong><span>Generic Java business engine</span></div></div>
      <div className="login-copy"><span className="eyebrow">Secure workspace</span><h1>Inventory, workflows and approvals in one engine.</h1><p>Every user signs in. Roles, fields and operations are controlled from metadata.</p></div>
    </div>
    <form className="login-card" onSubmit={submit}>
      <div className="login-lock"><LockKeyhole size={25}/></div><h2>Sign in</h2><p>Use your institute account to continue.</p>
      {error && <div className="login-error">{error}</div>}
      <label>Username<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="ranuj"/></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/></label>
      <button className="button button-primary login-submit" disabled={busy || !username || !password}>{busy?<LoaderCircle className="spin" size={18}/>:<LockKeyhole size={18}/>} Sign in</button>
      <small>Accounts are scoped to the configured client and app.</small>
    </form>
  </div>
}
