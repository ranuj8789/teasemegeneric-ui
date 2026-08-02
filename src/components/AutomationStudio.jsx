import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Braces, CalendarClock, Plus, RefreshCw,
  ShieldCheck, Workflow, X, Zap, Trash2,
} from 'lucide-react'
import { crmApi, getErrorMessage } from '../api/crmApi'
import { activeFields } from '../utils/schemaRuntime'

const primitives = [
  ['VALIDATE', 'Validate a configured condition'],
  ['QUERY_RECORDS', 'Query records in any configured module'],
  ['CREATE_RECORD', 'Create a record in a configured module'],
  ['UPDATE_FIELDS', 'Update the current record'],
  ['UPDATE_REFERENCED_RECORD', 'Update another record resolved from a reference'],
  ['PUBLISH_EVENT', 'Publish any registered event'],
  ['CALL_ACTION', 'Call another reusable action'],
  ['FOR_EACH', 'Iterate a configured collection'],
]

const emptyDraft = {
  kind: 'EVENT',
  title: '',
  technicalKey: '',
  category: 'CUSTOM',
  scopeType: 'APP',
  schemaId: '',
  eventKey: '',
  fieldKey: '',
  changeMode: 'ANY',
  actionId: '',
  workflowId: '',
  priority: 100,
  failurePolicy: 'ALL_OR_NOTHING',
  cronExpression: 'DAILY@23:55',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  steps: [],
}

function normalizeKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_')
}

function moduleLabel(schema) {
  return schema?.title || schema?.module || schema?.id || 'Module'
}

function defaultStep(operation, schemaId = '') {
  if (operation === 'VALIDATE') return { operation, condition: true, message: 'Validation failed' }
  if (operation === 'QUERY_RECORDS') return { operation, moduleKey: '', whereEquals: {}, saveAs: 'records' }
  if (operation === 'CREATE_RECORD') return { operation, moduleKey: '', fields: {} }
  if (operation === 'UPDATE_FIELDS') return { operation, values: {} }
  if (operation === 'UPDATE_REFERENCED_RECORD') return { operation, moduleKey: '', recordId: { source: 'RECORD_FIELD', field: '' }, values: {} }
  if (operation === 'PUBLISH_EVENT') return { operation, eventKey: '', payload: {} }
  if (operation === 'CALL_ACTION') return { operation, actionKey: '', input: {} }
  if (operation === 'FOR_EACH') return { operation, collection: { source: 'VARIABLE', name: 'records' }, itemVariable: 'item', steps: [] }
  return { operation }
}

function buildCondition(draft) {
  if (!draft.fieldKey || draft.changeMode === 'ANY') {
    return draft.fieldKey ? `#input['changes']['${draft.fieldKey}'] != null` : null
  }
  if (draft.changeMode === 'INCREASED') {
    return `#input['changes']['${draft.fieldKey}'] != null && #input['changes']['${draft.fieldKey}']['newValue'] > #input['changes']['${draft.fieldKey}']['oldValue']`
  }
  if (draft.changeMode === 'DECREASED') {
    return `#input['changes']['${draft.fieldKey}'] != null && #input['changes']['${draft.fieldKey}']['newValue'] < #input['changes']['${draft.fieldKey}']['oldValue']`
  }
  if (draft.changeMode === 'CLEARED') {
    return `#input['changes']['${draft.fieldKey}'] != null && #input['changes']['${draft.fieldKey}']['newValue'] == null`
  }
  return null
}

