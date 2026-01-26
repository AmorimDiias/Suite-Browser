import React, { memo } from 'react'
import {
  LayoutDashboard,
  Globe,
  Cookie,
  Puzzle,
  Zap, // Automation
  Settings
} from 'lucide-react'

import logo from '../assets/logo.svg'

export const Sidebar = memo(function Sidebar(): React.ReactElement {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, active: true },
    { name: 'Proxy Manager', icon: Globe, active: false },
    { name: 'Cookies', icon: Cookie, active: false },
    { name: 'Extensões', icon: Puzzle, active: false },
    { name: 'Automação', icon: Zap, active: false },
    { name: 'Configurações', icon: Settings, active: false }
  ]

  return (
    <div className="w-64 bg-white dark:bg-gray-950 flex flex-col border-r border-gray-200 dark:border-gray-800 flex-shrink-0 transition-colors duration-200">
      <div className="h-20 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-500">
          <img src={logo} alt="Logo" className="w-8 h-8" />
          <span className="text-gray-900 dark:text-white font-bold text-xl tracking-tight font-sans">
            Suite Browser
          </span>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.name}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${item.active
                ? 'bg-gray-100 dark:bg-blue-600/10 text-gray-900 dark:text-blue-400 border border-gray-200 dark:border-transparent'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
          >
            <item.icon
              size={18}
              className={`transition-colors ${item.active
                  ? 'text-gray-900 dark:text-blue-400'
                  : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                }`}
            />
            {item.name}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
          <div className="text-xs text-gray-500 font-medium mb-1 uppercase">Sua Licença</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300 font-medium">Premium Plan</span>
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
          </div>
        </div>
      </div>
    </div>
  )
})
