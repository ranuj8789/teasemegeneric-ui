import {
  AlertTriangle,
  ClipboardCheck,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Grid2X2,
  ImageOff,
  Layers3,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  LogOut,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import './schema-ui-sync.css'
import './App.generic-runtime.css'
import './launch-core.css'
import { crmApi, getErrorMessage, resolveMediaUrl } from './api/crmApi'
import ProductForm from './components/ProductForm'
import InventoryRecordsView from './components/InventoryRecordsView'
import SchemaBuilder from './components/SchemaBuilder'
import UserAdmin from './components/UserAdmin'
import ApprovalInbox from './components/ApprovalInbox'
import { useAuth } from './auth/AuthContext'
import { activeFields, displayValue, fieldBySemantic, firstMediaValue } from './utils/schemaRuntime'
import AutomationStudio from './components/AutomationStudio'
import IntegrationCenter from './components/IntegrationCenter'
import RecordDetailDialog from './components/RecordDetailDialog'

const DEFAULT_MODULE = null
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function App() {
  const { user, capabilities: accessCapabilities, hasPermission, canApproveAnyModule, logout } = useAuth()
  const [page, setPage] = useState('schema')
  const [schemaMode, setSchemaMode] = useState('modules')
  const [currentModule, setCurrentModule] = useState(DEFAULT_MODULE)
  const [records, setRecords] = useState([])
  const [schema, setSchema] = useState(null)
  const [schemas, setSchemas] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [stockFilter, setStockFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [viewingRecord, setViewingRecord] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [capabilities, setCapabilities] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [schemaListResult, metaResult] = await Promise.all([
        crmApi.listSchemas().catch(() => []),
        crmApi.getMeta().catch(() => null),
      ])

      const allActiveSchemas = Array.isArray(schemaListResult)
          ? schemaListResult.filter((item) => item.active !== false)
          : []
      const appWide = accessCapabilities?.appPermissions?.includes('APP_CONFIGURE')
      const moduleAccess = accessCapabilities?.modulePermissions || {}
      const activeSchemas = allActiveSchemas.filter((item) => appWide || Boolean(moduleAccess[item.id]?.includes('MODULE_VIEW')))

      setSchemas(activeSchemas)
      setMeta(metaResult)

      if (activeSchemas.length === 0) {
        setCurrentModule(null)
        setSchema(null)
        setRecords([])
        setFormOpen(false)
        setEditingRecord(null)
        setPage('schema')
        return
      }

      const selectedModule = currentModule && activeSchemas.some((item) => item.module === currentModule)
          ? currentModule
          : activeSchemas[0].module

      if (selectedModule !== currentModule) {
        setCurrentModule(selectedModule)
        return
      }

      const [schemaResult, recordResult, capabilityResult, approvalResult] = await Promise.all([
        crmApi.getSchema(selectedModule),
        crmApi.listRecords(selectedModule).catch(() => []),
        crmApi.getOperationCapabilities(selectedModule).catch(() => null),
        crmApi.listPendingApprovals().catch(() => []),
      ])

      setSchema(schemaResult)
      setRecords(Array.isArray(recordResult) ? recordResult : [])
      setCapabilities(capabilityResult)
      setPendingApprovals(Array.isArray(approvalResult) ? approvalResult : [])
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [currentModule, accessCapabilities])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const availableSchemas = useMemo(() => schemas.filter((item) => item.active !== false), [schemas])

  const categoryField = useMemo(() => fieldBySemantic(schema, 'CATEGORY'), [schema])
  const quantityField = useMemo(() => fieldBySemantic(schema, 'QUANTITY'), [schema])
  const priceField = useMemo(() => fieldBySemantic(schema, 'PRICE'), [schema])
  const costField = useMemo(() => fieldBySemantic(schema, 'COST'), [schema])

  const categories = useMemo(() => {
    if (!categoryField) return []
    const values = new Set(categoryField.options || [])
    records.forEach((record) => record.data?.[categoryField.key] && values.add(String(record.data[categoryField.key])))
    return Array.from(values)
  }, [categoryField, records])

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return records.filter((record) => {
      const data = record.data || {}
      const quantity = quantityField ? Number(data[quantityField.key] ?? 0) : null
      const searchMatch = !query || activeFields(schema).some((field) => String(data[field.key] ?? '').toLowerCase().includes(query))
      const categoryMatch = category === 'ALL' || !categoryField || String(data[categoryField.key] || '') === category
      const stockMatch = !quantityField || stockFilter === 'ALL'
          || (stockFilter === 'LOW' && quantity > 0 && quantity <= Number(quantityField.config?.lowThreshold ?? 5))
          || (stockFilter === 'OUT' && quantity <= 0)
          || (stockFilter === 'IN' && quantity > 0)
      return searchMatch && categoryMatch && stockMatch
    })
  }, [records, search, category, stockFilter, schema, categoryField, quantityField])

  const stats = useMemo(() => records.reduce((result, record) => {
    const data = record.data || {}
    const quantity = quantityField ? Number(data[quantityField.key] || 0) : 0
    const cost = costField ? Number(data[costField.key] || 0) : 0
    const price = priceField ? Number(data[priceField.key] || 0) : 0
    const threshold = Number(quantityField?.config?.lowThreshold ?? 5)
    result.units += quantity
    result.costValue += quantity * cost
    result.retailValue += quantity * price
    if (quantityField && quantity > 0 && quantity <= threshold) result.lowStock += 1
    if (quantityField && quantity <= 0) result.outOfStock += 1
    return result
  }, { units: 0, costValue: 0, retailValue: 0, lowStock: 0, outOfStock: 0 }), [records, quantityField, costField, priceField])


  const saveProduct = async (payload, mediaFilesByField = {}) => {
    setSaving(true)
    setError('')
    try {
      const saved = editingRecord
          ? await crmApi.updateRecord(currentModule, editingRecord.id, payload)
          : await crmApi.createRecord(currentModule, payload)

      const pendingApproval = saved?.operationStatus === 'PENDING_APPROVAL'
          || saved?.status === 'PENDING'

      // A protected update has not changed the record yet. Keep all dependent
      // side effects (including new media uploads) behind the same approval.
      if (pendingApproval) {
        await loadData()
        setFormOpen(false)
        setEditingRecord(null)
        setNotice('Changes submitted for approval. The record is unchanged until approval.')
        return
      }

      const savedRecordId = saved?.recordId || saved?.id
      for (const [fieldKey, files] of Object.entries(mediaFilesByField)) {
        for (const file of files) {
          await crmApi.uploadMedia(currentModule, savedRecordId, fieldKey, file)
        }
      }

      await loadData()
      setFormOpen(false)
      setEditingRecord(null)
      setNotice(editingRecord ? 'Record updated.' : 'Record created.')
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const saveSchema = async (nextSchema) => {
    setSaving(true)
    setError('')
    try {
      const saved = await crmApi.updateSchema(currentModule, nextSchema)
      setSchema(saved)
      setSchemas((current) => {
        const remaining = current.filter((item) => item.module !== saved.module)
        return [...remaining, saved].sort((a, b) => a.module.localeCompare(b.module))
      })
      if (saved.module && saved.module !== currentModule) setCurrentModule(saved.module)
      setNotice('Schema and reusable fields saved. The module UI has been refreshed.')
      return saved
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const createSchema = async (nextSchema) => {
    setSaving(true)
    setError('')
    try {
      const saved = await crmApi.createSchema(nextSchema)
      setCurrentModule(saved.module)
      setSchema(saved)
      setSchemas((current) => [...current.filter((item) => item.module !== saved.module), saved].sort((a, b) => a.module.localeCompare(b.module)))
      setRecords([])
      setPage('schema')
      setNotice(`Schema “${saved.title || saved.module}” created. Add reusable fields now.`)
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }


  const deleteSchema = async (targetSchema) => {
    if (!targetSchema?.module) return
    setSaving(true)
    setError('')
    try {
      const usage = await crmApi.analyzeSchemaDeletion(targetSchema.module)
      const details = [
        ...(usage.childModules || []).map((item) => `child: ${item}`),
        ...(usage.incomingReferences || []).map((item) => `reference: ${item}`),
        ...(usage.hasRecords ? ['active records exist'] : []),
      ]
      const message = details.length
          ? `This module is in use (${details.join(', ')}). It will be deactivated, not hard deleted. Continue?`
          : 'Delete this module permanently?'
      if (!window.confirm(message)) return
      await crmApi.deleteSchema(targetSchema.module, Boolean(usage.canHardDelete), 'Requested from schema manager')
      setNotice('Module deletion request submitted for approval. The module remains active until approved.')
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    } finally {
      setSaving(false)
    }
  }


  const deleteAllSchemas = async () => {
    if (!schemas.length) return
    const confirmed = window.confirm(
        `Delete all ${schemas.length} modules? Child modules will be removed first. Modules containing records may be deactivated instead of permanently deleted.`
    )
    if (!confirmed) return

    setSaving(true)
    setError('')
    try {
      const ordered = [...schemas].sort((a, b) => (b.depth || 1) - (a.depth || 1))
      const failures = []

      for (const target of ordered) {
        try {
          const usage = await crmApi.analyzeSchemaDeletion(target.module)
          await crmApi.deleteSchema(target.module, Boolean(usage.canHardDelete))
        } catch (deleteError) {
          failures.push(`${target.title || target.module}: ${getErrorMessage(deleteError)}`)
        }
      }

      const remaining = await crmApi.listSchemas().catch(() => [])
      const activeRemaining = Array.isArray(remaining) ? remaining.filter((item) => item.active !== false) : []
      setSchemas(activeRemaining)
      setRecords([])
      setSchema(null)

      if (activeRemaining.length) {
        setCurrentModule(activeRemaining[0].module)
      } else {
        setCurrentModule(null)
        setPage('schema')
      }

      if (failures.length) {
        setError(`Some modules could not be removed: ${failures.join(' | ')}`)
      } else {
        setNotice('All modules removed from the active CRM structure.')
      }
    } finally {
      setSaving(false)
    }
  }

  const removeExistingMedia = async (fieldKey, url) => {
    if (!editingRecord) return
    setSaving(true)
    setError('')
    try {
      const request = await crmApi.removeMedia(currentModule, editingRecord.id, fieldKey, url)
      setPendingApprovals((current) => [...current, request])
      setNotice('Media removal request submitted for approval. The media remains until approved.')
    } catch (removeError) {
      setError(getErrorMessage(removeError))
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      const request = await crmApi.deleteRecord(currentModule, deleteTarget.id)
      setPendingApprovals((current) => [...current, request])
      setDeleteTarget(null)
      setDeleteReason('')
      setNotice('Deletion request submitted. The record remains visible until approval.')
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    if (!schema?.fields?.length) {
      setPage('schema')
      setNotice('Add and save schema fields before creating a record.')
      return
    }
    setEditingRecord(null)
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditingRecord(record)
    setFormOpen(true)
  }

  return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark"><Shirt size={25} /></div>
            <div><strong>{meta?.appName || 'Business Platform'}</strong><span>Configurable CRM / ERP</span></div>
          </div>

          <nav className="nav-list" aria-label="Application navigation">
            <button className={`nav-item ${page === 'inventory' ? 'active' : ''}`} type="button" onClick={() => setPage('inventory')}><Grid2X2 size={18} /> Workspace</button>
            <button className={`nav-item ${page === 'records' ? 'active' : ''}`} type="button" onClick={() => setPage('records')}><Boxes size={18} /> All records</button>
            {hasPermission('APP_MODULE_MANAGE') && <>
              <button className={`nav-item ${page === 'schema' && schemaMode === 'modules' ? 'active' : ''}`} type="button" onClick={() => { setSchemaMode('modules'); setPage('schema') }}><SlidersHorizontal size={18} /> Modules & schema</button>
              <button className={`nav-item ${page === 'schema' && schemaMode === 'fields' ? 'active' : ''}`} type="button" onClick={() => { setSchemaMode('fields'); setPage('schema') }}><Layers3 size={18} /> Field designer</button>
            </>}

            {hasPermission('APP_USER_MANAGE') && <button className={`nav-item ${page === 'users' ? 'active' : ''}`} type="button" onClick={() => setPage('users')}><Users size={18} /> Users & roles</button>}


          </nav>

          <div className="sidebar-user"><div className="user-avatar">{(user?.displayName || user?.username || 'U').slice(0,1).toUpperCase()}</div><div><strong>{user?.displayName}</strong><small>{(user?.roles || []).map((role) => typeof role === 'string' ? role : role.roleName || role.roleCode).filter(Boolean).join(' · ')}</small></div><button onClick={logout} title="Sign out"><LogOut size={17}/></button></div>

          <div className="scope-card">
            <div className="scope-icon"><Sparkles size={18} /></div>
            <div>
              <span>Current module</span>
              <strong>{schema?.title || meta?.appName || 'Business application'}</strong>
              <small>{currentModule || 'No active module'} · client/app isolated</small>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {error && (
              <div className="alert alert-error">
                <AlertTriangle size={18} /><span>{error}</span>
                <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={17} /></button>
              </div>
          )}
          {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}

          {page === 'users' ? (
              <UserAdmin schemas={schemas} canManageRoles={hasPermission('APP_ROLE_MANAGE')} />
          ) : page === 'automation' ? (
              <AutomationStudio schemas={schemas} onOpenIntegrations={() => setPage('integrations')} />
          ) : page === 'integrations' ? (
              <IntegrationCenter onNotice={setNotice} />
          ) : page === 'approvals' ? (
              <ApprovalInbox
                  requests={pendingApprovals}
                  loading={loading}
                  onRefresh={loadData}
                  onChanged={async (message) => {
                    setNotice(message)
                    await loadData()
                  }}
              />
          ) : page === 'schema' ? (
              hasPermission('APP_MODULE_MANAGE') ? <SchemaBuilder
                  schema={schema}
                  schemas={schemas}
                  mediaTypes={meta?.mediaTypes || []}
                  module={currentModule || ''}
                  saving={saving}
                  onCreateSchema={createSchema}
                  onSaveSchema={saveSchema}
                  onDeleteSchema={deleteSchema}
                  onDeleteAllSchemas={deleteAllSchemas}
                  mode={schemaMode}
                  onSelectSchema={(nextModule) => {
                    setCurrentModule(nextModule)
                    setPage('schema')
                  }}
                  onDeprecateField={async (field) => {
                    if (!field?.key || !currentModule) return
                    if (!window.confirm(`Deprecate "${field.label || field.key}"? Existing values will be retained.`)) return
                    try {
                      await crmApi.deprecateField(currentModule, field.key)
                      await loadSchemas()
                    } catch (exception) {
                      setError(getErrorMessage(exception))
                    }
                  }}
                  onRestoreField={async (field) => {
                    if (!field?.key || !currentModule) return
                    try {
                      await crmApi.restoreField(currentModule, field.key)
                      await loadSchemas()
                    } catch (exception) {
                      setError(getErrorMessage(exception))
                    }
                  }}
              /> : <div className="state-card"><strong>Administrator access required</strong><span>Your role does not allow schema changes.</span></div>
          ) : page === 'records' ? (
              <InventoryRecordsView
                  schemas={schemas}
                  onOpenModule={(nextModule) => {
                    setCurrentModule(nextModule)
                    setPage('inventory')
                  }}
              />
          ) : (
              <>
                <header className="topbar">
                  <div>
                    <span className="eyebrow">Module workspace</span>
                    <h1>{schema?.title || meta?.appName || 'Business application'}</h1>
                    <p>Forms, cards, permissions and actions are generated from module and field metadata.</p>
                  </div>
                  <div className="topbar-actions">
                    <button className="icon-button" type="button" onClick={loadData} aria-label="Refresh module" title="Refresh"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
                    {hasPermission('APP_MODULE_MANAGE') && <button className="button button-secondary" type="button" onClick={() => { setSchemaMode('modules'); setPage('schema') }}><SlidersHorizontal size={17} /> Edit schema</button>}
                    <button className="button button-primary" type="button" onClick={openCreate}><Plus size={18} /> Add record</button>
                  </div>
                </header>

                {availableSchemas.length > 0 && (
                    <div className="module-switcher" aria-label="Available modules">
                      {availableSchemas.map((item) => (
                          <button
                              className={`module-chip ${currentModule === item.module ? 'active' : ''}`}
                              type="button"
                              key={item.module}
                              onClick={() => setCurrentModule(item.module)}
                          >
                            {item.title || item.module.replaceAll('_', ' ')}
                          </button>
                      ))}
                    </div>
                )}

                <section className="stats-grid">
                  <article className="stat-card"><div className="stat-icon violet"><Boxes size={21} /></div><div><span>Total records</span><strong>{records.length}</strong><small>{schema?.title || currentModule?.replaceAll('_', ' ') || 'No module'}</small></div></article>
                  <article className="stat-card"><div className="stat-icon blue"><PackagePlus size={21} /></div><div><span>{quantityField?.label || 'Configured fields'}</span><strong>{quantityField ? stats.units : activeFields(schema).length}</strong><small>{quantityField ? `${stats.outOfStock} zero or below` : 'Visible fields in this module'}</small></div></article>
                  <article className="stat-card"><div className="stat-icon amber"><CircleDollarSign size={21} /></div><div><span>{priceField ? 'Calculated value' : 'Pending approvals'}</span><strong>{priceField ? currency.format(stats.retailValue) : pendingApprovals.length}</strong><small>{priceField && costField ? `Cost ${currency.format(stats.costValue)}` : 'Policy-gated operations'}</small></div></article>
                  <article className="stat-card"><div className="stat-icon rose"><AlertTriangle size={21} /></div><div><span>{quantityField ? 'Threshold alerts' : 'Event-ready'}</span><strong>{quantityField ? stats.lowStock : 'Yes'}</strong><small>{quantityField ? 'Configured low threshold' : 'Custom events can trigger workflows'}</small></div></article>
                </section>

                <section className="inventory-panel">
                  <div className="panel-header">
                    <div><h2>{schema?.title || 'Module records'}</h2><p>{filteredRecords.length} of {records.length} records shown</p></div>
                    <button className="button button-secondary compact mobile-add" type="button" onClick={openCreate}><Plus size={17} /> Add</button>
                  </div>

                  <div className="filter-bar">
                    <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all schema fields…" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}</label>
                    {categories.length > 0 && (
                        <label className="select-box"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
                    )}
                    {quantityField && <label className="select-box"><span>{quantityField.label}</span><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="ALL">All stock</option><option value="IN">In stock</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></select><ChevronDown size={16} /></label>}
                  </div>

                  {loading ? (
                      <div className="state-card"><LoaderCircle className="spin" size={28} /><strong>Loading module</strong><span>Loading records and metadata…</span></div>
                  ) : filteredRecords.length === 0 ? (
                      <div className="state-card empty-state">
                        <div className="empty-illustration"><Shirt size={34} /></div>
                        <strong>{records.length ? 'No records match your filters' : 'This module has no records'}</strong>
                        <span>{records.length ? 'Clear the search or change filters.' : 'Create schema fields first, then add the first record.'}</span>
                        {!records.length && <button className="button button-primary" type="button" onClick={openCreate}><Plus size={18} /> Add first record</button>}
                      </div>
                  ) : (
                      <div className="product-grid">
                        {filteredRecords.map((record) => {
                          const data = record.data || {}
                          const image = firstMediaValue(schema, data, 'IMAGE')
                          const images = image ? [image] : []
                          const hasStock = Boolean(quantityField)
                          const quantity = quantityField ? Number(data[quantityField.key] ?? 0) : 0
                          const title = String(displayValue(schema, data, 'TITLE', ['TEXT', 'TEXTAREA'], record.id))
                          const identifier = String(displayValue(schema, data, 'IDENTIFIER', ['TEXT', 'NUMBER'], record.id))
                          const listFields = activeFields(schema).filter((field) => field.showOnList === true && !['MEDIA'].includes(String(field.type).toUpperCase())).slice(0, 3)
                          const subtitle = listFields.map((field) => `${field.label}: ${Array.isArray(data[field.key]) ? data[field.key].join(', ') : data[field.key] ?? '—'}`).join(' · ')
                          return (
                              <article className="product-card" key={record.id}>
                                <div className="product-image-wrap">
                                  {images[0] ? <img src={resolveMediaUrl(images[0])} alt={title} className="product-image" /> : <div className="product-image-placeholder"><ImageOff size={26} /><span>No preview</span></div>}
                                  {hasStock && <span className={`stock-badge ${quantity <= 0 ? 'out' : quantity <= 5 ? 'low' : 'good'}`}>{quantity <= 0 ? 'Out of stock' : quantity <= 5 ? `${quantity} left` : 'In stock'}</span>}
                                  {images.length > 1 && <span className="image-count">+{images.length - 1}</span>}
                                </div>
                                <div className="product-content">
                                  <div className="product-meta"><span>{schema?.title || currentModule}</span><span>{identifier}</span></div>
                                  <h3>{title}</h3>
                                  <p>{subtitle || [data.articleName, data.season, data.hsnCode].filter(Boolean).join(' · ') || 'Schema-driven record'}</p>
                                  <div className="product-price-row">{priceField && <div><small>{priceField.label}</small><strong>{currency.format(Number(data[priceField.key] ?? 0))}</strong></div>}{hasStock && <div className="quantity-pill"><span>{quantityField.label}</span><strong>{quantity}</strong></div>}</div>
                                </div>
                                <footer className="product-actions"><button type="button" onClick={() => setViewingRecord(record)}><Eye size={16} /> View</button><button type="button" onClick={() => openEdit(record)}><Pencil size={16} /> Edit</button>{pendingApprovals.some((item) => item.record_id === record.id || item.recordId === record.id) ? <button type="button" disabled className="pending-action"><AlertTriangle size={16} /> Approval pending</button> : capabilities?.delete?.enabled !== false && <button type="button" className="danger-action" onClick={() => setDeleteTarget(record)}><Trash2 size={16} /> {capabilities?.delete?.approvalRequired === false ? 'Delete' : 'Delete'}</button>}</footer>
                              </article>
                          )
                        })}
                      </div>
                  )}
                </section>
              </>
          )}
        </main>

        <RecordDetailDialog open={Boolean(viewingRecord)} schema={schema} record={viewingRecord} onClose={() => setViewingRecord(null)} onEdit={(record) => { setViewingRecord(null); openEdit(record) }} />

        <ProductForm open={formOpen} schema={schema} schemas={schemas} record={editingRecord} saving={saving} onClose={() => !saving && setFormOpen(false)} onSubmit={saveProduct} onRemoveExistingMedia={removeExistingMedia} userRoles={(user?.roles || []).map((role) => typeof role === 'string' ? role : role.roleCode).filter(Boolean)} userRoleIds={(user?.roles || []).map((role) => typeof role === 'object' ? role.id : null).filter(Boolean)} userPermissions={[...(accessCapabilities?.appPermissions || []), ...Object.values(accessCapabilities?.modulePermissions || {}).flat()]} />

        {deleteTarget && (
            <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeleteTarget(null)}>
              <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="Request record deletion">
                <div className="danger-icon"><Trash2 size={22} /></div><h2>Delete record</h2><p><strong>{String(displayValue(schema, deleteTarget.data || {}, 'TITLE', ['TEXT', 'TEXTAREA'], 'This record'))}</strong> will be removed immediately. This action requires Delete permission for this module.</p>
                <label className="approval-reason-label">Reason for deletion<textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Duplicate record, incorrect entry, discontinued item…" rows={3} /></label>
                <div className="confirm-actions"><button className="button button-ghost" type="button" onClick={() => { setDeleteTarget(null); setDeleteReason('') }} disabled={saving}>Cancel</button><button className="button button-danger" type="button" onClick={deleteRecord} disabled={saving || !deleteReason.trim()}>{saving ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />} Submit request</button></div>
              </section>
            </div>
        )}
      </div>
  )
}

export default App