function DefinitionDialog({ open, onClose, onSaved, schemas, eventTypes, actions, workflows }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedSchema = schemas.find((item) => item.id === draft.schemaId)
  const fields = activeFields(selectedSchema)

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft)
      setError('')
    }
  }, [open])

  if (!open) return null

  const addStep = (operation) => {
    setDraft((current) => ({ ...current, steps: [...current.steps, defaultStep(operation, current.schemaId)] }))
  }

  const updateStep = (index, patch) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step),
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const key = normalizeKey(draft.technicalKey || draft.title)
      if (!key) throw new Error('Technical key is required')

      if (draft.kind === 'EVENT') {
        await crmApi.createEventType({
          eventKey: key,
          eventName: draft.title || key,
          category: draft.category || 'CUSTOM',
          scopeType: draft.scopeType,
          schemaId: draft.scopeType === 'MODULE' ? draft.schemaId : null,
          payloadSchema: {},
        })
      }

      if (draft.kind === 'ACTION') {
        if (!draft.steps.length) throw new Error('Add at least one action step')
        await crmApi.validateActionProgram(draft.steps)
        await crmApi.saveAction({
          actionKey: key,
          title: draft.title || key,
          schemaId: draft.scopeType === 'MODULE' ? draft.schemaId : null,
          actionType: 'JSON_PROGRAM',
          inputDefinition: [],
          outputDefinition: [],
          config: { program: draft.steps },
          virtualAction: true,
          active: true,
          version: 1,
        })
      }

      if (draft.kind === 'WORKFLOW') {
        if (!draft.steps.length) throw new Error('Add at least one workflow step')
        await crmApi.saveWorkflow({
          workflowKey: key,
          title: draft.title || key,
          schemaId: draft.scopeType === 'MODULE' ? draft.schemaId : null,
          steps: draft.steps,
          compensationSteps: [],
          failurePolicy: draft.failurePolicy,
          active: true,
          version: 1,
        })
      }

      if (draft.kind === 'TRIGGER') {
        if (!draft.schemaId) throw new Error('Select a module')
        if (!draft.eventKey) throw new Error('Select an event')
        if (!draft.actionId && !draft.workflowId) throw new Error('Select an action or workflow')
        await crmApi.saveTrigger({
          schemaId: draft.schemaId,
          eventType: draft.eventKey,
          conditionExpression: buildCondition(draft),
          actionId: draft.actionId || null,
          workflowId: draft.workflowId || null,
          priority: Number(draft.priority || 100),
          active: true,
        })
      }

      if (draft.kind === 'SCHEDULE') {
        if (!draft.eventKey) throw new Error('Select an event')
        await crmApi.saveEventSchedule({
          title: draft.title || key,
          eventKey: draft.eventKey,
          schemaId: draft.scopeType === 'MODULE' ? draft.schemaId : null,
          cronExpression: draft.cronExpression,
          timezone: draft.timezone,
          active: true,
          payload: {},
        })
      }

      await onSaved()
      onClose()
    } catch (exception) {
      setError(getErrorMessage(exception) || exception.message)
    } finally {
      setSaving(false)
    }
  }

  return (
      <div className="studio-dialog-backdrop" role="presentation">
        <form className="studio-dialog studio-dialog-wide" onSubmit={save}>
          <header>
            <div>
              <span className="eyebrow">Automation definition</span>
              <h2>Create reusable definition</h2>
              <p>Modules, fields, events, actions and workflows are selected from metadata. No business module name is embedded in the UI.</p>
            </div>
            <button type="button" className="icon-button" onClick={onClose}><X size={19}/></button>
          </header>

          {error && <div className="notice-banner error">{error}</div>}

          <div className="definition-kind-grid">
            {['EVENT', 'ACTION', 'WORKFLOW', 'TRIGGER', 'SCHEDULE'].map((kind) => (
                <button key={kind} type="button" className={draft.kind === kind ? 'selected' : ''} onClick={() => setDraft({ ...emptyDraft, kind })}>{kind}</button>
            ))}
          </div>

          <div className="form-grid-two">
            <label><span>Name</span><input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Readable business name"/></label>
            <label><span>Technical key</span><input value={draft.technicalKey} onChange={(e) => setDraft({ ...draft, technicalKey: e.target.value })} placeholder="Generated when empty"/></label>
            <label><span>Scope</span><select value={draft.scopeType} onChange={(e) => setDraft({ ...draft, scopeType: e.target.value, schemaId: '', fieldKey: '' })}><option value="APP">Application-wide</option><option value="MODULE">Specific module</option></select></label>
            {draft.scopeType === 'MODULE' && <label><span>Module</span><select required value={draft.schemaId} onChange={(e) => setDraft({ ...draft, schemaId: e.target.value, fieldKey: '' })}><option value="">Select module</option>{schemas.map((schema) => <option key={schema.id} value={schema.id}>{moduleLabel(schema)}</option>)}</select></label>}
          </div>

          {draft.kind === 'EVENT' && <label><span>Category</span><input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}/></label>}

          {draft.kind === 'TRIGGER' && (
              <div className="form-grid-two">
                <label><span>Registered event</span><select required value={draft.eventKey} onChange={(e) => setDraft({ ...draft, eventKey: e.target.value })}><option value="">Select event</option>{eventTypes.map((item) => <option key={item.eventKey} value={item.eventKey}>{item.eventName || item.eventKey}</option>)}</select></label>
                <label><span>Field filter (optional)</span><select value={draft.fieldKey} onChange={(e) => setDraft({ ...draft, fieldKey: e.target.value })}><option value="">Any field</option>{fields.map((field) => <option key={field.key} value={field.key}>{field.label || field.key}</option>)}</select></label>
                <label><span>Change condition</span><select value={draft.changeMode} onChange={(e) => setDraft({ ...draft, changeMode: e.target.value })}><option value="ANY">Any change</option><option value="INCREASED">Value increased</option><option value="DECREASED">Value decreased</option><option value="CLEARED">Value cleared</option></select></label>
                <label><span>Priority</span><input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}/></label>
                <label><span>Workflow</span><select value={draft.workflowId} onChange={(e) => setDraft({ ...draft, workflowId: e.target.value, actionId: '' })}><option value="">None</option>{workflows.filter((item) => !item.schemaId || item.schemaId === draft.schemaId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <label><span>Action</span><select value={draft.actionId} onChange={(e) => setDraft({ ...draft, actionId: e.target.value, workflowId: '' })}><option value="">None</option>{actions.filter((item) => !item.schemaId || item.schemaId === draft.schemaId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              </div>
          )}

          {(draft.kind === 'ACTION' || draft.kind === 'WORKFLOW') && (
              <>
                {draft.kind === 'WORKFLOW' && <label><span>Failure policy</span><select value={draft.failurePolicy} onChange={(e) => setDraft({ ...draft, failurePolicy: e.target.value })}><option value="ALL_OR_NOTHING">All or nothing</option><option value="BEST_EFFORT">Best effort</option><option value="COMPENSATE">Compensate</option></select></label>}
                <div className="primitive-picker">
                  {primitives.map(([operation]) => <button type="button" key={operation} onClick={() => addStep(operation)}><Plus size={14}/>{operation}</button>)}
                </div>
                <div className="visual-step-list">
                  {draft.steps.map((step, index) => (
                      <article key={`${step.operation}-${index}`}>
                        <header><strong>{index + 1}. {step.operation}</strong><button type="button" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15}/></button></header>
                        {['QUERY_RECORDS','CREATE_RECORD','UPDATE_REFERENCED_RECORD'].includes(step.operation) && <label><span>Target module</span><select value={schemas.find((item) => item.module === step.moduleKey)?.id || ''} onChange={(e) => updateStep(index, { moduleKey: schemas.find((item) => item.id === e.target.value)?.module || '' })}><option value="">Select module</option>{schemas.map((schema) => <option key={schema.id} value={schema.id}>{moduleLabel(schema)}</option>)}</select></label>}
                        {step.operation === 'UPDATE_REFERENCED_RECORD' && <>
                          <label><span>Reference field on current record</span><select value={step.recordId?.field || ''} onChange={(e) => updateStep(index, { recordId: { source: 'RECORD_FIELD', field: e.target.value } })}><option value="">Select reference field</option>{fields.filter((field) => String(field.type).toUpperCase() === 'REFERENCE').map((field) => <option key={field.key} value={field.key}>{field.label || field.key}</option>)}</select></label>
                          <label><span>Values JSON</span><textarea rows="4" value={JSON.stringify(step.values || {}, null, 2)} onChange={(e) => { try { updateStep(index, { values: JSON.parse(e.target.value) }) } catch {} }}/></label>
                        </>}
                        {step.operation === 'UPDATE_FIELDS' && <label><span>Values JSON</span><textarea rows="4" value={JSON.stringify(step.values || {}, null, 2)} onChange={(e) => { try { updateStep(index, { values: JSON.parse(e.target.value) }) } catch {} }}/></label>}
                        {step.operation === 'CREATE_RECORD' && <label><span>Fields JSON</span><textarea rows="4" value={JSON.stringify(step.fields || {}, null, 2)} onChange={(e) => { try { updateStep(index, { fields: JSON.parse(e.target.value) }) } catch {} }}/></label>}
                        {step.operation === 'QUERY_RECORDS' && <label><span>Save result as</span><input value={step.saveAs || ''} onChange={(e) => updateStep(index, { saveAs: e.target.value })}/></label>}
                        {step.operation === 'PUBLISH_EVENT' && <label><span>Event</span><select value={step.eventKey || ''} onChange={(e) => updateStep(index, { eventKey: e.target.value })}><option value="">Select event</option>{eventTypes.map((item) => <option key={item.eventKey} value={item.eventKey}>{item.eventName || item.eventKey}</option>)}</select></label>}
                        {step.operation === 'CALL_ACTION' && <label><span>Action</span><select value={step.actionKey || ''} onChange={(e) => updateStep(index, { actionKey: e.target.value })}><option value="">Select action</option>{actions.map((item) => <option key={item.id} value={item.actionKey}>{item.title}</option>)}</select></label>}
                        {step.operation === 'VALIDATE' && <label><span>Condition expression JSON</span><textarea rows="3" value={JSON.stringify(step.condition, null, 2)} onChange={(e) => { try { updateStep(index, { condition: JSON.parse(e.target.value) }) } catch {} }}/></label>}
                      </article>
                  ))}
                  {!draft.steps.length && <div className="mini-empty">Add engine primitives to build the definition.</div>}
                </div>
                <details className="advanced-json"><summary>Advanced JSON</summary><textarea rows="14" value={JSON.stringify(draft.steps, null, 2)} onChange={(e) => { try { setDraft({ ...draft, steps: JSON.parse(e.target.value) }) } catch {} }}/></details>
              </>
          )}

          {draft.kind === 'SCHEDULE' && (
              <div className="form-grid-two">
                <label><span>Event</span><select required value={draft.eventKey} onChange={(e) => setDraft({ ...draft, eventKey: e.target.value })}><option value="">Select event</option>{eventTypes.map((item) => <option key={item.eventKey} value={item.eventKey}>{item.eventName || item.eventKey}</option>)}</select></label>
                <label><span>Schedule</span><input value={draft.cronExpression} onChange={(e) => setDraft({ ...draft, cronExpression: e.target.value })}/></label>
              </div>
          )}

          <footer className="dialog-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
            <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save definition'}</button>
          </footer>
        </form>
      </div>
  )
}

