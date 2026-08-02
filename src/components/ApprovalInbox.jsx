import { AlertTriangle, Check, ClipboardCheck, Clock3, RefreshCw, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { crmApi, getErrorMessage } from '../api/crmApi'

const parsePayload = (request) => {
  const raw = request?.request_payload ?? request?.requestPayload ?? {}
  if (raw && typeof raw === 'object') return raw
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

const valueOf = (request, ...keys) => {
  for (const key of keys) {
    const value = request?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return null
}

const titleOf = (request) => {
  const targetType = String(valueOf(request, 'target_type', 'targetType') || 'RECORD').replaceAll('_', ' ')
  return `${String(valueOf(request, 'request_type', 'requestType') || 'DELETE').replaceAll('_', ' ')} ${targetType}`
}

const readable = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ApprovalInbox({ requests = [], loading = false, onRefresh, onChanged }) {
  const [selected, setSelected] = useState(null)
  const [comments, setComments] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const sorted = useMemo(() => [...requests].sort((a, b) => {
    const left = new Date(valueOf(a, 'requested_at', 'requestedAt') || 0).getTime()
    const right = new Date(valueOf(b, 'requested_at', 'requestedAt') || 0).getTime()
    return left - right
  }), [requests])

  const decide = async (request, approve) => {
    const id = valueOf(request, 'id')
    if (!id) return
    setBusyId(id)
    setError('')
    try {
      if (approve) await crmApi.approveRequest(id, comments)
      else await crmApi.rejectRequest(id, comments)
      setSelected(null)
      setComments('')
      await onChanged?.(approve ? 'Approval accepted and operation executed.' : 'Approval request rejected.')
    } catch (decisionError) {
      setError(getErrorMessage(decisionError))
    } finally {
      setBusyId('')
    }
  }

  return (
      <section className="approval-page">
        <header className="approval-page-header">
          <div>
            <span className="eyebrow">Generic operation engine</span>
            <h1>Approvals</h1>
            <p>Only operations configured with <code>approvalRequired: true</code> should appear here.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'spin' : ''}/> Refresh
          </button>
        </header>

        {error && <div className="alert alert-error"><AlertTriangle size={18}/><span>{error}</span></div>}

        {!sorted.length ? (
            <div className="state-card approval-empty">
              <ClipboardCheck size={34}/>
              <strong>No pending approvals</strong>
              <span>Configured record, field, media, action or module requests will appear here.</span>
            </div>
        ) : (
            <div className="approval-list">
              {sorted.map((request) => {
                const id = valueOf(request, 'id')
                const payload = parsePayload(request)
                const requestedAt = valueOf(request, 'requested_at', 'requestedAt')
                const module = valueOf(request, 'module') || payload.module || '—'
                const label = payload.targetLabel || payload.moduleTitle || payload.identifier || valueOf(request, 'record_id', 'recordId') || payload.recordId || payload.targetKey
                return (
                    <article className="approval-card" key={id}>
                      <div className="approval-icon"><Trash2 size={19}/></div>
                      <div className="approval-copy">
                        <div className="approval-card-title"><strong>{titleOf(request)}</strong><span className="pending-pill"><Clock3 size={13}/> Pending</span></div>
                        <p><b>{payload.moduleTitle || module}</b>{label ? ` · ${label}` : ''}</p>
                        <small>{requestedAt ? new Date(requestedAt).toLocaleString() : ''}</small>
                      </div>
                      <button className="button button-secondary compact" type="button" onClick={() => { setSelected(request); setComments(''); setError('') }}>Review</button>
                    </article>
                )
              })}
            </div>
        )}

        {selected && (() => {
          const payload = parsePayload(selected)
          const id = valueOf(selected, 'id')
          const targetType = valueOf(selected, 'target_type', 'targetType') || 'RECORD'
          const snapshot = payload.fieldSnapshot && typeof payload.fieldSnapshot === 'object' ? payload.fieldSnapshot : {}
          const impact = payload.impact && typeof payload.impact === 'object' ? payload.impact : {}
          const requestReason = valueOf(selected, 'comments') || payload.reason
          return (
              <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
                <div className="approval-dialog approval-dialog-wide" role="dialog" aria-modal="true">
                  <header><div><span className="eyebrow">Approval review</span><h2>{titleOf(selected)}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)}><X size={18}/></button></header>

                  {payload.warning && (
                      <div className={`approval-warning ${payload.warningLevel === 'CRITICAL' ? 'critical' : ''}`}>
                        <AlertTriangle size={20}/>
                        <div><strong>{targetType === 'SCHEMA' ? 'Module deletion warning' : 'Review before executing'}</strong><span>{payload.warning}</span></div>
                      </div>
                  )}

                  <div className="approval-detail-grid">
                    <div><span>Module</span><strong>{payload.moduleTitle || valueOf(selected, 'module') || payload.module || '—'}</strong></div>
                    <div><span>Target type</span><strong>{targetType}</strong></div>
                    <div><span>What will be affected</span><strong>{payload.targetLabel || payload.identifier || valueOf(selected, 'record_id', 'recordId') || payload.recordId || payload.targetKey || '—'}</strong></div>
                    <div><span>Requested</span><strong>{valueOf(selected, 'requested_at', 'requestedAt') ? new Date(valueOf(selected, 'requested_at', 'requestedAt')).toLocaleString() : '—'}</strong></div>
                    {payload.fieldLabel && <div><span>Field</span><strong>{payload.fieldLabel}</strong></div>}
                    {payload.fieldCount !== undefined && <div><span>Schema fields</span><strong>{payload.fieldCount}</strong></div>}
                    {payload.identifier && <div><span>Identifier</span><strong>{payload.identifier}</strong></div>}
                    {payload.hard !== undefined && <div><span>Delete mode</span><strong>{payload.hard ? 'PERMANENT' : 'DEACTIVATE / SOFT'}</strong></div>}
                  </div>

                  {requestReason && <div className="approval-request-reason"><span>Request reason</span><strong>{requestReason}</strong></div>}

                  {Object.keys(snapshot).length > 0 && (
                      <section className="approval-snapshot">
                        <h3>Record snapshot</h3>
                        <div>{Object.entries(snapshot).map(([key, value]) => <p key={key}><span>{key}</span><strong title={readable(value)}>{readable(value)}</strong></p>)}</div>
                      </section>
                  )}

                  {targetType === 'SCHEMA' && Object.keys(impact).length > 0 && (
                      <section className="approval-snapshot">
                        <h3>Deletion impact</h3>
                        <div>{Object.entries(impact).map(([key, value]) => <p key={key}><span>{key.replaceAll(/([A-Z])/g, ' $1')}</span><strong>{readable(value)}</strong></p>)}</div>
                      </section>
                  )}

                  <label className="approval-comments"><span>Decision comments</span><textarea rows={3} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Optional reason or audit note"/></label>
                  <footer>
                    <button className="button button-secondary danger-action" type="button" disabled={busyId === id} onClick={() => decide(selected, false)}><X size={17}/> Reject</button>
                    <button className="button button-primary" type="button" disabled={busyId === id} onClick={() => decide(selected, true)}><Check size={17}/> Approve & execute</button>
                  </footer>
                </div>
              </div>
          )
        })()}
      </section>
  )
}

export default ApprovalInbox
