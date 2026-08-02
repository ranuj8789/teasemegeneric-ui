import axios from 'axios'

const API_ORIGIN =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8083'

const api = axios.create({
  baseURL: API_ORIGIN,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('crmAccessToken')
  config.headers = config.headers || {}
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use((response) => response, (error) => {
  if (error?.response?.status === 401) window.localStorage.removeItem('crmAccessToken')
  return Promise.reject(error)
})

const dataOf = (response) => response.data

export const crmApi = {
  origin: API_ORIGIN,
  setToken(token) { window.localStorage.setItem('crmAccessToken', token) },
  clearToken() { window.localStorage.removeItem('crmAccessToken') },
  async login(username, password) { return dataOf(await api.post('/api/auth/login', { username, password })) },
  async me() { return dataOf(await api.get('/api/auth/me')) },
  async logout() { return dataOf(await api.post('/api/auth/logout')) },
  async changePassword(payload) { return dataOf(await api.post('/api/auth/change-password', payload)) },
  async listUsers() { return dataOf(await api.get('/api/admin/users')) },
  async listRoles() { return dataOf(await api.get('/api/admin/roles')) },
  async createUser(payload) { return dataOf(await api.post('/api/admin/users', payload)) },
  async updateUser(id, payload) { return dataOf(await api.put(`/api/admin/users/${id}`, payload)) },
  async resetUserPassword(id, password) { return dataOf(await api.post(`/api/admin/users/${id}/reset-password`, { password })) },
  async getMyCapabilities() { return dataOf(await api.get('/api/security/me/capabilities')) },
  async listPermissionCatalog() { return dataOf(await api.get('/api/security/permissions')) },
  async listSecurityRoles() { return dataOf(await api.get('/api/security/roles')) },
  async createSecurityRole(payload) { return dataOf(await api.post('/api/security/roles', payload)) },
  async updateSecurityRole(id, payload) { return dataOf(await api.put(`/api/security/roles/${id}`, payload)) },
  async listEventTypes() { return dataOf(await api.get('/api/crm/events/types')) },
  async createEventType(payload) { return dataOf(await api.post('/api/crm/events/types', payload)) },
  async listRecentEvents(limit = 50) { return dataOf(await api.get('/api/crm/events/recent', { params: { limit } })) },
  async listEventSchedules() { return dataOf(await api.get('/api/crm/events/schedules')) },
  async saveEventSchedule(payload) { return dataOf(await api.post('/api/crm/events/schedules', payload)) },

  async getMeta() {
    return dataOf(await api.get('/api/crm/meta'))
  },


  async getOperationCapabilities(module) {
    return dataOf(await api.get(`/api/crm/operations/${module}/capabilities`))
  },

  async requestOperation(payload) {
    return dataOf(await api.post('/api/crm/operations/requests', payload))
  },

  async listPendingApprovals() {
    return dataOf(await api.get('/api/crm/approvals/pending'))
  },

  async approveRequest(id, comments = '') {
    return dataOf(await api.post(`/api/crm/approvals/${id}/approve`, { comments }))
  },

  async rejectRequest(id, comments = '') {
    return dataOf(await api.post(`/api/crm/approvals/${id}/reject`, { comments }))
  },

  async listSchemas() {
    return dataOf(await api.get('/api/crm/schemas'))
  },

  async getSchema(module) {
    return dataOf(await api.get(`/api/crm/schemas/${module}`))
  },

  async createSchema(schema) {
    return dataOf(await api.post('/api/crm/schemas', schema))
  },

  async updateSchema(module, schema) {
    return dataOf(
        await api.put(`/api/crm/schemas/${module}`, schema),
    )
  },

  async analyzeSchemaDeletion(module) {
    return dataOf(
        await api.get(`/api/crm/schemas/${module}/delete-analysis`),
    )
  },

  async deleteSchema(module, hard = false, reason = '') {
    return this.requestOperation({ operation: 'DELETE', targetType: 'SCHEMA', module, hard, reason })
  },

  async deleteField(module, fieldKey, reason = '') {
    return this.requestOperation({ operation: 'DELETE', targetType: 'FIELD', module, fieldKey, reason })
  },

  async listSchemaVersions(module) {
    return dataOf(
        await api.get(`/api/crm/schemas/${module}/versions`),
    )
  },

  async listActions() { return dataOf(await api.get('/api/crm/automation/actions')) },
  async saveAction(payload) { return dataOf(await api.post('/api/crm/automation/actions', payload)) },
  async listWorkflows() { return dataOf(await api.get('/api/crm/automation/workflows')) },
  async saveWorkflow(payload) { return dataOf(await api.post('/api/crm/automation/workflows', payload)) },
  async listTriggers() { return dataOf(await api.get('/api/crm/automation/triggers')) },
  async saveTrigger(payload) { return dataOf(await api.post('/api/crm/automation/triggers', payload)) },
  async listAutomationExecutions() { return dataOf(await api.get('/api/crm/automation/executions')) },

  async validateActionProgram(program) {
    return dataOf(
        await api.post(
            '/api/crm/automation/actions/validate-program',
            { program },
        ),
    )
  },

  async listConnectors() { return dataOf(await api.get('/api/crm/connectors')) },
  async saveConnector(payload) { return dataOf(await api.post('/api/crm/connectors', payload)) },
  async testConnector(connectorKey) { return dataOf(await api.post(`/api/crm/connectors/${connectorKey}/test`)) },
  async saveEmailConnector(payload) {
    return this.saveConnector({ ...payload, connectorType: 'SMTP', displayName: payload.displayName || payload.connectorKey || 'Email connector' })
  },
  async testEmailConnector(payload) {
    const saved = await this.saveEmailConnector(payload)
    return this.testConnector(saved.connectorKey || payload.connectorKey)
  },

  async listRecords(module) {
    return dataOf(await api.get(`/api/crm/${module}`))
  },

  async createRecord(
      module,
      payload,
      parentRecordId = null,
  ) {
    return dataOf(
        await api.post(`/api/crm/${module}`, payload, {
          params: parentRecordId
              ? { parentRecordId }
              : {},
        }),
    )
  },

  async listChildRecords(parentRecordId) {
    return dataOf(
        await api.get(
            `/api/crm/records/${parentRecordId}/children`,
        ),
    )
  },

  async listChildSchemas(parentSchemaId) {
    return dataOf(
        await api.get(
            `/api/crm/schemas/${parentSchemaId}/children`,
        ),
    )
  },

  async updateRecord(
      module,
      id,
      payload,
  ) {
    return dataOf(
        await api.put(`/api/crm/${module}/${id}`, payload),
    )
  },

  async deleteRecord(module, id, reason = '') {
    return this.requestOperation({ operation: 'DELETE', targetType: 'RECORD', module, recordId: id, reason })
  },

  async uploadMedia(
      module,
      recordId,
      fieldKey,
      file,
      {
        compress = true,
        mediaType,
      } = {},
  ) {
    const formData = new FormData()

    formData.append('module', module)
    formData.append('recordId', recordId)
    formData.append('fieldKey', fieldKey)
    formData.append('compress', String(compress))

    if (mediaType) {
      formData.append('mediaType', mediaType)
    }

    formData.append('file', file)

    return dataOf(
        await api.post(
            '/api/crm/media/upload',
            formData,
        ),
    )
  },

  async removeMedia(
      module,
      recordId,
      fieldKey,
      mediaUrl,
      {
        deleteFile = true,
        mediaType,
      } = {},
  ) {
    const params = {
      module,
      recordId,
      fieldKey,
      mediaUrl,
      deleteFile,
    }

    if (mediaType) {
      params.mediaType = mediaType
    }

    return this.requestOperation({
      operation: 'DELETE',
      targetType: 'MEDIA',
      module,
      recordId,
      fieldKey,
      targetKey: mediaUrl,
      deleteFile,
      mediaType,
      reason: 'Remove media from record',
    })
  },
}

export const resolveMediaUrl = (url) => {
  if (!url) return ''

  if (
      /^https?:\/\//i.test(url) ||
      url.startsWith('blob:') ||
      url.startsWith('data:')
  ) {
    return url
  }

  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

export const getErrorMessage = (error) => {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (data?.message) {
    return data.message
  }

  if (data?.error) {
    return data.error
  }

  if (error?.code === 'ECONNABORTED') {
    return 'The server took too long to respond.'
  }

  if (error?.message === 'Network Error') {
    return 'Cannot connect to the inventory server on port 8083.'
  }

  return error?.message || 'Something went wrong.'
}