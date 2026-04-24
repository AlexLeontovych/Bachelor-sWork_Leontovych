import type { LucideIcon } from 'lucide-react'

interface TabBarItem {
  id: string
  label: string
  icon?: LucideIcon
}

interface TabBarProps {
  items: TabBarItem[]
  active: string
  onChange: (tabId: string) => void
}

const TabBar = ({ items, active, onChange }: TabBarProps) => {
  return (
    <div className="ui-tab-bar">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.id === active

        return (
          <button
            key={item.id}
            type="button"
            className={`ui-tab-bar__button ${isActive ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {Icon && <Icon size={14} />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default TabBar