export default function AutomationStudio({ schemas = [], onOpenIntegrations }) {
  const [activeTab, setActiveTab] = useState('events')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [eventTypes, setEventTypes] = useState([])
  const [schedules, setSchedules] = useState([])
  const [actions, setActions] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [triggers, setTriggers] = useState([])
  const [executions, setExecutions] = useState([])
  const [error, setError] = useState('')

  const refresh = async () => {
    setError('')
    try {
      const [types, scheduleRows, actionRows, workflowRows, triggerRows, executionRows] = await Promise.all([
        crmApi.listEventTypes(),
        crmApi.listEventSchedules().catch(() => []),
        crmApi.listActions().catch(() => []),
        crmApi.listWorkflows().catch(() => []),
        crmApi.listTriggers().catch(() => []),
        crmApi.listAutomationExecutions().catch(() => []),
      ])
      setEventTypes(Array.isArray(types) ? types : [])
      setSchedules(Array.isArray(scheduleRows) ? scheduleRows : [])
      setActions(Array.isArray(actionRows) ? actionRows : [])
      setWorkflows(Array.isArray(workflowRows) ? workflowRows : [])
      setTriggers(Array.isArray(triggerRows) ? triggerRows : [])
      setExecutions(Array.isArray(executionRows) ? executionRows : [])
    } catch (exception) {
      setError(getErrorMessage(exception))
    }
  }

  useEffect(() => { refresh() }, [])
  const definitions = useMemo(() => actions.length + workflows.length + triggers.length, [actions, workflows, triggers])

  return (
      <section className="workspace-page automation-page">
        <header className="automation-hero">
          <div><span className="eyebrow">Configurable runtime</span><h1>Automation Studio</h1><p>User-defined events, actions, workflows and triggers are bound to module and field metadata.</p></div>
          <div className="hero-actions"><button className="button button-secondary" type="button" onClick={refresh}><RefreshCw size={17}/> Refresh</button><button className="button button-primary" type="button" onClick={() => setDialogOpen(true)}><Plus size={18}/> New definition</button></div>
        </header>

        {error && <div className="notice-banner error">{error}</div>}

        <div className="automation-metrics">
          <article><Workflow size={19}/><strong>{eventTypes.length}</strong><span>Events</span></article>
          <article><CalendarClock size={19}/><strong>{schedules.length}</strong><span>Schedules</span></article>
          <article><Braces size={19}/><strong>{definitions}</strong><span>Definitions</span></article>
          <article><Activity size={19}/><strong>{executions.length}</strong><span>Executions</span></article>
        </div>

        <div className="studio-tabs">
          {[
            ['events','Events',eventTypes.length],
            ['definitions','Definitions',definitions],
            ['schedules','Schedules',schedules.length],
            ['runtime','Runtime',primitives.length],
          ].map(([key,label,count]) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}><span>{label}</span><b>{count}</b></button>)}
        </div>

        {activeTab === 'events' && <section className="surface-card studio-panel"><h2>Event registry</h2><div className="event-table"><div className="event-table-head"><span>Name</span><span>Key</span><span>Category</span><span>Type</span></div>{eventTypes.map((item) => <article key={item.id || item.eventKey}><strong>{item.eventName || item.eventKey}</strong><code>{item.eventKey}</code><span>{item.category || 'General'}</span><b>{item.systemEvent ? 'System' : 'Custom'}</b></article>)}</div></section>}

        {activeTab === 'definitions' && <div className="studio-layout"><section className="surface-card studio-panel"><h2>Actions and workflows</h2><div className="event-table"><div className="event-table-head"><span>Name</span><span>Key</span><span>Module</span><span>Type</span></div>{actions.map((item) => <article key={item.id}><strong>{item.title}</strong><code>{item.actionKey}</code><span>{schemas.find((schema) => schema.id === item.schemaId)?.title || 'App'}</span><b>Action</b></article>)}{workflows.map((item) => <article key={item.id}><strong>{item.title}</strong><code>{item.workflowKey}</code><span>{schemas.find((schema) => schema.id === item.schemaId)?.title || 'App'}</span><b>Workflow</b></article>)}</div></section><section className="surface-card studio-panel"><h2>Triggers</h2>{triggers.map((item) => <article className="automation-trigger-row" key={item.id}><Zap size={17}/><div><strong>{item.eventType}</strong><small>{schemas.find((schema) => schema.id === item.schemaId)?.title || item.schemaId}</small><code>{item.conditionExpression || 'Always'}</code></div></article>)}</section></div>}

        {activeTab === 'schedules' && <section className="surface-card studio-panel"><h2>Schedules</h2>{schedules.map((item) => <article className="automation-trigger-row" key={item.id}><CalendarClock size={17}/><div><strong>{item.title}</strong><small>{item.eventKey}</small><code>{item.cronExpression}</code></div></article>)}</section>}

        {activeTab === 'runtime' && <div className="runtime-grid">{primitives.map(([name, description]) => <article className="runtime-card" key={name}><Zap size={18}/><h3>{name}</h3><p>{description}</p></article>)}</div>}

        <div className="studio-generic-note"><ShieldCheck size={22}/><div><h3>Business meaning stays in metadata</h3><p>Java provides only safe runtime primitives. Module names, field keys, event keys, actions and workflows are user-defined.</p><button type="button" className="button button-secondary" onClick={onOpenIntegrations}>Configure integrations</button></div></div>

        <DefinitionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={refresh} schemas={schemas} eventTypes={eventTypes} actions={actions} workflows={workflows}/>
      </section>
  )
}
