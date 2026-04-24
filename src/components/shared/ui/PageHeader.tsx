import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, Bell, BellRing, LogOut, Search } from 'lucide-react'
import Logo from './Logo'
import RoleBadge from './RoleBadge'

interface HeaderIdentity {
  name?: string
  email?: string
  role?: string | null
  roleLabel?: string | null
}

export interface HeaderSearchResult {
  id: string
  type: 'project' | 'member'
  title: string
  description?: string
  meta?: string
}

export interface HeaderNotification {
  id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  projectId?: string | null
}

interface PageHeaderProps {
  eyebrow?: string
  title?: string
  description?: string
  backLabel?: string
  onBack?: () => void
  identity?: HeaderIdentity | null
  onSignOut?: () => void | Promise<void>
  signOutLabel?: string
  workspaceSwitcher?: ReactNode
  actions?: ReactNode
  searchPlaceholder?: string | null
  searchValue?: string
  searchResults?: HeaderSearchResult[]
  onSearchChange?: (value: string) => void
  onSearchResultSelect?: (result: HeaderSearchResult) => void
  notifications?: HeaderNotification[]
  unreadNotificationCount?: number
  onNotificationSelect?: (notification: HeaderNotification) => void
  onMarkAllNotificationsRead?: () => void
  onClearNotifications?: () => void
  onIdentityClick?: () => void
  onLogoClick?: () => void
}

const getInitials = (name?: string) => {
  const segments = String(name || 'Workspace User')
    .split(' ')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments.slice(0, 2).map((segment) => segment[0]).join('').toUpperCase()
}

