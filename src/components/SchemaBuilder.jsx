import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  GitBranch,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const FIELD_TYPES = [
  'TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'DATE', 'BOOLEAN',
  'EMAIL', 'PHONE', 'REFERENCE', 'MULTI_REFERENCE', 'DEPENDENT_REFERENCE',
  'POLYMORPHIC_REFERENCE', 'MULTI_POLYMORPHIC_REFERENCE', 'MEDIA',
]

const EMPTY_FIELD = {
  key: '', label: '', type: 'TEXT', section: 'Details', required: false,
  searchable: false, visible: true, editable: true, showOnCreate: true, showOnEdit: true,
  showOnList: false, showOnDetail: true, placeholder: '', options: [],
  referenceModule: '', referenceModuleId: '', valueField: 'id', displayFields: [],
  dependsOn: '', referenceFilterField: '', allowedModuleIds: [],
  visibility: 'PUBLIC', referenceable: true, viewRoles: [], editRoles: [], config: {},
}

const normalizeModule = (value = '') => value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_')
const normalizeKey = (value = '') => value.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_, next) => next.toUpperCase()).replace(/^[A-Z]/, (first) => first.toLowerCase())
const normalizeOptions = (options = []) => {
  const seen = new Set()
  return options.map((option) => String(option ?? '').trim()).filter(Boolean).filter((option) => {
    const key = option.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ModuleHierarchy({ schemas, activeModule, onSelectSchema, onDeleteSchema, onDeleteAllSchemas, deleting }) {
  const byParent = useMemo(() => {
    const map = new Map()
    schemas.forEach((schema) => {
      const parent = schema.parentSchemaId || '__root__'
      if (!map.has(parent)) map.set(parent, [])
      map.get(parent).push(schema)
    })
    map.forEach((items) => items.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.title || a.module).localeCompare(b.title || b.module)))
    return map
  }, [schemas])

  const referenceEdges = useMemo(() => schemas.flatMap((schema) => (schema.fields || [])
      .filter((field) => ['REFERENCE', 'MULTI_REFERENCE', 'DEPENDENT_REFERENCE'].includes(field.type) && field.referenceModuleId)
      .map((field) => ({ from: schema, field, to: schemas.find((item) => item.id === field.referenceModuleId) })))
      .filter((edge) => edge.to), [schemas])

  const renderNode = (schema, level = 1) => (
      <div className="module-tree-node" key={schema.id || schema.module}>
        <div className={`module-tree-card ${schema.module === activeModule ? 'active' : ''}`}>
          <button
              type="button"
              className="module-tree-select"
              onClick={() => onSelectSchema?.(schema.module)}
          >
            <span className="module-level">L{schema.depth || level}</span>
            <span className="module-tree-copy"><strong>{schema.title || schema.module}</strong><small>{schema.module} · {(schema.fields || []).length} fields</small></span>
            {schema.repeatable !== false && <span className="repeatable-pill">Repeatable</span>}
          </button>
          <button
              type="button"
              className="module-tree-delete"
              title={`Delete ${schema.title || schema.module}`}
              aria-label={`Delete ${schema.title || schema.module}`}
              disabled={deleting}
              onClick={() => onDeleteSchema?.(schema)}
          >
            <Trash2 size={16}/>
          </button>
        </div>
        {(byParent.get(schema.id) || []).length > 0 && (
            <div className="module-tree-children">{byParent.get(schema.id).map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
  )

  return (
      <section className="module-map-panel">
        <div className="panel-header schema-panel-header">
          <div><h2>Module hierarchy</h2><p>Modules can own fields, child modules and reusable references. Maximum depth: 5.</p></div>
          <div className="topbar-actions">
            <button className="button button-secondary danger-action compact" type="button" disabled={deleting || !schemas.length} onClick={() => onDeleteAllSchemas?.()}>
              <Trash2 size={16}/> Delete all modules
            </button>
            <GitBranch size={22} />
          </div>
        </div>
        <div className="module-map-body">
          <div className="module-tree">{(byParent.get('__root__') || []).map((schema) => renderNode(schema))}</div>
          <aside className="reference-map">
            <h3>Reusable module references</h3>
            {!referenceEdges.length ? <p>No references yet. Add a REFERENCE or MULTI REFERENCE field.</p> : referenceEdges.map((edge, index) => (
                <button type="button" className="reference-edge" key={`${edge.from.id}-${edge.field.key}-${index}`} onClick={() => onSelectSchema?.(edge.from.module)}>
                  <span>{edge.from.module}</span><ArrowRight size={14} /><strong>{edge.to.module}</strong><small>{edge.field.label}</small>
                </button>
            ))}
          </aside>
        </div>
      </section>
  )
}

function FieldEditor({ field, schemaFields, schemas, usedKeys, onCancel, onSave }) {
  const [draft, setDraft] = useState(field || EMPTY_FIELD)
  const [optionText, setOptionText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { setDraft(field || EMPTY_FIELD); setOptionText(''); setError('') }, [field])

  const optionType = ['SELECT', 'MULTI_SELECT'].includes(draft.type)
  const polymorphicReference = ['POLYMORPHIC_REFERENCE', 'MULTI_POLYMORPHIC_REFERENCE'].includes(draft.type)
  const referenceType = ['REFERENCE', 'MULTI_REFERENCE', 'DEPENDENT_REFERENCE'].includes(draft.type) || polymorphicReference
  const dependentReference = draft.type === 'DEPENDENT_REFERENCE'
  const change = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const changePolicy = (policyKey, key, value) => setDraft((current) => ({
    ...current,
    config: {
      ...(current.config || {}),
      [policyKey]: { ...((current.config || {})[policyKey] || {}), [key]: value },
    },
  }))

  const addOption = () => {
    const option = optionText.trim()
    if (!option) return
    change('options', normalizeOptions([...(draft.options || []), option]))
    setOptionText('')
  }

  const buildField = () => {
    const key = normalizeKey(draft.key || draft.label)
    if (!draft.label.trim() || !key) throw new Error('Field name and key are required.')
    if (usedKeys.has(key) && key !== field?.key) throw new Error(`The key “${key}” is already used in this module.`)
    if (optionType && !(draft.options || []).length) throw new Error('Add at least one dropdown option.')
    if (referenceType && !polymorphicReference && !String(draft.referenceModuleId || '').trim()) throw new Error('Reference module is required.')
    if (polymorphicReference && !(draft.allowedModuleIds || []).length) throw new Error('Select at least one allowed module.')
    if (dependentReference && (!draft.dependsOn || !draft.referenceFilterField)) throw new Error('Select the parent field and reference filter field.')
    return {
      ...draft, key, label: draft.label.trim(), section: draft.section.trim() || 'Details',
      options: optionType ? normalizeOptions(draft.options) : [],
      referenceModule: referenceType && !polymorphicReference ? normalizeModule(draft.referenceModule) : null,
      referenceModuleId: referenceType && !polymorphicReference ? draft.referenceModuleId : null,
      valueField: referenceType ? 'id' : null,
      displayFields: referenceType ? normalizeOptions(draft.displayFields || []) : [],
      allowedModuleIds: polymorphicReference ? (draft.allowedModuleIds || []) : [],
      visibility: draft.visibility || 'PUBLIC', referenceable: draft.referenceable !== false,
      viewRoles: normalizeOptions(draft.viewRoles || []), editRoles: normalizeOptions(draft.editRoles || []),
      config: { ...(draft.config || {}) },
      dependsOn: dependentReference ? draft.dependsOn : null,
      referenceFilterField: dependentReference ? draft.referenceFilterField.trim() : null,
    }
  }

  const submit = (event, addAnother = false) => {
    event.preventDefault()
    try {
      onSave(buildField(), addAnother)
      if (addAnother) { setDraft({ ...EMPTY_FIELD }); setOptionText(''); setError('') }
    } catch (submitError) { setError(submitError.message) }
  }

  return (
      <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
        <form className="field-editor" onSubmit={(event) => submit(event, false)}>
          <header className="field-editor-header"><div><span className="eyebrow">Generic schema field</span><h2>{field ? 'Edit field' : 'Add fields'}</h2></div><button className="icon-button" type="button" onClick={onCancel}><X size={19} /></button></header>
          <div className="field-editor-body">
            {error && <div className="inline-error">{error}</div>}
            <div className="form-grid">
              <div className="form-field"><label>Field label</label><input value={draft.label} onChange={(event) => change('label', event.target.value)} placeholder="Available sizes" /></div>
              <div className="form-field"><label>Reusable key</label><input value={draft.key} onChange={(event) => change('key', event.target.value)} placeholder="sizeIds" /></div>
              <div className="form-field"><label>Field type</label><select value={draft.type} onChange={(event) => change('type', event.target.value)}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></div>
              <div className="form-field"><label>Form section</label><input value={draft.section} onChange={(event) => change('section', event.target.value)} placeholder="Details" /></div>
              <div className="form-field full-width"><label>Placeholder / help text</label><input value={draft.placeholder || ''} onChange={(event) => change('placeholder', event.target.value)} placeholder="Choose one or more sizes" /></div>
            </div>

            {optionType && <div className="option-builder"><label>Dropdown options</label><div className="option-input-row"><input value={optionText} onChange={(event) => setOptionText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addOption() } }} placeholder="M"/><button className="button button-secondary compact" type="button" onClick={addOption}><Plus size={16}/> Add option</button></div><div className="option-chip-list">{(draft.options || []).map((option) => <span className="option-chip" key={option}>{option}<button type="button" onClick={() => change('options', draft.options.filter((item) => item !== option))}><X size={13}/></button></span>)}</div></div>}

            {referenceType && <div className="option-builder reference-config-card"><label>Reusable module relation</label><div className="form-grid">
              {!polymorphicReference && <div className="form-field"><label>Reference module</label><select value={draft.referenceModuleId || ''} onChange={(event) => { const selected = schemas.find((item) => item.id === event.target.value); change('referenceModuleId', event.target.value); change('referenceModule', selected?.module || '') }}><option value="">Select reusable module</option>{schemas.map((item) => <option key={item.id || item.module} value={item.id || ''}>{'—'.repeat(Math.max(0, (item.depth || 1) - 1))} {item.title || item.module} ({item.module})</option>)}</select></div>}
              {polymorphicReference && <div className="form-field full-width"><label>Allowed modules</label><select multiple value={draft.allowedModuleIds || []} onChange={(event)=>change('allowedModuleIds', Array.from(event.target.selectedOptions).map((item)=>item.value))}>{schemas.map((item)=><option key={item.id} value={item.id}>{item.title || item.module} ({item.module})</option>)}</select></div>}
              <div className="form-field"><label>Display fields</label><input value={(draft.displayFields || []).join(', ')} onChange={(event) => change('displayFields', event.target.value.split(','))} placeholder="sizeCode, sizeLabel" /></div>
              {dependentReference && <><div className="form-field"><label>Depends on field</label><select value={draft.dependsOn || ''} onChange={(event) => change('dependsOn', event.target.value)}><option value="">Select parent field</option>{schemaFields.filter((item) => item.key !== draft.key).map((item) => <option key={item.key} value={item.key}>{item.label} ({item.key})</option>)}</select></div><div className="form-field"><label>Field in referenced record</label><input value={draft.referenceFilterField || ''} onChange={(event) => change('referenceFilterField', event.target.value)} placeholder="sizeTypeId" /></div></>}
            </div><p className="schema-help">All references are validated inside the same client ID and app ID.</p></div>}

            <div className="option-builder"><label>Encapsulation & permissions</label><div className="form-grid">
              <div className="form-field"><label>Visibility</label><select value={draft.visibility || 'PUBLIC'} onChange={(event)=>change('visibility', event.target.value)}><option>PUBLIC</option><option>PROTECTED</option><option>PRIVATE</option></select></div>
              <label className="check-card"><input type="checkbox" checked={draft.referenceable !== false} onChange={(event)=>change('referenceable', event.target.checked)}/><span><Check size={15}/> Referenceable</span></label>
              <div className="form-field"><label>View role IDs (legacy fallback)</label><input value={(draft.viewRoles || []).join(', ')} onChange={(event)=>change('viewRoles', event.target.value.split(','))} placeholder="Use stable role IDs, not role names"/></div>
              <div className="form-field"><label>Edit role IDs (legacy fallback)</label><input value={(draft.editRoles || []).join(', ')} onChange={(event)=>change('editRoles', event.target.value.split(','))} placeholder="Prefer accessPolicy.editPermissions"/></div>
              {draft.type === 'MEDIA' && <div className="field-policy-card">
                <div><strong>Field approval policy</strong><small>This applies only to this MEDIA field. Other fields are not sent for approval.</small></div>
                <label className="check-card"><input type="checkbox" checked={draft.config?.removePolicy?.approvalRequired === true} onChange={(event)=>changePolicy('removePolicy','approvalRequired',event.target.checked)}/><span><Check size={15}/> Require approval before removing media</span></label>
              </div>}
            </div></div>

            <div className="field-switches">{[['required','Required'],['searchable','Searchable'],['visible','Enabled'],['editable','Editable'],['showOnCreate','Show on create'],['showOnEdit','Show on edit'],['showOnList','Show in inventory view'],['showOnDetail','Show in record details']].map(([key,label]) => <label key={key} className="check-card"><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => change(key, event.target.checked)}/><span><Check size={15}/> {label}</span></label>)}</div>
          </div>
          <footer className="field-editor-footer">
            <button className="button button-ghost" type="button" onClick={onCancel}>Cancel</button>
            {!field && <button className="button button-secondary" type="button" onClick={(event) => submit(event, true)}><Plus size={17}/> Save & add another</button>}
            <button className="button button-primary" type="submit"><Save size={17}/> Save field</button>
          </footer>
        </form>
      </div>
  )
}

function SchemaBuilder({ schema, schemas = [], module, saving, onCreateSchema, onSaveSchema, onDeleteSchema, onDeleteAllSchemas, onSelectSchema }) {
  const [draft, setDraft] = useState(null)
  const [editor, setEditor] = useState(null)
  const [newSchemaOpen, setNewSchemaOpen] = useState(false)
  const [newModule, setNewModule] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newParentSchemaId, setNewParentSchemaId] = useState('')
  const [newRepeatable, setNewRepeatable] = useState(true)

  useEffect(() => {
    if (!schema) {
      setDraft(null)
      return
    }
    setDraft({ relationshipType:'COMPOSITION', extendsSchemaId:null, recordVisibility:'APP_ONLY', allowExternalReference:true, ...schema, module: schema.module || module, title: schema.title || 'Inventory schema', parentSchemaId: schema.parentSchemaId || null, depth: schema.depth || 1, repeatable: schema.repeatable !== false, displayOrder: schema.displayOrder || 0, fields: [...(schema.fields || [])].sort((a,b)=>(a.displayOrder??0)-(b.displayOrder??0)).map((field,index)=>({ visible:true, editable:true, showOnCreate:true, showOnEdit:true, showOnList:false, showOnDetail:true, ...field, displayOrder:index+1, options:field.options||[] })) })
  }, [schema, module])

  const fields = draft?.fields || []
  const usedKeys = useMemo(() => new Set(fields.map((field) => field.key)), [fields])
  const toSchemaPayload = (source) => {
    const normalizedFields = (source.fields || []).map((field,index)=>({ ...field, options:normalizeOptions(field.options), displayOrder:index+1 }))
    return { ...source, module:normalizeModule(source.module), fields:normalizedFields, requiredFields:normalizedFields.filter((field)=>field.required).map((field)=>field.key), allowedFields:normalizedFields.map((field)=>field.key), searchFields:normalizedFields.filter((field)=>field.searchable).map((field)=>field.key), uniqueRules:source.uniqueRules||[], active:source.active!==false }
  }

  const persist = async () => { const saved = await onSaveSchema(toSchemaPayload(draft)); if (saved) setDraft(saved) }
  const saveField = async (field, keepOpen = false) => {
    const nextFields = editor?.index === undefined ? [...fields, { ...field, displayOrder:fields.length+1 }] : fields.map((item,index)=>index===editor.index?{...field,displayOrder:index+1}:item)
    const nextDraft = { ...draft, fields:nextFields }
    const saved = await onSaveSchema(toSchemaPayload(nextDraft))
    setDraft(saved || nextDraft)
    if (!keepOpen) setEditor(null)
  }
  const move = (index, offset) => setDraft((current)=>{ const next=[...current.fields]; const target=index+offset; if(target<0||target>=next.length)return current; [next[index],next[target]]=[next[target],next[index]]; return {...current,fields:next} })

  if (!draft) return <section className="schema-workspace">
    <div className="schema-toolbar">
      <div><span className="eyebrow">Schema-driven CRM</span><h1>CRM schema & fields</h1><p>No active CRM module exists yet. Create your first module to begin.</p></div>
      <div className="topbar-actions"><button className="button button-primary" type="button" onClick={()=>setNewSchemaOpen(true)}><Plus size={17}/> Create first module</button></div>
    </div>
    <div className="state-card empty-state">
      <div className="empty-illustration"><Layers3 size={32}/></div>
      <strong>No CRM modules created</strong>
      <span>The database is empty. Create a module or import your apparel inventory architecture.</span>
      <button className="button button-primary" type="button" onClick={()=>setNewSchemaOpen(true)}><Plus size={17}/> Add module</button>
    </div>
    {newSchemaOpen&&<div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event)=>event.target===event.currentTarget&&setNewSchemaOpen(false)}><form className="new-schema-dialog" onSubmit={(event)=>{event.preventDefault();const nextModule=normalizeModule(newModule);if(!nextModule||!newTitle.trim())return;onCreateSchema({module:nextModule,title:newTitle.trim(),fields:[],requiredFields:[],allowedFields:[],searchFields:[],uniqueRules:[],parentSchemaId:null,repeatable:newRepeatable,displayOrder:0,active:true});setNewSchemaOpen(false);setNewModule('');setNewTitle('');setNewParentSchemaId('');setNewRepeatable(true)}}><header className="field-editor-header"><div><span className="eyebrow">First business module</span><h2>Create module</h2></div><button className="icon-button" type="button" onClick={()=>setNewSchemaOpen(false)}><X size={19}/></button></header><div className="field-editor-body"><div className="form-field"><label>Module title</label><input value={newTitle} onChange={(event)=>setNewTitle(event.target.value)} placeholder="Product Inventory" autoFocus/></div><div className="form-field"><label>Module key</label><input value={newModule} onChange={(event)=>setNewModule(event.target.value)} placeholder="PRODUCTS"/></div><label className="check-card"><input type="checkbox" checked={newRepeatable} onChange={(event)=>setNewRepeatable(event.target.checked)}/><span><Check size={15}/> Repeatable records</span></label><p className="schema-help">Create the root module first. Child and reusable reference modules can be added afterward.</p></div><footer className="field-editor-footer"><button className="button button-ghost" type="button" onClick={()=>setNewSchemaOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>} Create module</button></footer></form></div>}
  </section>

  return <section className="schema-workspace">
    <div className="schema-toolbar"><div><span className="eyebrow">Schema-driven CRM</span><h1>CRM schema & fields</h1><p>Each module can own fields, child modules and reusable module references.</p></div><div className="topbar-actions"><button className="button button-secondary" type="button" onClick={()=>setNewSchemaOpen(true)}><Plus size={17}/> Add module</button><button className="button button-secondary danger-action" type="button" onClick={()=>onDeleteSchema?.(draft)}><Trash2 size={17}/> Delete module</button><button className="button button-primary" type="button" onClick={persist} disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>} Save module</button></div></div>

    <ModuleHierarchy schemas={schemas.length ? schemas : [draft]} activeModule={module} onSelectSchema={onSelectSchema} onDeleteSchema={onDeleteSchema} onDeleteAllSchemas={onDeleteAllSchemas} deleting={saving}/>

    <div className="schema-summary-card"><div className="schema-icon"><Layers3 size={24}/></div><div className="schema-name-fields">
      <label><span>Active module</span><select value={module} onChange={(event)=>onSelectSchema?.(event.target.value)}>{(schemas.length?schemas:[draft]).map((item)=><option key={item.module} value={item.module}>{'—'.repeat(Math.max(0,(item.depth||1)-1))} {item.title||item.module} ({item.module})</option>)}</select></label>
      <label><span>Module title</span><input value={draft.title||''} onChange={(event)=>setDraft((current)=>({...current,title:event.target.value}))}/></label>
      <label><span>Module key</span><input value={draft.module||''} readOnly/></label>
      <label><span>Parent module</span><select value={draft.parentSchemaId||''} onChange={(event)=>setDraft((current)=>({...current,parentSchemaId:event.target.value||null}))}><option value="">None — level 1</option>{schemas.filter((item)=>item.id!==draft.id&&(item.depth||1)<5).map((item)=><option key={item.id} value={item.id}>{'—'.repeat(Math.max(0,(item.depth||1)-1))} {item.title||item.module}</option>)}</select></label>
      <label><span>Relationship</span><select value={draft.relationshipType||'COMPOSITION'} onChange={(event)=>setDraft((current)=>({...current,relationshipType:event.target.value}))}><option>COMPOSITION</option><option>AGGREGATION</option><option>ASSOCIATION</option></select></label>
      <label><span>Inherits from</span><select value={draft.extendsSchemaId||''} onChange={(event)=>setDraft((current)=>({...current,extendsSchemaId:event.target.value||null}))}><option value="">None</option>{schemas.filter((item)=>item.id!==draft.id).map((item)=><option key={item.id} value={item.id}>{item.title||item.module}</option>)}</select></label>
      <label><span>Record visibility</span><select value={draft.recordVisibility||'APP_ONLY'} onChange={(event)=>setDraft((current)=>({...current,recordVisibility:event.target.value}))}><option>PUBLIC</option><option>CLIENT_ONLY</option><option>APP_ONLY</option><option>PRIVATE</option></select></label>
      <label className="check-card"><input type="checkbox" checked={draft.allowExternalReference!==false} onChange={(event)=>setDraft((current)=>({...current,allowExternalReference:event.target.checked}))}/><span><Check size={15}/> Allow references</span></label>
      <label className="check-card"><input type="checkbox" checked={draft.repeatable!==false} onChange={(event)=>setDraft((current)=>({...current,repeatable:event.target.checked}))}/><span><Check size={15}/> Repeatable records</span></label>
    </div><div className="schema-count"><strong>{fields.length}</strong><span>Fields in module</span></div></div>

    <div className="schema-fields-panel"><div className="panel-header schema-panel-header"><div><h2>Module fields</h2><p>Add several fields without closing the dialog. Use references for shared modules like Sizes, Colours and Brands.</p></div><button className="button button-primary compact" type="button" onClick={()=>setEditor({field:null})}><Plus size={17}/> Add fields</button></div>
      {!fields.length?<div className="state-card empty-state"><div className="empty-illustration"><Layers3 size={32}/></div><strong>This module has no fields</strong><span>Add fields or create child modules. Both are allowed on the same module.</span><button className="button button-primary" type="button" onClick={()=>setEditor({field:null})}><Plus size={17}/> Add fields</button></div>:<div className="schema-field-list">{fields.map((field,index)=><article className="schema-field-row" key={`${field.key}-${index}`}><div className="field-order-actions"><button type="button" onClick={()=>move(index,-1)} disabled={index===0}><ArrowUp size={15}/></button><span>{index+1}</span><button type="button" onClick={()=>move(index,1)} disabled={index===fields.length-1}><ArrowDown size={15}/></button></div><div className="field-main"><strong>{field.label}</strong><code>{field.key}</code><span>{field.section||'Details'}</span></div><div className="field-type-badge">{field.type?.replaceAll('_',' ')}</div><div className="field-rules">{field.required&&<span>Required</span>}{field.searchable&&<span>Searchable</span>}{field.showOnList&&<span>List</span>}{field.showOnDetail!==false&&<span>Detail</span>}{field.visible===false&&<span>Disabled</span>}</div><div className="field-options-preview">{['SELECT','MULTI_SELECT'].includes(field.type)?(field.options||[]).slice(0,3).join(', ')||'No options':['REFERENCE','MULTI_REFERENCE','DEPENDENT_REFERENCE'].includes(field.type)?`→ ${field.referenceModule||'Module'}`:field.placeholder||'—'}</div><div className="field-row-actions"><button type="button" onClick={()=>setEditor({field,index})}><Pencil size={16}/></button><button className="danger-action" type="button" onClick={()=>setDraft((current)=>({...current,fields:current.fields.filter((_,itemIndex)=>itemIndex!==index)}))}><Trash2 size={16}/></button></div></article>)}</div>}
    </div>

    {editor&&<FieldEditor field={editor.field} schemaFields={fields} schemas={schemas} usedKeys={usedKeys} onCancel={()=>setEditor(null)} onSave={saveField}/>}

    {newSchemaOpen&&<div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event)=>event.target===event.currentTarget&&setNewSchemaOpen(false)}><form className="new-schema-dialog" onSubmit={(event)=>{event.preventDefault();const nextModule=normalizeModule(newModule);if(!nextModule||!newTitle.trim())return;onCreateSchema({module:nextModule,title:newTitle.trim(),fields:[],requiredFields:[],allowedFields:[],searchFields:[],uniqueRules:[],parentSchemaId:newParentSchemaId||null,repeatable:newRepeatable,displayOrder:0,active:true});setNewSchemaOpen(false);setNewModule('');setNewTitle('');setNewParentSchemaId('');setNewRepeatable(true)}}><header className="field-editor-header"><div><span className="eyebrow">Reusable business module</span><h2>Create module</h2></div><button className="icon-button" type="button" onClick={()=>setNewSchemaOpen(false)}><X size={19}/></button></header><div className="field-editor-body"><div className="form-field"><label>Module title</label><input value={newTitle} onChange={(event)=>setNewTitle(event.target.value)} placeholder="Sizes"/></div><div className="form-field"><label>Module key</label><input value={newModule} onChange={(event)=>setNewModule(event.target.value)} placeholder="SIZES"/></div><div className="form-field"><label>Parent module</label><select value={newParentSchemaId} onChange={(event)=>setNewParentSchemaId(event.target.value)}><option value="">None — reusable level 1 module</option>{schemas.filter((item)=>(item.depth||1)<5).map((item)=><option key={item.id} value={item.id}>{'—'.repeat(Math.max(0,(item.depth||1)-1))} {item.title||item.module}</option>)}</select></div><label className="check-card"><input type="checkbox" checked={newRepeatable} onChange={(event)=>setNewRepeatable(event.target.checked)}/><span><Check size={15}/> Repeatable records</span></label><p className="schema-help">Choose no parent for a reusable master module such as SIZES. Other modules can reference its records through REFERENCE or MULTI REFERENCE fields.</p></div><footer className="field-editor-footer"><button className="button button-ghost" type="button" onClick={()=>setNewSchemaOpen(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={17}/> Create module</button></footer></form></div>}
  </section>
}

export default SchemaBuilder
