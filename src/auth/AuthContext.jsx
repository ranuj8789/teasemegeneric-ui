import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { crmApi } from '../api/crmApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [capabilities, setCapabilities] = useState({ appPermissions: [], modulePermissions: {} })

  useEffect(() => {
    Promise.all([crmApi.me(), crmApi.getMyCapabilities()]).then(([me, caps]) => { setUser(me); setCapabilities(caps || { appPermissions: [], modulePermissions: {} }) }).catch(() => crmApi.clearToken()).finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    capabilities,
    hasPermission: (permission, moduleId = null) => moduleId
        ? Boolean(capabilities?.modulePermissions?.[moduleId]?.includes(permission) || capabilities?.appPermissions?.includes('APP_CONFIGURE'))
        : Boolean(capabilities?.appPermissions?.includes(permission) || capabilities?.appPermissions?.includes('APP_CONFIGURE')),
    canApproveAnyModule: () => Object.values(capabilities?.modulePermissions || {}).some((items) => items?.includes('MODULE_OPERATION_APPROVE')) || capabilities?.appPermissions?.includes('APP_CONFIGURE'),
    async login(username, password) {
      const result = await crmApi.login(username, password)
      crmApi.setToken(result.accessToken)
      setUser(result.user)
      setCapabilities(await crmApi.getMyCapabilities())
      return result.user
    },
    async logout() {
      try { await crmApi.logout() } finally { crmApi.clearToken(); setUser(null); setCapabilities({ appPermissions: [], modulePermissions: {} }) }
    },
    refresh: async () => { const [me, caps] = await Promise.all([crmApi.me(), crmApi.getMyCapabilities()]); setUser(me); setCapabilities(caps); },
  }), [user, loading, capabilities])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
