import {
  LoaderCircle,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { crmApi, getErrorMessage } from '../api/crmApi'

const emptyUser = {
  username: '',
  displayName: '',
  password: '',
  roleIds: [],
}

const emptyRole = {
  roleName: '',
  roleCode: '',
  description: '',
  roleScope: 'MODULE',
  moduleId: '',
  permissions: [],
  active: true,
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value
  if (value == null || value === '') return []

  if (typeof value === 'object') {
    if (value.type === 'jsonb' && typeof value.value === 'string') {
      return normalizeArray(value.value)
    }
    if (Array.isArray(value.roles)) return value.roles
    if (Array.isArray(value.roleIds)) return value.roleIds
    if (Array.isArray(value.items)) return value.items
    if (Array.isArray(value.content)) return value.content
    return []
  }

  if (typeof value === 'string') {
    const text = value.trim()
    if (!text || text.toLowerCase() === 'jsonb') return []
    try {
      return normalizeArray(JSON.parse(text))
    } catch {
      return text.split(',').map((item) => item.trim()).filter((item) => item && item.toLowerCase() !== 'jsonb')
    }
  }

  return []
}

function normalizeCollection(response, keys = []) {
  if (Array.isArray(response)) {
    return response
  }

  for (const key of keys) {
    if (Array.isArray(response?.[key])) {
      return response[key]
    }
  }

  if (Array.isArray(response?.items)) {
    return response.items
  }

  if (Array.isArray(response?.content)) {
    return response.content
  }

  return []
}

function resolveRoleId(role) {
  if (typeof role === 'string') {
    const value = role.trim()
    if (!value || value.toLowerCase() === 'jsonb' || value.startsWith('[') || value.startsWith('{')) return null
    return value
  }

  return role?.id ?? role?.roleId ?? role?.role_id ?? null
}

function resolveRoleName(role) {
  if (typeof role === 'string') {
    return role
  }

  return (
      role?.roleName ??
      role?.name ??
      role?.roleCode ??
      role?.role_code ??
      resolveRoleId(role) ??
      'Unnamed role'
  )
}

function userRoleIds(user) {
  return normalizeArray(
      user?.roles ??
      user?.roleIds ??
      user?.assignedRoles ??
      user?.assigned_roles,
  )
      .map(resolveRoleId)
      .filter(Boolean)
}

export default function UserAdmin({
                                    schemas = [],
                                    canManageRoles = false,
                                  }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  const [creatingRole, setCreatingRole] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [activePanel, setActivePanel] = useState('users')
  const [draft, setDraft] = useState(emptyUser)
  const [roleDraft, setRoleDraft] = useState(emptyRole)

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const [userResponse, roleResponse, permissionResponse] =
          await Promise.all([
            crmApi.listUsers(),
            canManageRoles
                ? crmApi.listSecurityRoles()
                : crmApi.listRoles(),
            canManageRoles
                ? crmApi.listPermissionCatalog()
                : Promise.resolve([]),
          ])

      const userRows = normalizeCollection(userResponse, ['users'])
      const roleRows = normalizeCollection(roleResponse, ['roles'])
      const permissionRows = normalizeCollection(permissionResponse, [
        'permissions',
      ])

      setUsers(userRows)
      setRoles(roleRows.filter((item) => item?.active !== false))
      setPermissions(permissionRows)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [canManageRoles])

  useEffect(() => {
    if (!canManageRoles && activePanel === 'roles') {
      setActivePanel('users')
    }
  }, [activePanel, canManageRoles])

  const permissionGroups = useMemo(() => {
    return permissions
        .filter((item) => item?.scopeType === roleDraft.roleScope)
        .reduce((result, item) => {
          const category = item?.category || 'General'
          result[category] = [...(result[category] || []), item]
          return result
        }, {})
  }, [permissions, roleDraft.roleScope])

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) {
      return users
    }

    return users.filter((user) => {
      const roleNames = normalizeArray(
          user?.roles ??
          user?.roleIds ??
          user?.assignedRoles ??
          user?.assigned_roles,
      ).map(resolveRoleName)

      const searchable = [
        user?.username,
        user?.displayName,
        user?.display_name,
        ...roleNames,
      ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

      return searchable.includes(needle)
    })
  }, [query, users])

  const toggle = (list = [], value) => {
    const normalized = normalizeArray(list)

    return normalized.includes(value)
        ? normalized.filter((item) => item !== value)
        : [...normalized, value]
  }

  const moduleTitle = (id) => {
    const schema = schemas.find((item) => item?.id === id)

    return schema?.title || schema?.module || 'Module'
  }

  const createUser = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setCreatingUser(true)

    try {
      await crmApi.createUser({
        ...draft,
        roleIds: normalizeArray(draft.roleIds),
      })

      setDraft(emptyUser)
      setNotice('User created successfully.')
      await load()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCreatingUser(false)
    }
  }

  const saveUser = async (user) => {
    setError('')
    setNotice('')
    setSavingUserId(user.id)

    try {
      await crmApi.updateUser(user.id, {
        ...user,
        roleIds: userRoleIds(user),
      })

      setNotice(
          `Access updated for ${
              user.displayName || user.display_name || user.username
          }.`,
      )

      await load()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSavingUserId('')
    }
  }

  const createRole = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setCreatingRole(true)

    try {
      await crmApi.createSecurityRole({
        ...roleDraft,
        moduleId:
            roleDraft.roleScope === 'MODULE'
                ? roleDraft.moduleId
                : null,
        permissions: normalizeArray(roleDraft.permissions),
      })

      setRoleDraft(emptyRole)
      setNotice(
          'Role created. Its name is only a label; permissions define authority.',
      )

      await load()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setCreatingRole(false)
    }
  }

  if (loading) {
    return (
        <div className="state-card">
          <LoaderCircle className="spin" />
          <strong>Loading access configuration</strong>
        </div>
    )
  }

  return (
      <section className="admin-page access-page">
        <header className="access-hero">
          <div>
            <span className="eyebrow">Access configuration</span>
            <h1>Users, roles and permissions</h1>
            <p>
              Assign authority by app or module permission. Role names such
              as Owner, Manager or Munshi are display labels only.
            </p>
          </div>

          <div className="access-kpis">
            <article>
              <strong>{users.length}</strong>
              <span>Users</span>
            </article>

            <article>
              <strong>{roles.length}</strong>
              <span>Active roles</span>
            </article>

            <article>
              <strong>{schemas.length}</strong>
              <span>Modules</span>
            </article>
          </div>
        </header>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && (
            <div className="notice-banner success">{notice}</div>
        )}

        <div className="access-tabs" role="tablist">
          <button
              type="button"
              className={activePanel === 'users' ? 'active' : ''}
              onClick={() => setActivePanel('users')}
          >
            <UsersRound size={17} />
            Users
          </button>

          {canManageRoles && (
              <button
                  type="button"
                  className={activePanel === 'roles' ? 'active' : ''}
                  onClick={() => setActivePanel('roles')}
              >
                <ShieldCheck size={17} />
                Roles & permissions
              </button>
          )}
        </div>

        {activePanel === 'users' && (
            <>
              <div className="access-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search users, roles or module access"
                  />
                </label>

                <span>
              {filteredUsers.length} of {users.length} users
            </span>
              </div>

              <div className="access-layout">
                <form
                    className="access-form-card"
                    onSubmit={createUser}
                >
                  <div className="access-card-heading">
                    <div className="access-card-icon">
                      <UserPlus size={20} />
                    </div>

                    <div>
                      <h2>Add user</h2>
                      <p>
                        Create an account and assign one or more existing
                        roles.
                      </p>
                    </div>
                  </div>

                  <div className="form-stack">
                    <label>
                      <span>Username</span>
                      <input
                          required
                          value={draft.username}
                          onChange={(event) =>
                              setDraft({
                                ...draft,
                                username: event.target.value,
                              })
                          }
                          placeholder="e.g. neelam"
                      />
                    </label>

                    <label>
                      <span>Display name</span>
                      <input
                          value={draft.displayName}
                          onChange={(event) =>
                              setDraft({
                                ...draft,
                                displayName: event.target.value,
                              })
                          }
                          placeholder="Name shown in the app"
                      />
                    </label>

                    <label>
                      <span>Temporary password</span>
                      <input
                          required
                          type="password"
                          value={draft.password}
                          onChange={(event) =>
                              setDraft({
                                ...draft,
                                password: event.target.value,
                              })
                          }
                          placeholder="Temporary password"
                      />
                    </label>
                  </div>

                  <div className="access-section-label">
                    Initial roles
                  </div>

                  <div className="permission-choice-grid compact-grid">
                    {roles.map((role) => (
                        <label
                            key={role.id}
                            className={
                              draft.roleIds.includes(role.id)
                                  ? 'selected'
                                  : ''
                            }
                        >
                          <input
                              type="checkbox"
                              checked={draft.roleIds.includes(role.id)}
                              onChange={() =>
                                  setDraft({
                                    ...draft,
                                    roleIds: toggle(draft.roleIds, role.id),
                                  })
                              }
                          />

                          <span>
                      <strong>{resolveRoleName(role)}</strong>
                      <small>
                        {role.roleScope === 'APP'
                            ? 'App scope'
                            : moduleTitle(role.moduleId)}
                      </small>
                    </span>
                        </label>
                    ))}
                  </div>

                  <button
                      className="button button-primary full-button"
                      disabled={creatingUser}
                  >
                    {creatingUser ? (
                        <LoaderCircle className="spin" size={17} />
                    ) : (
                        <UserPlus size={17} />
                    )}
                    Add user
                  </button>
                </form>

                <div className="access-user-list">
                  {filteredUsers.map((user) => {
                    const selected = userRoleIds(user)

                    return (
                        <article
                            className="access-user-card"
                            key={user.id}
                        >
                          <div className="access-user-head">
                            <div className="user-avatar large">
                              {(
                                  user.displayName ||
                                  user.display_name ||
                                  user.username ||
                                  '?'
                              )
                                  .slice(0, 1)
                                  .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {user.displayName ||
                                    user.display_name ||
                                    user.username}
                              </strong>
                              <span>@{user.username}</span>
                            </div>

                            <label className="switch-row">
                              <input
                                  type="checkbox"
                                  checked={user.active !== false}
                                  onChange={(event) =>
                                      setUsers((rows) =>
                                          rows.map((item) =>
                                              item.id === user.id
                                                  ? {
                                                    ...item,
                                                    active: event.target.checked,
                                                  }
                                                  : item,
                                          ),
                                      )
                                  }
                              />
                              <span>
                          {user.active !== false
                              ? 'Active'
                              : 'Inactive'}
                        </span>
                            </label>
                          </div>

                          <div className="permission-choice-grid compact-grid">
                            {roles.map((role) => (
                                <label
                                    key={role.id}
                                    className={
                                      selected.includes(role.id)
                                          ? 'selected'
                                          : ''
                                    }
                                >
                                  <input
                                      type="checkbox"
                                      checked={selected.includes(role.id)}
                                      onChange={() =>
                                          setUsers((rows) =>
                                              rows.map((item) => {
                                                if (item.id !== user.id) {
                                                  return item
                                                }

                                                const nextRoleIds = toggle(
                                                    selected,
                                                    role.id,
                                                )

                                                return {
                                                  ...item,
                                                  roles: nextRoleIds.map(
                                                      (id) =>
                                                          roles.find(
                                                              (entry) =>
                                                                  entry.id === id,
                                                          ) || { id },
                                                  ),
                                                }
                                              }),
                                          )
                                      }
                                  />

                                  <span>
                            <strong>{resolveRoleName(role)}</strong>
                            <small>
                              {role.roleScope === 'APP'
                                  ? 'App scope'
                                  : moduleTitle(role.moduleId)}
                            </small>
                          </span>
                                </label>
                            ))}
                          </div>

                          <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => saveUser(user)}
                              disabled={savingUserId === user.id}
                          >
                            {savingUserId === user.id ? (
                                <LoaderCircle className="spin" size={16} />
                            ) : (
                                <Save size={16} />
                            )}
                            Save access
                          </button>
                        </article>
                    )
                  })}

                  {!filteredUsers.length && (
                      <div className="mini-empty">
                        No users match your search.
                      </div>
                  )}
                </div>
              </div>
            </>
        )}

        {activePanel === 'roles' && canManageRoles && (
            <div className="access-layout role-layout">
              <form
                  className="access-form-card role-form"
                  onSubmit={createRole}
              >
                <div className="access-card-heading">
                  <div className="access-card-icon">
                    <Plus size={20} />
                  </div>

                  <div>
                    <h2>Create role</h2>
                    <p>
                      Choose any role name. Scope and permission keys
                      control what it can do.
                    </p>
                  </div>
                </div>

                <div className="form-grid-two">
                  <label>
                    <span>Role name</span>
                    <input
                        required
                        value={roleDraft.roleName}
                        onChange={(event) =>
                            setRoleDraft({
                              ...roleDraft,
                              roleName: event.target.value,
                            })
                        }
                        placeholder="e.g. Munshi"
                    />
                  </label>

                  <label>
                    <span>Technical code</span>
                    <input
                        value={roleDraft.roleCode}
                        onChange={(event) =>
                            setRoleDraft({
                              ...roleDraft,
                              roleCode: event.target.value,
                            })
                        }
                        placeholder="Optional stable key"
                    />
                  </label>

                  <label>
                    <span>Scope</span>
                    <select
                        value={roleDraft.roleScope}
                        onChange={(event) =>
                            setRoleDraft({
                              ...roleDraft,
                              roleScope: event.target.value,
                              moduleId: '',
                              permissions: [],
                            })
                        }
                    >
                      <option value="MODULE">Module</option>
                      <option value="APP">Application</option>
                    </select>
                  </label>

                  {roleDraft.roleScope === 'MODULE' && (
                      <label>
                        <span>Module</span>
                        <select
                            required
                            value={roleDraft.moduleId}
                            onChange={(event) =>
                                setRoleDraft({
                                  ...roleDraft,
                                  moduleId: event.target.value,
                                })
                            }
                        >
                          <option value="">Select module</option>

                          {schemas
                              .filter(
                                  (schema) => schema.active !== false,
                              )
                              .map((schema) => (
                                  <option
                                      key={schema.id}
                                      value={schema.id}
                                  >
                                    {schema.title || schema.module}
                                  </option>
                              ))}
                        </select>
                      </label>
                  )}
                </div>

                <label>
                  <span>Description</span>
                  <textarea
                      rows="3"
                      value={roleDraft.description}
                      onChange={(event) =>
                          setRoleDraft({
                            ...roleDraft,
                            description: event.target.value,
                          })
                      }
                      placeholder="Explain the responsibility of this role"
                  />
                </label>

                <div className="access-section-label">
                  Permissions
                </div>

                <div className="permission-groups polished">
                  {Object.entries(permissionGroups).map(
                      ([category, items]) => (
                          <fieldset key={category}>
                            <legend>{category}</legend>

                            <div className="permission-choice-grid">
                              {items.map((permission) => (
                                  <label
                                      key={permission.permissionKey}
                                      className={
                                        roleDraft.permissions.includes(
                                            permission.permissionKey,
                                        )
                                            ? 'selected'
                                            : ''
                                      }
                                  >
                                    <input
                                        type="checkbox"
                                        checked={roleDraft.permissions.includes(
                                            permission.permissionKey,
                                        )}
                                        onChange={() =>
                                            setRoleDraft({
                                              ...roleDraft,
                                              permissions: toggle(
                                                  roleDraft.permissions,
                                                  permission.permissionKey,
                                              ),
                                            })
                                        }
                                    />

                                    <span>
                            <strong>
                              {permission.permissionName}
                            </strong>
                            <small>
                              {permission.description}
                            </small>
                          </span>
                                  </label>
                              ))}
                            </div>
                          </fieldset>
                      ),
                  )}

                  {!Object.keys(permissionGroups).length && (
                      <div className="mini-empty">
                        No permissions are configured for this scope.
                      </div>
                  )}
                </div>

                <button
                    className="button button-primary full-button"
                    disabled={creatingRole}
                >
                  {creatingRole ? (
                      <LoaderCircle className="spin" size={17} />
                  ) : (
                      <ShieldCheck size={17} />
                  )}
                  Create role
                </button>
              </form>

              <section className="access-role-catalog">
                <div className="access-card-heading">
                  <div className="access-card-icon">
                    <ShieldCheck size={20} />
                  </div>

                  <div>
                    <h2>Role catalogue</h2>
                    <p>
                      Current role definitions and their assigned scope.
                    </p>
                  </div>
                </div>

                {roles.map((role) => (
                    <article
                        className="role-catalog-row"
                        key={role.id}
                    >
                      <div>
                        <strong>{resolveRoleName(role)}</strong>
                        <small>
                          {role.roleCode ||
                              role.role_code ||
                              'No technical code'}
                        </small>
                      </div>

                      <span>
                  {role.roleScope === 'APP'
                      ? 'App'
                      : moduleTitle(role.moduleId)}
                </span>

                      <b>
                        {normalizeArray(role.permissions).length}{' '}
                        permissions
                      </b>
                    </article>
                ))}
              </section>
            </div>
        )}

        <div className="admin-note">
          <ShieldCheck size={18} />
          Field access should use permission keys or stable role IDs.
          Display names never grant authority by themselves.
        </div>
      </section>
  )
}
