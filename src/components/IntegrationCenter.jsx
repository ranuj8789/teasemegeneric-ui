import { CheckCircle2, KeyRound, LoaderCircle, Mail, PlugZap, Save, Send, ShieldCheck, Webhook } from 'lucide-react'
import { useEffect, useState } from 'react'
import { crmApi, getErrorMessage } from '../api/crmApi'

const emptyEmail = {
  connectorKey: 'PRIMARY_EMAIL',
  connectorType: 'SMTP',
  displayName: 'Primary email',
  provider: 'SMTP',
  fromName: '',
  fromEmail: '',
  host: '',
  port: '587',
  username: '',
  password: '',
  secure: true,
  active: true,
}

function IntegrationCenter({ onNotice }) {
  const [email, setEmail] = useState(emptyEmail)
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await crmApi.listConnectors()
      setConnectors(Array.isArray(rows) ? rows : [])
      const configured = (Array.isArray(rows) ? rows : []).find((row) => row.connectorKey === 'PRIMARY_EMAIL')
      if (configured?.config && typeof configured.config === 'object') {
        setEmail((current) => ({ ...current, ...configured.config, id: configured.id, connectorKey: configured.connectorKey, connectorType: configured.connectorType, displayName: configured.displayName, active: configured.active }))
      }
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const update = (key, value) => setEmail((current) => ({ ...current, [key]: value }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await crmApi.saveEmailConnector(email)
      setEmail((current) => ({ ...current, id: saved.id, password: '' }))
      onNotice?.('Connector saved in the backend configuration registry.')
      await refresh()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setError('')
    try {
      await crmApi.testEmailConnector(email)
      onNotice?.('Connector configuration validated and execution logged.')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setTesting(false)
    }
  }

  return <section className="workspace-page integration-page">
    <header className="integration-hero"><div><span className="eyebrow">Extensible capabilities</span><h1>Integration Center</h1><p>Configure reusable connectors once and reference them by stable keys from generic actions and workflows.</p></div><div className="integration-summary"><PlugZap size={20}/><strong>{connectors.length}</strong><span>Configured connectors</span></div></header>
    {error && <div className="notice-banner error">{error}</div>}
    {loading ? <div className="state-card"><LoaderCircle className="spin"/><strong>Loading connectors</strong></div> : <div className="integration-layout">
      <form className="surface-card connector-form" onSubmit={save}>
        <div className="section-title-row"><div><span className="eyebrow">Email connector</span><h2>SMTP configuration</h2></div><Mail size={21}/></div>
        <div className="form-grid-two">
          <label><span>Connector key</span><input required value={email.connectorKey} onChange={(e) => update('connectorKey', e.target.value)} /></label>
          <label><span>Display name</span><input required value={email.displayName} onChange={(e) => update('displayName', e.target.value)} /></label>
          <label><span>From name</span><input value={email.fromName} onChange={(e) => update('fromName', e.target.value)} /></label>
          <label><span>From email</span><input type="email" value={email.fromEmail} onChange={(e) => update('fromEmail', e.target.value)} /></label>
          <label><span>SMTP host</span><input required value={email.host} onChange={(e) => update('host', e.target.value)} /></label>
          <label><span>Port</span><input required value={email.port} onChange={(e) => update('port', e.target.value)} /></label>
          <label><span>Username</span><input value={email.username} onChange={(e) => update('username', e.target.value)} /></label>
          <label><span>Password / API key</span><input type="password" value={email.password} onChange={(e) => update('password', e.target.value)} placeholder={email.id ? 'Leave blank to keep existing secret' : ''}/></label>
        </div>
        <label className="switch-row"><input type="checkbox" checked={email.secure} onChange={(e) => update('secure', e.target.checked)}/><span>Use secure TLS connection</span></label>
        <div className="connector-actions"><button className="button button-secondary" type="button" onClick={test} disabled={testing || !email.host}><Send size={16}/>{testing ? 'Testing…' : 'Validate connector'}</button><button className="button button-primary" disabled={saving}><Save size={16}/>{saving ? 'Saving…' : 'Save connector'}</button></div>
      </form>
      <aside className="surface-card connector-contract"><ShieldCheck size={24}/><h2>Safe connector contract</h2><p>Actions store only a connector key. Credentials remain outside action JSON and are never returned to the browser.</p><pre>{`{\n  "operation": "EMAIL_SEND",\n  "connectorKey": "${email.connectorKey}",\n  "to": { "source": "RECORD_FIELD", "field": "email" },\n  "templateKey": "CONFIGURED_TEMPLATE_KEY"\n}`}</pre><div className="connector-status"><CheckCircle2 size={17}/><span>{email.id ? 'Saved backend connector' : 'Not saved yet'}</span></div></aside>
    </div>}
    <section className="extension-grid"><article><Webhook size={20}/><strong>HTTP & webhooks</strong><p>Use the same connector registry for allow-listed endpoints and credentials.</p></article><article><KeyRound size={20}/><strong>Secrets</strong><p>Production should replace the JSON secret column with KMS/Vault-backed encryption.</p></article></section>
  </section>
}

export default IntegrationCenter
