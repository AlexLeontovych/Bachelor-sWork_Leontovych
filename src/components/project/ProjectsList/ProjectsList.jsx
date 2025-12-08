import { useState, useEffect, useRef } from 'react'
import { PROJECT_STATUSES } from '../../shared/utils/constants'
import { getCurrentProfile, signOut, isAdmin } from '../../../services/authService'
import './ProjectsList.css'

const ProjectsList = ({
  projects,
  editingProjectId,
  onNewProject,
  onEditProject,
  onUpdateProject,
  onSetEditingId,
  onProjectPreview,
  onProjectExport,
  onDeleteProject,
  onSignOut,
  onOpenCabinet,
  isGuest = false
}) => {
  const [userProfile, setUserProfile] = useState(null)
  const [isAdminUser, setIsAdminUser] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      if (isGuest) {
        // Для гостя не загружаем профиль
        return
      }
      try {
        const profile = await getCurrentProfile()
        setUserProfile(profile)
        const adminStatus = await isAdmin()
        setIsAdminUser(adminStatus)
      } catch (error) {
        console.error('Error loading profile:', error)
        // Если не удалось загрузить профиль, все равно показываем интерфейс
        setUserProfile(null)
      }
    }
    loadProfile()
  }, [isGuest])
  // Все состояния объявлены в начале
  const [formatFilter, setFormatFilter] = useState('all') // 'all', 'landscape', 'portrait'
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingStatusId, setEditingStatusId] = useState(null) // Отдельное состояние для редактирования статуса
  const [sortBy, setSortBy] = useState(null) // 'name', 'status', 'format', 'orientation'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' or 'desc'
  
  // Все refs объявлены после состояний
  const dropdownRef = useRef(null)
  
  // Закрываем выпадающее меню формата при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowFormatDropdown(false)
      }
    }
    
    if (showFormatDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFormatDropdown])
  
  // Фильтруем проекты по формату и поисковому запросу
  const filteredProjects = projects.filter(project => {
    const matchesFormat = formatFilter === 'all' || project.screenFormat === formatFilter
    const matchesSearch = searchQuery === '' || 
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFormat && matchesSearch
  })

  // Функция для сортировки проектов
  const handleSort = (column) => {
    if (sortBy === column) {
      // Если уже сортируем по этой колонке, меняем порядок
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Если новая колонка, устанавливаем её и порядок по возрастанию
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Применяем сортировку к отфильтрованным проектам
  const sortedAndFilteredProjects = [...filteredProjects].sort((a, b) => {
    if (!sortBy) return 0

    let aValue, bValue

    switch (sortBy) {
      case 'name':
        aValue = (a.name || '').toLowerCase()
        bValue = (b.name || '').toLowerCase()
        break
      case 'status':
        aValue = a.status || ''
        bValue = b.status || ''
        break
      case 'format':
        aValue = a.format || ''
        bValue = b.format || ''
        break
      case 'orientation':
        aValue = a.screenFormat || 'landscape'
        bValue = b.screenFormat || 'landscape'
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })
  
  const formatLabels = {
    'all': 'All',
    'landscape': 'Landscape',
    'portrait': 'Portrait'
  }
  
  return (
    <div className="projects-view">
      <div className="projects-header">
        <div className="projects-header-left">
          <h1 className="projects-title">Creatives</h1>
          {!isGuest && (
            <div className="projects-user-info">
              {userProfile ? (
                <>
                  <button
                    className="projects-user-name-button"
                    onClick={onOpenCabinet}
                    title="Open user cabinet"
                  >
                    {userProfile.email || 'Profile'}
                  </button>
                  <span className={`projects-user-role projects-user-role-${userProfile.role || 'user'}`}>
                    {userProfile.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </>
              ) : (
                <button
                  className="projects-user-name-button"
                  onClick={onOpenCabinet}
                  title="Открыть личный кабинет"
                >
                  Profile
                </button>
              )}
            </div>
          )}
          {isGuest && (
            <div className="projects-user-info">
              <span className="projects-guest-badge">Guest</span>
            </div>
          )}
          <div className="projects-search-wrapper">
            <input
              type="text"
              className="projects-search-input"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="projects-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <div className="projects-format-dropdown-wrapper" ref={dropdownRef}>
            <button 
              className="projects-format-dropdown-btn"
              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
            >
              <span>{formatLabels[formatFilter]}</span>
              <span className="projects-dropdown-arrow">{showFormatDropdown ? '▲' : '▼'}</span>
            </button>
            {showFormatDropdown && (
              <div className="projects-format-dropdown">
                <div 
                  className={`projects-dropdown-item ${formatFilter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setFormatFilter('all')
                    setShowFormatDropdown(false)
                  }}
                >
                  All
                </div>
                <div 
                  className={`projects-dropdown-item ${formatFilter === 'landscape' ? 'active' : ''}`}
                  onClick={() => {
                    setFormatFilter('landscape')
                    setShowFormatDropdown(false)
                  }}
                >
                  Landscape
                </div>
                <div 
                  className={`projects-dropdown-item ${formatFilter === 'portrait' ? 'active' : ''}`}
                  onClick={() => {
                    setFormatFilter('portrait')
                    setShowFormatDropdown(false)
                  }}
                >
                  Portrait
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="projects-header-right">
          {!isGuest && (
            <button className="projects-new-button" onClick={onNewProject}>
              New Creative
            </button>
          )}
          <button 
            className="projects-signout-button" 
            onClick={async () => {
              if (isGuest) {
                // Для гостя просто вызываем выход без попытки signOut
                if (onSignOut) onSignOut()
              } else {
                try {
                  await signOut()
                  if (onSignOut) onSignOut()
                } catch (error) {
                  console.error('Sign out error:', error)
                }
              }
            }}
            title={isGuest ? "Exit guest mode" : "Sign Out"}
          >
            {isGuest ? "Exit" : "Sign Out"}
          </button>
        </div>
      </div>

      <div className="projects-content">

        <div className="projects-table">
          <div className="projects-table-header">
            <div 
              className={`projects-table-col projects-col-name ${sortBy === 'name' ? 'sort-active' : ''}`}
              onClick={() => handleSort('name')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Sort by name"
            >
              NAME {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div 
              className={`projects-table-col projects-col-status ${sortBy === 'status' ? 'sort-active' : ''}`}
              onClick={() => handleSort('status')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Sort by status"
            >
              STATUS {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div 
              className={`projects-table-col projects-col-format ${sortBy === 'format' ? 'sort-active' : ''}`}
              onClick={() => handleSort('format')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Sort by format"
            >
              FORMAT {sortBy === 'format' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div 
              className={`projects-table-col projects-col-orientation ${sortBy === 'orientation' ? 'sort-active' : ''}`}
              onClick={() => handleSort('orientation')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Sort by orientation"
            >
              ORIENTATION {sortBy === 'orientation' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            <div className="projects-table-col projects-col-actions">ACTIONS</div>
          </div>

          {sortedAndFilteredProjects.length === 0 ? (
            <div className="projects-empty">
              <p>
                {projects.length === 0 
                  ? 'No projects. Create a new project.' 
                  : searchQuery 
                    ? `No projects found for "${searchQuery}"`
                    : 'No projects with selected format.'}
              </p>
            </div>
          ) : (
            sortedAndFilteredProjects.map((project) => {
              // Проверяем, можно ли редактировать проект
              const isProjectActive = project.status === 'Active'
              const canEdit = !isGuest && (isAdminUser || !isProjectActive)
              
              return (
                <div key={project.id} className="projects-table-row">
                <div className="projects-table-col projects-col-name">
                  {editingProjectId === project.id && canEdit ? (
                    <input
                      type="text"
                      className="projects-edit-input"
                      value={project.name}
                      onChange={(e) => onUpdateProject(project.id, 'name', e.target.value)}
                      onBlur={() => onSetEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSetEditingId(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={`projects-name ${!canEdit ? 'projects-name-locked' : ''}`}
                      onClick={() => {
                        if (canEdit) {
                          onSetEditingId(project.id)
                        }
                      }}
                      title={isGuest ? 'Guests can only view projects' : (!canEdit ? 'Only admin can edit active projects' : 'Click to edit')}
                    >
                      {project.name}
                    </span>
                  )}
                </div>
                <div className="projects-table-col projects-col-status">
                  {editingStatusId === project.id && canEdit ? (
                    <select
                      className="projects-edit-select"
                      value={project.status}
                      onChange={(e) => {
                        onUpdateProject(project.id, 'status', e.target.value)
                        setEditingStatusId(null)
                      }}
                      onBlur={() => setEditingStatusId(null)}
                      autoFocus
                    >
                      {PROJECT_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`projects-status ${!canEdit ? 'projects-status-locked' : ''}`}
                      onClick={() => {
                        if (canEdit) {
                          setEditingStatusId(project.id)
                        }
                      }}
                      title={isGuest ? 'Guests can only view projects' : (!canEdit ? 'Only admin can edit active projects' : 'Click to edit')}
                    >
                      {project.status}
                    </span>
                  )}
                </div>
                <div className="projects-table-col projects-col-format">
                  {project.format}
                </div>
                <div className="projects-table-col projects-col-orientation">
                  <span className={`projects-orientation ${project.screenFormat === 'portrait' ? 'portrait' : 'landscape'}`}>
                    {project.screenFormat === 'portrait' ? 'Portrait' : 'Landscape'}
                  </span>
                </div>
                <div className="projects-table-col projects-col-actions">
                  <div className="projects-actions-group">
                    <button
                      className={`projects-action-button projects-action-preview ${(!project.images || project.images.length === 0) ? 'disabled' : ''}`}
                      onClick={() => {
                        if (project.images && project.images.length > 0) {
                          // Автоматически определяем формат на основе ориентации проекта
                          const format = project.screenFormat || 'landscape'
                          onProjectPreview(project, format)
                        }
                      }}
                      title={(!project.images || project.images.length === 0) ? 'No images for preview' : 'Preview'}
                      disabled={!project.images || project.images.length === 0}
                    >
                      👁️
                    </button>
                    <button
                      className={`projects-action-button projects-action-export ${(!project.images || project.images.length === 0) ? 'disabled' : ''}`}
                      onClick={() => {
                        if (project.images && project.images.length > 0) {
                          onProjectExport(project)
                        }
                      }}
                      title={(!project.images || project.images.length === 0) ? 'No images for export' : 'Export'}
                      disabled={!project.images || project.images.length === 0}
                    >
                      ⬇️
                    </button>
                    {!isGuest && (
                      <button
                        className={`projects-action-button ${!canEdit ? 'disabled' : ''}`}
                        onClick={() => {
                          if (canEdit) {
                            onEditProject(project)
                          }
                        }}
                        title={!canEdit ? 'Only admin can edit active projects' : 'Edit in Studio'}
                        disabled={!canEdit}
                      >
                        Edit
                      </button>
                    )}
                    {!isGuest && (() => {
                      const canDelete = project.status !== 'Active' || isAdminUser
                      return (
                        <button
                          className={`projects-action-button projects-action-delete ${!canDelete ? 'disabled' : ''}`}
                          onClick={() => {
                            if (canDelete) {
                              onDeleteProject(project.id)
                            } else {
                              alert('Only admin can delete active projects')
                            }
                          }}
                          title={!canDelete ? 'Only admin can delete active projects' : 'Delete Project'}
                          disabled={!canDelete}
                        >
                          🗑️
                        </button>
                      )
                    })()}
                  </div>
                </div>
              </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectsList

