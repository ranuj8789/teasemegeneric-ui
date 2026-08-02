import { Eye, Grid2X2, ImageOff, List, LoaderCircle, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { crmApi, getErrorMessage, resolveMediaUrl } from '../api/crmApi'
import { activeFields, displayValue, fieldBySemantic, firstMediaValue } from '../utils/schemaRuntime'

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (field?.type === 'BOOLEAN') return value ? 'Yes' : 'No'
  return String(value)
}

function InventoryRecordsView({ schemas = [], onOpenModule }) {
  const activeSchemas = useMemo(() => schemas.filter((schema) => schema.active !== false), [schemas])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [moduleFilter, setModuleFilter] = useState('ALL')
  const [viewMode, setViewMode] = useState('table')

  const schemaByModule = useMemo(
      () => Object.fromEntries(activeSchemas.map((schema) => [schema.module, schema])),
      [activeSchemas],
  )

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await Promise.all(activeSchemas.map(async (schema) => {
        const records = await crmApi.listRecords(schema.module).catch(() => [])
        return (Array.isArray(records) ? records : []).map((record) => ({
          ...record,
          module: schema.module,
          moduleTitle: schema.title || schema.module,
        }))
      }))
      setItems(rows.flat())
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [activeSchemas])

  useEffect(() => { loadRecords() }, [loadRecords])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((record) => {
      if (moduleFilter !== 'ALL' && record.module !== moduleFilter) return false
      if (!needle) return true
      const schema = schemaByModule[record.module]
      return activeFields(schema).some((field) => String(record.data?.[field.key] ?? '').toLowerCase().includes(needle))
    })
  }, [items, moduleFilter, query, schemaByModule])

  const titleFor = (record) => {
    const schema = schemaByModule[record.module]
    return String(displayValue(schema, record.data, 'TITLE', ['TEXT', 'TEXTAREA'], record.moduleTitle))
  }

  const identifierFor = (record) => {
    const schema = schemaByModule[record.module]
    return String(displayValue(schema, record.data, 'IDENTIFIER', ['TEXT', 'NUMBER'], record.id || '—'))
  }

  if (loading) return <div className="state-card"><LoaderCircle className="spin" size={28}/><strong>Loading records</strong></div>

  return <section className="inventory-panel">
    <div className="panel-header">
      <div><h2>Records</h2><p>{filtered.length} of {items.length} records shown</p></div>
      <div className="record-view-actions">
        <button type="button" onClick={loadRecords}><RefreshCw size={16}/></button>
        <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}><List size={16}/></button>
        <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><Grid2X2 size={16}/></button>
      </div>
    </div>

    <div className="filter-bar">
      <label className="search-box"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search visible schema fields…"/>{query && <button type="button" onClick={() => setQuery('')}><X size={16}/></button>}</label>
      <label className="select-box"><span>Module</span><select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="ALL">All modules</option>{activeSchemas.map((schema) => <option key={schema.module} value={schema.module}>{schema.title || schema.module}</option>)}</select></label>
    </div>

    {error && <div className="error-banner">{error}</div>}

    {viewMode === 'table' ? <div className="record-table-wrap"><table className="record-table"><colgroup><col className="record-module-col"/><col className="record-title-col"/><col className="record-identifier-col"/><col className="record-action-col"/></colgroup><thead><tr><th>Module</th><th>Record</th><th>Identifier</th><th className="record-action-heading">Action</th></tr></thead><tbody>{filtered.map((record) => { const title = titleFor(record); const identifier = identifierFor(record); return <tr key={`${record.module}-${record.id}`}><td><span className="record-cell-text record-module-text" title={record.moduleTitle}>{record.moduleTitle}</span></td><td><strong className="record-cell-text" title={title}>{title}</strong></td><td><code className="record-cell-text" title={identifier}>{identifier}</code></td><td className="record-action-cell"><button className="record-open-button" type="button" onClick={() => onOpenModule?.(record.module, record)}><Eye size={16}/> Open</button></td></tr> })}</tbody></table></div>
        : <div className="record-card-grid">{filtered.map((record) => {
          const schema = schemaByModule[record.module]
          const image = firstMediaValue(schema, record.data, 'IMAGE')
          const listFields = activeFields(schema).filter((field) => field.showOnList === true).slice(0, 3)
          return <article className="record-card" key={`${record.module}-${record.id}`}>
            <div className="record-card-image">{image ? <img src={resolveMediaUrl(image)} alt={titleFor(record)}/> : <ImageOff size={28}/>}</div>
            <div className="record-card-body"><small>{record.moduleTitle}</small><h3>{titleFor(record)}</h3><p>{listFields.map((field) => `${field.label}: ${formatValue(field, record.data?.[field.key])}`).join(' · ') || identifierFor(record)}</p></div>
            <button type="button" onClick={() => onOpenModule?.(record.module, record)}><Eye size={16}/> Open</button>
          </article>
        })}</div>}
  </section>
}

export default InventoryRecordsView