const PageHeader = ({
  eyebrow,
  title,
  description,
  backLabel = 'Go back',
  onBack,
  identity,
  onSignOut,
  signOutLabel = 'Sign out',
  workspaceSwitcher,
  actions,
  searchPlaceholder = 'Jump to project, member, scene...',
  searchValue = '',
  searchResults = [],
  onSearchChange,
  onSearchResultSelect,
  notifications = [],
  unreadNotificationCount = 0,
  onNotificationSelect,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onIdentityClick,
  onLogoClick
}: PageHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const identityName = identity?.name || 'Workspace user'
  const identityDetail =
    identity?.email && identity.email.trim().toLowerCase() !== identityName.trim().toLowerCase()
      ? identity.email
      : null
  const normalizedSearchValue = searchValue.trim()
  const shouldShowSearchResults = Boolean(
    isSearchOpen &&
    normalizedSearchValue &&
    onSearchResultSelect
  )
  const hasUnreadNotifications = unreadNotificationCount > 0
  const NotificationIcon = hasUnreadNotifications ? BellRing : Bell

  useEffect(() => {
    setActiveSearchIndex(0)
  }, [searchValue, searchResults.length])

  const handleSearchResultSelect = (result: HeaderSearchResult) => {
    try {
      onSearchResultSelect?.(result)
      onSearchChange?.('')
      setIsSearchOpen(false)
    } catch (error) {
      console.error('Failed to select the header search result:', error)
    }
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    try {
      if (!shouldShowSearchResults) {
        return
      }

      if (event.key === 'Escape') {
        setIsSearchOpen(false)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveSearchIndex((previousIndex) =>
          searchResults.length === 0 ? 0 : Math.min(previousIndex + 1, searchResults.length - 1)
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveSearchIndex((previousIndex) => Math.max(previousIndex - 1, 0))
        return
      }

      if (event.key === 'Enter' && searchResults[activeSearchIndex]) {
        event.preventDefault()
        handleSearchResultSelect(searchResults[activeSearchIndex])
      }
    } catch (error) {
      console.error('Failed to handle the header search keyboard action:', error)
    }
  }

  const formatNotificationTime = (value: string) => {
    try {
      const timestamp = new Date(value).getTime()

      if (Number.isNaN(timestamp)) {
        return 'Recently'
      }

      const elapsedMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000))

      if (elapsedMinutes < 60) {
        return `${elapsedMinutes}m ago`
      }

      const elapsedHours = Math.floor(elapsedMinutes / 60)

      if (elapsedHours < 24) {
        return `${elapsedHours}h ago`
      }

      return `${Math.floor(elapsedHours / 24)}d ago`
    } catch (error) {
      console.error('Failed to format notification time:', error)
      return 'Recently'
    }
  }

  return (
    <header className="ui-page-header">
      <div className="ui-page-header__shell">
        <div className="ui-page-header__bar">
          <div className="ui-page-header__left">
            <Logo size="sm" onClick={onLogoClick} ariaLabel="Open projects page" />
          </div>

          <div className="ui-page-header__center">
            {searchPlaceholder && (
              <div className="ui-page-header__search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(event) => {
                    onSearchChange?.(event.target.value)
                    setIsSearchOpen(true)
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onBlur={() => setIsSearchOpen(false)}
                  onKeyDown={handleSearchKeyDown}
                  aria-autocomplete={onSearchResultSelect ? 'list' : undefined}
                  aria-expanded={shouldShowSearchResults}
                />
                {shouldShowSearchResults && (
                  <div className="ui-page-header__search-results" role="listbox">
                    {searchResults.length === 0 ? (
                      <div className="ui-page-header__search-empty">No matching projects or members.</div>
                    ) : (
                      searchResults.map((result, index) => (
                        <button
                          key={result.id}
                          type="button"
                          className={`ui-page-header__search-result ${index === activeSearchIndex ? 'active' : ''}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSearchResultSelect(result)}
                          role="option"
                          aria-selected={index === activeSearchIndex}
                        >
                          <span className={`ui-page-header__search-result-type ${result.type}`}>
                            {result.type === 'project' ? 'Project' : 'Member'}
                          </span>
                          <span className="ui-page-header__search-result-copy">
                            <span className="ui-page-header__search-result-title">{result.title}</span>
                            {result.description && (
                              <span className="ui-page-header__search-result-description">{result.description}</span>
                            )}
                          </span>
                          {result.meta && <span className="ui-page-header__search-result-meta">{result.meta}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ui-page-header__right">
            <div className="ui-page-header__notifications">
              <button
                type="button"
                className={`ui-page-header__icon-button ${hasUnreadNotifications ? 'has-notifications' : ''}`}
                aria-label={hasUnreadNotifications ? `${unreadNotificationCount} unread notifications` : 'No new notifications'}
                aria-expanded={isNotificationsOpen}
                onClick={() => setIsNotificationsOpen((isOpen) => !isOpen)}
              >
                <NotificationIcon size={16} />
                {hasUnreadNotifications && <span className="ui-page-header__icon-dot" />}
              </button>

              {isNotificationsOpen && (
                <div className="ui-page-header__notifications-menu">
                  <div className="ui-page-header__notifications-head">
                    <div className="ui-page-header__notifications-title">Notifications</div>
                    {hasUnreadNotifications && (
                      <div className="ui-page-header__notifications-count active">
                        {unreadNotificationCount} new
                      </div>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="ui-page-header__notifications-empty">
                      No notifications
                    </div>
                  ) : (
                    <div className="ui-page-header__notifications-list">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className={`ui-page-header__notification ${notification.isRead ? '' : 'unread'}`}
                          onClick={() => {
                            onNotificationSelect?.(notification)
                            setIsNotificationsOpen(false)
                          }}
                        >
                          <span className="ui-page-header__notification-state" />
                          <span className="ui-page-header__notification-copy">
                            <span className="ui-page-header__notification-title">
                              {notification.body || notification.title}
                            </span>
                            <span className="ui-page-header__notification-time">
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="ui-page-header__notifications-footer">
                    <button
                      type="button"
                      className="ui-page-header__notifications-read-all"
                      onClick={onMarkAllNotificationsRead}
                      disabled={!onMarkAllNotificationsRead || notifications.length === 0 || !hasUnreadNotifications}
                    >
                      Mark all as read
                    </button>
                    <button
                      type="button"
                      className="ui-page-header__notifications-clear-all"
                      onClick={onClearNotifications}
                      disabled={!onClearNotifications || notifications.length === 0}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </div>
            {workspaceSwitcher}
            {identity && (
              onIdentityClick ? (
                <button
                  type="button"
                  className="ui-page-header__identity ui-page-header__identity-button"
                  onClick={onIdentityClick}
                  aria-label="Open your profile"
                  title="Open your profile"
                >
                  <div className="ui-page-header__identity-copy">
                    <div className="ui-page-header__identity-name">{identityName}</div>
                    {identityDetail && <div className="ui-page-header__identity-email">{identityDetail}</div>}
                  </div>
                  {(identity.role || identity.roleLabel) && (
                    <RoleBadge role={identity.role} label={identity.roleLabel || undefined} size="sm" />
                  )}
                  <div className="ui-avatar ui-avatar--sm">{getInitials(identity.name)}</div>
                </button>
              ) : (
                <div className="ui-page-header__identity">
                  <div className="ui-page-header__identity-copy">
                    <div className="ui-page-header__identity-name">{identityName}</div>
                    {identityDetail && <div className="ui-page-header__identity-email">{identityDetail}</div>}
                  </div>
                  {(identity.role || identity.roleLabel) && (
                    <RoleBadge role={identity.role} label={identity.roleLabel || undefined} size="sm" />
                  )}
                  <div className="ui-avatar ui-avatar--sm">{getInitials(identity.name)}</div>
                </div>
              )
            )}
            {actions}
            {(onBack || onSignOut) && (
              <div className="ui-page-header__nav-actions">
                {onBack && (
                  <button
                    type="button"
                    className="ui-page-header__back-action"
                    onClick={onBack}
                    aria-label={backLabel}
                    title={backLabel}
                  >
                    <ArrowLeft size={14} />
                    {backLabel}
                  </button>
                )}
                {onSignOut && (
                  <button type="button" className="ui-page-header__signout" onClick={onSignOut}>
                    <LogOut size={14} />
                    {signOutLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {(title || description || eyebrow) && (
          <div className="ui-page-header__title-region">
            <div className="ui-page-header__title-block">
              {eyebrow && <div className="app-eyebrow">{eyebrow}</div>}
              {title && <h1 className="ui-page-header__title text-gradient-cool">{title}</h1>}
              {description && <p className="ui-page-header__description">{description}</p>}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default PageHeader
