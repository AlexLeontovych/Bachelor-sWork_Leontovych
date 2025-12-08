import { useState, useEffect } from 'react'
import { getCurrentProfile, signOut, updatePassword, isAdmin, banUser, unbanUser } from '../../../services/authService'
import { supabase } from '../../../lib/supabase'
import './UserCabinet.css'

const UserCabinet = ({ 
  projects: projectsFromProps, 
  onBack, 
  onSignOut,
  onEditProject,
  onProjectPreview,
  onProjectExport,
  onDeleteProject
}) => {
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState(projectsFromProps || [])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile') // 'profile', 'projects' или 'users'
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [isBanning, setIsBanning] = useState(false)
  
  // Состояния для смены пароля
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Обновляем проекты, если они изменились в пропсах
    if (projectsFromProps && Array.isArray(projectsFromProps)) {
      setProjects(projectsFromProps)
    }
  }, [projectsFromProps])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Загружаем профиль (это критично, должно быть выполнено)
      try {
        const userProfile = await getCurrentProfile()
        setProfile(userProfile)
        
        // Проверяем, является ли пользователь администратором
        try {
          const adminStatus = await isAdmin()
          setIsAdminUser(adminStatus)
        } catch (error) {
          console.error('Error checking admin status:', error)
          setIsAdminUser(false)
        }

        // Если пользователь администратор, загружаем список всех пользователей
        if (userProfile?.role === 'admin') {
          try {
            await loadAllUsers()
          } catch (error) {
            console.error('Error loading users:', error)
            // Продолжаем загрузку даже если не удалось загрузить пользователей
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        // Если не удалось загрузить профиль, все равно показываем интерфейс
        setProfile(null)
      }

      // В профиле показываем только проекты текущего пользователя
      // Загружаем только свои проекты из БД
      try {
        const { getUserProjects, transformProjectFromDB } = await import('../../../services/projectService')
        const projectsData = await getUserProjects()
        const transformedProjects = projectsData.map(transformProjectFromDB)
        setProjects(transformedProjects)
      } catch (error) {
        console.error('Error loading user projects:', error)
        // Устанавливаем пустой массив даже при ошибке, чтобы не блокировать загрузку
        setProjects([])
      }
    } catch (error) {
      console.error('Unexpected error loading data:', error)
      // Устанавливаем пустые значения при ошибке, чтобы не блокировать интерфейс
      setProjects([])
    } finally {
      // Всегда снимаем флаг загрузки
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    // Предотвращаем множественные одновременные загрузки
    if (loadingUsers) {
      console.log('[DB DEBUG] Загрузка пользователей уже выполняется, пропускаем...')
      return
    }
    
    try {
      setLoadingUsers(true)
      console.log('[DB DEBUG] Загрузка всех пользователей из таблицы profiles...')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('[DB DEBUG] Результат загрузки пользователей:', {
        data: data ? `${data.length} пользователей` : 'null',
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : 'null'
      })

      if (error) {
        console.error('[DB DEBUG] Ошибка загрузки пользователей:', error)
        throw error
      }
      
      console.log('[DB DEBUG] Пользователи успешно загружены:', data?.map(u => ({ id: u.id, email: u.email, banned: u.banned })))
      setAllUsers(data || [])
    } catch (error) {
      console.error('[DB DEBUG] Критическая ошибка загрузки пользователей:', error)
      // Не выбрасываем ошибку дальше, чтобы не блокировать UI
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      // Обновляем локальный список пользователей
      setAllUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))

      // Если изменили свою роль, обновляем профиль
      if (userId === profile?.id) {
        const updatedProfile = await getCurrentProfile()
        setProfile(updatedProfile)
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Error changing role: ' + error.message)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    // Валидация
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    try {
      setChangingPassword(true)
      
      // Проверяем текущий пароль, пытаясь войти
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword
      })

      if (signInError) {
        setPasswordError('Invalid current password')
        return
      }

      // Обновляем пароль
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error.message || 'Error changing password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="user-cabinet-loading">
        Loading...
      </div>
    )
  }

  return (
    <div className="user-cabinet">
      <div className="user-cabinet-header">
        <button 
          className="user-cabinet-back" 
          onClick={() => {
            // Всегда разрешаем выход, даже во время операций
            onBack()
          }}
          style={{ 
            opacity: (isBanning || loadingUsers) ? 0.7 : 1
          }}
        >
          ← Back {(isBanning || loadingUsers) && '...'}
        </button>
        <h1 className="user-cabinet-title">User Cabinet</h1>
      </div>

      <div className="user-cabinet-tabs">
        <button
          className={`user-cabinet-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`user-cabinet-tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          My Projects ({projects.length})
        </button>
        {profile?.role === 'admin' && (
          <button
            className={`user-cabinet-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Management ({allUsers.length})
          </button>
        )}
      </div>

      <div className="user-cabinet-content">
        {activeTab === 'profile' && (
          <div className="user-cabinet-section">
            <div className="user-cabinet-info">
              <div className="user-info-item">
                <label className="user-info-label">Email:</label>
                <span className="user-info-value">{profile?.email || 'Not specified'}</span>
              </div>
              <div className="user-info-item">
                <label className="user-info-label">Name:</label>
                <span className="user-info-value">{profile?.full_name || 'Not specified'}</span>
              </div>
              <div className="user-info-item">
                <label className="user-info-label">Role:</label>
                <span className={`user-info-value user-role-badge ${profile?.role === 'admin' ? 'admin' : 'user'}`}>
                  {profile?.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </div>
              <div className="user-info-item">
                <label className="user-info-label">Registration Date:</label>
                <span className="user-info-value">
                  {profile?.created_at 
                    ? new Date(profile.created_at).toLocaleDateString('en-US')
                    : 'Not specified'}
                </span>
              </div>
            </div>

            <div className="user-cabinet-password-section">
              <h2 className="user-cabinet-section-title">Change Password</h2>
              <form className="user-password-form" onSubmit={handlePasswordChange}>
                <div className="user-form-group">
                  <label htmlFor="currentPassword" className="user-form-label">
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    className="user-form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={changingPassword}
                  />
                </div>

                <div className="user-form-group">
                  <label htmlFor="newPassword" className="user-form-label">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    className="user-form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    disabled={changingPassword}
                  />
                </div>

                <div className="user-form-group">
                  <label htmlFor="confirmPassword" className="user-form-label">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="user-form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    minLength={6}
                    disabled={changingPassword}
                  />
                </div>

                {passwordError && (
                  <div className="user-form-error">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="user-form-success">
                    {passwordSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="user-form-button"
                  disabled={changingPassword}
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>

            <div className="user-cabinet-actions">
              <button
                className="user-signout-button"
                onClick={async () => {
                  try {
                    await signOut()
                    if (onSignOut) onSignOut()
                  } catch (error) {
                    console.error('Sign out error:', error)
                  }
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="user-cabinet-section">
            {projects.length === 0 ? (
              <div className="user-projects-empty">
                <p>You don't have any projects yet</p>
                <p className="user-projects-empty-hint">Create your first project to see it here</p>
              </div>
            ) : (
              <div className="user-projects-list">
                {projects.map((project) => (
                  <div key={project.id} className="user-project-card">
                    <div className="user-project-header">
                      <h3 className="user-project-name">{project.name}</h3>
                      <span className={`user-project-status user-project-status-${project.status?.toLowerCase()}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="user-project-info">
                      <div className="user-project-meta">
                        <span className="user-project-format">{project.format}</span>
                        <span className="user-project-separator">•</span>
                        <span className={`user-project-orientation ${(project.screenFormat || project.screen_format) === 'portrait' ? 'portrait' : 'landscape'}`}>
                          {(project.screenFormat || project.screen_format) === 'portrait' ? 'Portrait' : 'Landscape'}
                        </span>
                      </div>
                      <div className="user-project-date">
                        Created: {new Date(project.createdAt || project.created_at || Date.now()).toLocaleDateString('en-US')}
                        {project.updatedAt && project.updatedAt !== (project.createdAt || project.created_at) && (
                          <span className="user-project-updated">
                            {' • Updated: ' + new Date(project.updatedAt).toLocaleDateString('en-US')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="user-project-actions">
                      <button
                        className="user-project-action-btn user-project-action-preview"
                        onClick={() => {
                          if (onProjectPreview && project.images && project.images.length > 0) {
                            const format = project.screenFormat || project.screen_format || 'landscape'
                            onProjectPreview(project, format)
                          } else {
                            alert('No images in project for preview')
                          }
                        }}
                        title="Preview"
                        disabled={!project.images || project.images.length === 0}
                      >
                        👁️
                      </button>
                      <button
                        className="user-project-action-btn user-project-action-export"
                        onClick={() => {
                          if (onProjectExport && project.images && project.images.length > 0) {
                            onProjectExport(project)
                          } else {
                            alert('No images in project for export')
                          }
                        }}
                        title="Export"
                        disabled={!project.images || project.images.length === 0}
                      >
                        ⬇️
                      </button>
                      <button
                        className={`user-project-action-btn user-project-action-edit ${(project.status === 'Active' && !isAdminUser) ? 'disabled' : ''}`}
                        onClick={() => {
                          if (onEditProject) {
                            // Проверяем права доступа
                            if (project.status === 'Active' && !isAdminUser) {
                              alert('Only admin can edit active projects')
                              return
                            }
                            onEditProject(project)
                            onBack() // Возвращаемся к списку проектов
                          }
                        }}
                        title={(project.status === 'Active' && !isAdminUser) ? 'Only admin can edit active projects' : 'Edit in Studio'}
                        disabled={project.status === 'Active' && !isAdminUser}
                      >
                        ✏️
                      </button>
                      <button
                        className={`user-project-action-btn user-project-action-delete ${(project.status === 'Active' && !isAdminUser) ? 'disabled' : ''}`}
                        onClick={() => {
                          // Проверяем права доступа
                          if (project.status === 'Active' && !isAdminUser) {
                            alert('Only admin can delete active projects')
                            return
                          }
                          
                          if (window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                            if (onDeleteProject) {
                              onDeleteProject(project.id)
                              // Обновляем список проектов после удаления
                              setProjects(prev => prev.filter(p => p.id !== project.id))
                            }
                          }
                        }}
                        title={(project.status === 'Active' && !isAdminUser) ? 'Only admin can delete active projects' : 'Delete'}
                        disabled={project.status === 'Active' && !isAdminUser}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && profile?.role === 'admin' && (
          <div className="user-cabinet-section">
            <h2 className="user-cabinet-section-title">User Management</h2>
            {loadingUsers ? (
              <div className="user-loading">Loading users...</div>
            ) : allUsers.length === 0 ? (
              <div className="user-projects-empty">
                <p>No users found</p>
              </div>
            ) : (
              <div className="user-users-table">
                <div className="user-users-header">
                  <div className="user-users-col user-users-col-email">Email</div>
                  <div className="user-users-col user-users-col-name">Name</div>
                  <div className="user-users-col user-users-col-role">Role</div>
                  <div className="user-users-col user-users-col-status">Status</div>
                  <div className="user-users-col user-users-col-date">Registration Date</div>
                  <div className="user-users-col user-users-col-actions">Actions</div>
                </div>
                {allUsers.map((user) => (
                  <div key={user.id} className="user-users-row">
                    <div className="user-users-col user-users-col-email">
                      {user.email || 'Not specified'}
                    </div>
                    <div className="user-users-col user-users-col-name">
                      {user.full_name || 'Not specified'}
                    </div>
                    <div className="user-users-col user-users-col-role">
                      {editingUserId === user.id ? (
                        <select
                          className="user-role-select"
                          value={user.role}
                          onChange={(e) => {
                            handleRoleChange(user.id, e.target.value)
                            setEditingUserId(null)
                          }}
                          onBlur={() => setEditingUserId(null)}
                          autoFocus
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span 
                          className={`user-role-badge ${user.role === 'admin' ? 'admin' : 'user'}`}
                          onClick={() => setEditingUserId(user.id)}
                          style={{ cursor: 'pointer' }}
                          title="Click to change role"
                        >
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      )}
                    </div>
                    <div className="user-users-col user-users-col-status">
                      {user.banned ? (
                        <span className="user-banned-badge">Banned</span>
                      ) : (
                        <span className="user-active-badge">Active</span>
                      )}
                    </div>
                    <div className="user-users-col user-users-col-date">
                      {user.created_at 
                        ? new Date(user.created_at).toLocaleDateString('en-US')
                        : 'Not specified'}
                    </div>
                    <div className="user-users-col user-users-col-actions">
                      <div className="user-users-actions-group">
                        {editingUserId !== user.id && (
                          <button
                            className="user-edit-role-btn"
                            onClick={() => setEditingUserId(user.id)}
                            title="Change role"
                          >
                            ✏️
                          </button>
                        )}
                        {user.id !== profile?.id && (
                          <button
                            className={user.banned ? "user-unban-btn" : "user-ban-btn"}
                            onClick={async () => {
                              if (isBanning) return // Предотвращаем множественные клики
                              
                              const action = user.banned ? 'unban' : 'ban'
                              if (window.confirm(`Are you sure you want to ${action} account ${user.email || 'this user'}?`)) {
                                try {
                                  setIsBanning(true)
                                  console.log('[DB DEBUG] Начало бана/разбана пользователя:', user.id, 'текущий статус banned:', user.banned)
                                  if (user.banned) {
                                    console.log('[DB DEBUG] Вызов unbanUser для пользователя:', user.id)
                                    await unbanUser(user.id)
                                  } else {
                                    console.log('[DB DEBUG] Вызов banUser для пользователя:', user.id)
                                    await banUser(user.id)
                                  }
                                  // Обновляем список пользователей
                                  const newBannedStatus = !user.banned
                                  console.log('[DB DEBUG] Обновление локального состояния, новый статус banned:', newBannedStatus)
                                  setAllUsers(prev => prev.map(u => 
                                    u.id === user.id ? { ...u, banned: newBannedStatus } : u
                                  ))
                                  // Перезагружаем список пользователей для синхронизации с БД (без блокировки UI)
                                  loadAllUsers().catch(err => {
                                    console.error('[DB DEBUG] Ошибка при перезагрузке пользователей:', err)
                                  })
                                  alert(`User ${user.banned ? 'unbanned' : 'banned'}`)
                                } catch (error) {
                                  console.error('[DB DEBUG] Ошибка бана/разбана пользователя:', error)
                                  alert('Error: ' + error.message)
                                } finally {
                                  setIsBanning(false)
                                }
                              }
                            }}
                            disabled={isBanning}
                            title={user.banned ? "Unban user" : "Ban user"}
                          >
                            {user.banned ? '🔓' : '🔒'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserCabinet

