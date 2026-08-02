export const activeFields = (schema) => [...(schema?.fields || [])]
    .filter((field) => field && field.visible !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

export const fieldConfig = (field) => field?.config && typeof field.config === 'object' ? field.config : {}
export const fieldSemantic = (field) => String(fieldConfig(field).semantic || '').trim().toUpperCase()
export const mediaKind = (field) => String(fieldConfig(field).mediaType || 'FILE').trim().toUpperCase()

export const fieldsByType = (schema, type) => activeFields(schema).filter((field) => String(field.type || '').toUpperCase() === String(type).toUpperCase())
export const fieldBySemantic = (schema, semantic) => activeFields(schema).find((field) => fieldSemantic(field) === String(semantic).toUpperCase())

export const mediaFields = (schema, kind = null) => fieldsByType(schema, 'MEDIA')
    .filter((field) => !kind || mediaKind(field) === String(kind).toUpperCase())

export const valueList = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []

export const firstMediaValue = (schema, data = {}, kind = 'IMAGE') => {
  for (const field of mediaFields(schema, kind)) {
    const value = valueList(data[field.key])[0]
    if (value) return value
  }
  return null
}

export const displayField = (schema, semantic, acceptedTypes = []) => {
  const explicit = fieldBySemantic(schema, semantic)
  if (explicit) return explicit
  const accepted = new Set(acceptedTypes.map((item) => String(item).toUpperCase()))
  return activeFields(schema).find((field) => !accepted.size || accepted.has(String(field.type || '').toUpperCase())) || null
}

export const displayValue = (schema, data = {}, semantic, acceptedTypes = [], fallback = '') => {
  const field = displayField(schema, semantic, acceptedTypes)
  const value = field ? data[field.key] : null
  return value === null || value === undefined || value === '' ? fallback : value
}

export const schemaPayload = (schema, values = {}) => {
  const keys = new Set(activeFields(schema).map((field) => field.key))
  return Object.fromEntries(Object.entries(values).filter(([key]) => keys.has(key)))
}


export const fieldAccessPolicy = (field) => {
  const config = fieldConfig(field)
  const access = config.accessPolicy && typeof config.accessPolicy === 'object' ? config.accessPolicy : {}
  return {
    viewPermissions: Array.isArray(access.viewPermissions) ? access.viewPermissions : [],
    editPermissions: Array.isArray(access.editPermissions) ? access.editPermissions : [],
  }
}
