import {
  Barcode,
  Boxes,
  Check,
  ChevronDown,
  ImagePlus,
  IndianRupee,
  Layers3,
  LoaderCircle,
  Package,
  Plus,
  Sparkles,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { crmApi, resolveMediaUrl } from '../api/crmApi'

const initialValueFor = (field) => {
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue
  if (field.type === 'BOOLEAN') return false
  if (['MULTI_SELECT', 'MULTI_REFERENCE', 'MEDIA'].includes(field.type)) return []
  return ''
}

const fieldSection = (field) => {
  const key = String(field.key || '').toLowerCase()
  const declared = field.section && field.section !== 'Details' ? field.section : null
  if (declared) return declared

  if (/(mrp|price|tax|cost|wholesale|selling)/.test(key)) return 'Pricing'
  if (/(quantity|stock|reorder|warehouse|movement|reserved|damaged|available)/.test(key)) return 'Stock'
  if (/(sku|barcode|itemcode|channel)/.test(key)) return 'SKU & codes'
  if (/(colour|color|image|swatch)/.test(key)) return 'Colour & media'
  if (/(wiring|padding|neckline|construct|multiway|strapless|backless|lace|plussize|everyday)/.test(key)) return 'Product features'
  if (/(brand|category|producttype|fabric|pattern|fit|season|material)/.test(key)) return 'Classification'
  if (/(name|code|style|article|size|unit)/.test(key)) return 'Identity'
  return 'More details'
}

const sectionMeta = {
  Identity: { icon: Package, text: 'Main product identity and naming.' },
  Classification: { icon: Layers3, text: 'Brand, category and product characteristics.' },
  'Colour & media': { icon: ImagePlus, text: 'Colourway and product presentation.' },
  'SKU & codes': { icon: Barcode, text: 'Unique item codes used for sales and scanning.' },
  Pricing: { icon: IndianRupee, text: 'Retail, wholesale, cost and tax values.' },
  Stock: { icon: Boxes, text: 'Warehouse quantities and replenishment.' },
  'Product features': { icon: Sparkles, text: 'Optional apparel-specific selling features.' },
  'More details': { icon: ChevronDown, text: 'Additional information for this record.' },
}



const recordDataOf = (record) => {
  if (!record || typeof record !== 'object') return {}
  return record.data || record.recordData || record.jsonData || record.values || {}
}

const humanizeKey = (key) => String(key || '')
    .replace(/Id$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()

const referenceDisplayLabel = (field, record, referencedSchema) => {
  const data = recordDataOf(record)
  const configuredFields = Array.isArray(field.displayFields) ? field.displayFields.filter(Boolean) : []
  const schemaFields = (referencedSchema?.fields || [])
      .filter((candidate) => candidate.visible !== false && !String(candidate.key || '').toLowerCase().endsWith('id'))
      .sort((a, b) => Number(Boolean(b.searchable)) - Number(Boolean(a.searchable)) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((candidate) => candidate.key)

  const preferredKeys = [...new Set([
    ...configuredFields,
    ...schemaFields,
  ])]

  const values = preferredKeys
      .map((key) => data[key])
      .filter((value) => value !== null && value !== undefined && String(value).trim())
      .map(String)

  if (values.length) return [...new Set(values)].slice(0, 2).join(' · ')

  const fallbackValues = Object.entries(data)
      .filter(([key, value]) => !/id$/i.test(key) && typeof value !== 'object' && value !== null && String(value).trim())
      .map(([, value]) => String(value))

  return [...new Set(fallbackValues)].slice(0, 2).join(' · ') || `Unnamed ${humanizeKey(field.label || field.key || 'record')}`
}

function ReferencePicker({
                           field,
                           value,
                           options,
                           loading,
                           disabled,
                           parentMissing,
                           onChange,
                           referencedSchema,
                           multiple = false,
                         }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draftValues, setDraftValues] = useState([])

  const labelledOptions = useMemo(() => options.map((record) => ({
    record,
    value: record.id,
    label: referenceDisplayLabel(field, record, referencedSchema),
  })), [options, field, referencedSchema])

  const selectedValues = multiple
      ? (Array.isArray(value) ? value.map(String) : [])
      : (value ? [String(value)] : [])

  const selectedOptions = labelledOptions.filter((option) => selectedValues.includes(String(option.value)))
  const selectedLabel = multiple
      ? selectedOptions.map((option) => option.label).join(', ')
      : selectedOptions[0]?.label

  const filtered = labelledOptions.filter((option) =>
      option.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const placeholder = parentMissing
      ? 'Choose the parent field first'
      : loading
          ? 'Loading records…'
          : `Select ${String(field.label || 'record').toLowerCase()}`

  const openDialog = () => {
    if (disabled || loading || parentMissing) return
    setDraftValues(selectedValues)
    setQuery('')
    setOpen(true)
  }

  const closeDialog = () => {
    setOpen(false)
    setQuery('')
  }

  const selectOption = (optionValue) => {
    if (multiple) {
      setDraftValues((current) => current.includes(String(optionValue))
          ? current.filter((item) => item !== String(optionValue))
          : [...current, String(optionValue)])
      return
    }

    onChange(optionValue)
    closeDialog()
  }

  const applyMultiple = () => {
    onChange(draftValues)
    closeDialog()
  }

  return <>
    <button
        className="reference-dialog-trigger"
        type="button"
        disabled={disabled || loading || parentMissing}
        onClick={openDialog}
    >
      <span className={selectedLabel ? '' : 'reference-placeholder'}>
        {selectedLabel || placeholder}
      </span>
      <span className="reference-dialog-trigger-action">
        {selectedValues.length > 0 && <small>{multiple ? `${selectedValues.length} selected` : 'Selected'}</small>}
        <Search size={15} />
      </span>
    </button>

    {open && createPortal(
        <div className="reference-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <section className="reference-dialog" role="dialog" aria-modal="true" aria-label={`Select ${field.label}`}>
            <header className="reference-dialog-header">
              <div>
                <span className="eyebrow">{referencedSchema?.module || field.referenceModule || 'REFERENCE'}</span>
                <h3>Select {field.label}</h3>
                <p>Search and choose {multiple ? 'one or more records' : 'one record'}.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeDialog} aria-label="Close selection dialog"><X size={18} /></button>
            </header>

            <div className="reference-dialog-search">
              <Search size={17} />
              <input
                  autoFocus
                  value={query}
                  placeholder={`Search ${String(field.label || 'records').toLowerCase()}…`}
                  onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="reference-dialog-list">
              {!filtered.length && <div className="reference-dialog-empty">No matching records found.</div>}
              {filtered.map((option) => {
                const checked = (multiple ? draftValues : selectedValues).includes(String(option.value))
                const [title, ...detailParts] = option.label.split(' · ')
                return <button
                    className={`reference-dialog-option ${checked ? 'selected' : ''}`}
                    type="button"
                    key={option.value}
                    onClick={() => selectOption(option.value)}
                >
                  <span className="reference-dialog-option-check">{checked && <Check size={15} />}</span>
                  <span className="reference-dialog-option-copy">
                  <strong>{title}</strong>
                    {detailParts.length > 0 && <small>{detailParts.join(' · ')}</small>}
                </span>
                </button>
              })}
            </div>

            <footer className="reference-dialog-footer">
              {!multiple && value && <button className="button button-ghost" type="button" onClick={() => { onChange(''); closeDialog() }}>Clear selection</button>}
              <span />
              <button className="button button-ghost" type="button" onClick={closeDialog}>Cancel</button>
              {multiple && <button className="button button-primary" type="button" onClick={applyMultiple}>Use selected ({draftValues.length})</button>}
            </footer>
          </section>
        </div>,
        document.body,
    )}
  </>
}
const sectionOrder = ['Identity', 'Classification', 'Colour & media', 'SKU & codes', 'Pricing', 'Stock', 'Product features', 'More details']

function ProductForm({
                       open,
                       schema,
                       schemas = [],
                       record,
                       saving,
                       onClose,
                       onSubmit,
                       onRemoveExistingMedia,
                       userRoles = [], userRoleIds = [], userPermissions = [],
                     }) {
  const fields = useMemo(() => {
    const source = schema?.fields || []
    const canView = (field) => { const required = field?.config?.accessPolicy?.viewPermissions || []; if (required.length) return required.some((permission) => userPermissions.includes(permission)); const roleRefs = field.viewRoles || []; return !roleRefs.length || roleRefs.some((role) => userRoleIds.includes(role) || userRoles.includes(role)); }
    return [...source]
        .filter((field) => canView(field) && field.visible !== false && (record ? field.showOnEdit !== false : field.showOnCreate !== false))
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
  }, [schema, userRoles])

  const [values, setValues] = useState({})
  const [pendingMedia, setPendingMedia] = useState({})
  const [errors, setErrors] = useState({})
  const [referenceRecords, setReferenceRecords] = useState({})
  const [referenceLoading, setReferenceLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})

  useEffect(() => {
    if (!open) return
    const next = {}
    fields.forEach((field) => {
      next[field.key] = record?.data?.[field.key] ?? initialValueFor(field)
    })
    setValues(next)
    setPendingMedia({})
    setErrors({})
    setExpandedSections({ Identity: true, Classification: true, 'Colour & media': true, 'SKU & codes': true, Pricing: true, Stock: true })
  }, [open, record, fields])

  const resolveReferenceModule = (field) => {
    if (field.referenceModule) return field.referenceModule
    if (field.referenceModuleKey) return field.referenceModuleKey
    if (field.referenceModuleId) {
      return schemas.find((item) => item.id === field.referenceModuleId)?.module || ''
    }
    return ''
  }

  useEffect(() => {
    if (!open) return undefined

    const modules = [...new Set(fields
        .filter((field) => ['REFERENCE', 'MULTI_REFERENCE', 'DEPENDENT_REFERENCE'].includes(field.type))
        .map(resolveReferenceModule)
        .filter(Boolean))]

    if (!modules.length) {
      setReferenceRecords({})
      return undefined
    }

    let cancelled = false
    setReferenceLoading(true)
    Promise.all(modules.map(async (moduleName) => {
      const result = await crmApi.listRecords(moduleName)
      return [moduleName, Array.isArray(result) ? result : []]
    }))
        .then((entries) => {
          if (!cancelled) setReferenceRecords(Object.fromEntries(entries))
        })
        .catch(() => {
          if (!cancelled) setReferenceRecords({})
        })
        .finally(() => {
          if (!cancelled) setReferenceLoading(false)
        })

    return () => { cancelled = true }
  }, [open, fields, schemas])


  if (!open) return null

  const grouped = fields.reduce((acc, field) => {
    const section = fieldSection(field)
    if (!acc[section]) acc[section] = []
    acc[section].push(field)
    return acc
  }, {})

  const orderedSections = Object.keys(grouped).sort((a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b))
  const requiredFields = fields.filter((field) => field.required)
  const completedRequired = requiredFields.filter((field) => {
    const value = values[field.key]
    return value !== '' && value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0)
  }).length


  const setFieldValue = (field, nextValue) => {
    setValues((current) => {
      const next = { ...current, [field.key]: nextValue }
      fields
          .filter((candidate) => candidate.type === 'DEPENDENT_REFERENCE' && candidate.dependsOn === field.key)
          .forEach((candidate) => { next[candidate.key] = '' })
      return next
    })
    setErrors((current) => ({ ...current, [field.key]: undefined }))
  }

  const validate = () => {
    const nextErrors = {}
    fields.forEach((field) => {
      const value = values[field.key]
      if (field.required && (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0))) {
        nextErrors[field.key] = `${field.label} is required.`
      }
      if (field.type === 'NUMBER' && value !== '' && Number.isNaN(Number(value))) nextErrors[field.key] = 'Enter a valid number.'
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const firstErrorField = fields.find((field) => nextErrors[field.key])
      if (firstErrorField) setExpandedSections((current) => ({ ...current, [fieldSection(firstErrorField)]: true }))
    }
    return Object.keys(nextErrors).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    const payload = {}
    fields.forEach((field) => {
      const value = values[field.key]
      payload[field.key] = field.type === 'NUMBER' && value !== '' ? Number(value) : value
    })
    await onSubmit(payload, Object.fromEntries(Object.entries(pendingMedia).map(([key, items]) => [key, items.map((item) => item.file)])))
  }

  const referencedSchemaFor = (field) => {
    const moduleName = resolveReferenceModule(field)
    return schemas.find((item) => item.module === moduleName || item.id === field.referenceModuleId)
  }

  const referenceLabel = (field, item) => referenceDisplayLabel(field, item, referencedSchemaFor(field))

  const referenceOptions = (field) => {
    const moduleName = resolveReferenceModule(field)
    const records = referenceRecords[moduleName] || []
    if (field.type !== 'DEPENDENT_REFERENCE') return records
    const parentValue = values[field.dependsOn]
    if (!parentValue) return []
    return records.filter((item) => String(item?.data?.[field.referenceFilterField] ?? '') === String(parentValue))
  }

  const mediaConfigOf = (field) => field?.config || {}

  const mediaValuesOf = (field) => {
    const raw = values[field.key]
    if (Array.isArray(raw)) return raw.filter(Boolean)
    return raw ? [raw] : []
  }

  const pendingFor = (field) => pendingMedia[field.key] || []

  const addMediaFiles = (field, files) => {
    const config = mediaConfigOf(field)
    const multiple = config.multiple !== false
    const maxFiles = Math.max(1, Number(config.maxFiles || (multiple ? 10 : 1)))
    const allowed = Array.isArray(config.allowedMimeTypes) ? config.allowedMimeTypes : []
    const maxSizeBytes = Number(config.maxSizeBytes || 0) || Number(config.maxSizeMb || 0) * 1024 * 1024
    const currentCount = mediaValuesOf(field).length + pendingFor(field).length
    const remaining = Math.max(0, maxFiles - currentCount)

    const accepted = Array.from(files || [])
        .filter((file) => !allowed.length || allowed.some((rule) => rule.endsWith('/*') ? file.type.startsWith(rule.slice(0, -1)) : file.type === rule))
        .filter((file) => !maxSizeBytes || file.size <= maxSizeBytes)
        .slice(0, multiple ? remaining : 1)
        .map((file) => ({ file, preview: URL.createObjectURL(file) }))

    setPendingMedia((current) => ({
      ...current,
      [field.key]: multiple ? [...(current[field.key] || []), ...accepted] : accepted.slice(-1),
    }))
  }

  const removePendingMedia = (field, index) => {
    setPendingMedia((current) => {
      const items = [...(current[field.key] || [])]
      if (items[index]?.preview) URL.revokeObjectURL(items[index].preview)
      items.splice(index, 1)
      return { ...current, [field.key]: items }
    })
  }

  const acceptFor = (field) => {
    const config = mediaConfigOf(field)
    if (Array.isArray(config.allowedMimeTypes) && config.allowedMimeTypes.length) return config.allowedMimeTypes.join(',')
    const type = String(config.mediaType || '').toUpperCase()
    if (type === 'IMAGE') return 'image/*'
    if (type === 'VIDEO') return 'video/*'
    if (type === 'AUDIO') return 'audio/*'
    return '*/*'
  }

  const renderMediaPreview = (field, url, pending = false) => {
    const mediaType = String(mediaConfigOf(field).mediaType || '').toUpperCase()
    const src = pending ? url : resolveMediaUrl(url)
    if (mediaType === 'VIDEO') return <video src={src} controls />
    if (mediaType === 'AUDIO') return <audio src={src} controls />
    if (mediaType === 'IMAGE') return <img src={src} alt={field.label || 'Media'} />
    return <a href={src} target="_blank" rel="noreferrer">{pending ? 'Selected file' : 'Open file'}</a>
  }

  const renderField = (field) => {
    const value = values[field.key] ?? ''
    const requiredEditPermissions = field?.config?.accessPolicy?.editPermissions || []
    const roleCanEdit = requiredEditPermissions.length ? requiredEditPermissions.some((permission) => userPermissions.includes(permission)) : (!Array.isArray(field.editRoles) || field.editRoles.length === 0 || field.editRoles.some((role) => userRoleIds.includes(role) || userRoles.includes(role)))
    const disabled = field.editable === false || !roleCanEdit || saving

    if (field.type === 'MULTI_REFERENCE') {
      return <ReferencePicker
          field={field}
          value={value}
          options={referenceOptions(field)}
          loading={referenceLoading}
          disabled={disabled}
          parentMissing={false}
          referencedSchema={referencedSchemaFor(field)}
          multiple
          onChange={(nextValue) => setFieldValue(field, nextValue)}
      />
    }

    if (['REFERENCE', 'DEPENDENT_REFERENCE'].includes(field.type)) {
      const parentMissing = field.type === 'DEPENDENT_REFERENCE' && !values[field.dependsOn]
      return <ReferencePicker
          field={field}
          value={value}
          options={referenceOptions(field)}
          loading={referenceLoading}
          disabled={disabled}
          parentMissing={parentMissing}
          referencedSchema={referencedSchemaFor(field)}
          onChange={(nextValue) => setFieldValue(field, nextValue)}
      />
    }

    if (field.type === 'MEDIA') {
      const config = mediaConfigOf(field)
      const existing = mediaValuesOf(field)
      const pending = pendingFor(field)
      const multiple = config.multiple !== false
      const maxFiles = Math.max(1, Number(config.maxFiles || (multiple ? 10 : 1)))
      const inputId = `media-${field.key}`
      const canAdd = existing.length + pending.length < maxFiles
      return <div className="media-field">
        <input
            id={inputId}
            type="file"
            accept={acceptFor(field)}
            multiple={multiple}
            hidden
            disabled={disabled || !canAdd}
            onChange={(event) => {
              addMediaFiles(field, event.target.files)
              event.target.value = ''
            }}
        />
        <label
            className={`photo-dropzone ${disabled || !canAdd ? 'disabled' : ''}`}
            htmlFor={inputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (!disabled && canAdd) addMediaFiles(field, event.dataTransfer.files)
            }}
        >
          <div className="upload-icon"><ImagePlus size={22} /></div>
          <strong>{field.placeholder || `Add ${String(field.label || 'media').toLowerCase()}`}</strong>
          <span>{multiple ? `${existing.length + pending.length}/${maxFiles} files` : 'Single file'}</span>
        </label>
        {(existing.length > 0 || pending.length > 0) && <div className="photo-grid">
          {existing.map((url) => <figure key={url} className="photo-tile">
            {renderMediaPreview(field, url)}
            <button type="button" aria-label="Remove media" onClick={() => onRemoveExistingMedia?.(field.key, url)} disabled={saving}><Trash2 size={15} /></button>
          </figure>)}
          {pending.map((item, index) => <figure key={item.preview} className="photo-tile">
            {renderMediaPreview(field, item.preview, true)}
            <button type="button" aria-label="Remove selected media" onClick={() => removePendingMedia(field, index)} disabled={saving}><X size={15} /></button>
          </figure>)}
        </div>}
      </div>
    }

    if (field.type === 'BOOLEAN') {
      return <button className={`boolean-card ${value ? 'active' : ''}`} type="button" disabled={disabled} onClick={() => setFieldValue(field, !value)}>
        <span className="boolean-check">{value && <Check size={14} />}</span>
        <span><strong>{value ? 'Enabled' : 'Not selected'}</strong><small>Tap to {value ? 'disable' : 'enable'}</small></span>
      </button>
    }

    if (field.type === 'MULTI_SELECT') {
      const selected = Array.isArray(value) ? value : []
      return <div className="choice-grid">{(field.options || []).map((option) => {
        const checked = selected.includes(option)
        return <label className={`choice-chip ${checked ? 'selected' : ''}`} key={option}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => setFieldValue(field, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />
          {checked && <Check size={14} />}<span>{option.replaceAll('_', ' ')}</span>
        </label>
      })}</div>
    }

    if (field.type === 'SELECT') {
      return <div className="select-control"><select value={value} disabled={disabled} onChange={(event) => setFieldValue(field, event.target.value)}>
        <option value="">Select {field.label.toLowerCase()}</option>
        {(field.options || []).map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
      </select><ChevronDown size={16} /></div>
    }

    if (field.type === 'TEXTAREA') return <textarea value={value} disabled={disabled} rows="4" placeholder={field.placeholder || `Add ${field.label.toLowerCase()}`} onChange={(event) => setFieldValue(field, event.target.value)} />

    const typeMap = { NUMBER: 'number', DATE: 'date', EMAIL: 'email', PHONE: 'tel' }
    return <input
        value={value}
        disabled={disabled}
        type={typeMap[field.type] || 'text'}
        step={field.type === 'NUMBER' ? 'any' : undefined}
        min={/(quantity|price|mrp|level)/i.test(field.key) ? '0' : undefined}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
        onChange={(event) => setFieldValue(field, event.target.value)}
    />
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="product-drawer" role="dialog" aria-modal="true" aria-label={record ? 'Edit record' : 'Add record'}>
      <header className="drawer-header inventory-form-header">
        <div>
          <span className="eyebrow">{(schema?.title || schema?.module || 'MODULE RECORD').replaceAll('_', ' ')}</span>
          <h2>{record ? `Edit ${schema?.title || 'record'}` : `Add ${schema?.title || 'record'}`}</h2>
          <p>Only the fields defined in your CRM architecture are used.</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close form"><X size={20} /></button>
      </header>

      <div className="form-progress">
        <div><strong>{completedRequired}/{requiredFields.length}</strong><span>required fields complete</span></div>
        <div className="progress-track"><span style={{ width: `${requiredFields.length ? (completedRequired / requiredFields.length) * 100 : 100}%` }} /></div>
      </div>

      <form onSubmit={submit} className="drawer-body inventory-form-body">

        {orderedSections.map((section) => {
          const meta = sectionMeta[section] || sectionMeta['More details']
          const Icon = meta.icon
          const expanded = expandedSections[section] !== false
          return <section className={`form-section smart-section ${expanded ? 'expanded' : 'collapsed'}`} key={section}>
            <button className="smart-section-header" type="button" onClick={() => setExpandedSections((current) => ({ ...current, [section]: !expanded }))}>
              <span className="section-icon"><Icon size={18} /></span>
              <span><strong>{section}</strong><small>{meta.text}</small></span>
              <span className="field-count">{grouped[section].length}</span><ChevronDown className="section-chevron" size={18} />
            </button>
            {expanded && <div className="form-grid smart-form-grid">{grouped[section].map((field) => <div className={`form-field ${['TEXTAREA', 'MULTI_REFERENCE', 'MULTI_SELECT', 'MEDIA'].includes(field.type) ? 'full-width' : ''}`} key={field.key}>
              <label htmlFor={field.key}>{field.label}{field.required && <span className="required-mark">*</span>}{field.editable === false && <span className="read-only-label">Calculated</span>}</label>
              {renderField(field)}
              {errors[field.key] && <span className="field-error">{errors[field.key]}</span>}
            </div>)}</div>}
          </section>
        })}

        <footer className="drawer-footer"><button className="button button-ghost" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary save-inventory-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}{saving ? 'Saving…' : record ? 'Save changes' : `Create ${schema?.title || 'record'}`}</button></footer>
      </form>
    </section>
  </div>
}

export default ProductForm
