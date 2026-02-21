import React, { memo, useState } from 'react'
import {
  LayoutDashboard,
  Globe,
  Cookie,
  Puzzle,
  Zap, // Automation
  Settings,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'

import logo from '../assets/logo.svg'

export const Sidebar = memo(function Sidebar(): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, active: true },
    { name: 'Proxy Manager', icon: Globe, active: false },
    { name: 'Cookies', icon: Cookie, active: false },
    { name: 'Extensões', icon: Puzzle, active: false },
    { name: 'Automação', icon: Zap, active: false },
    { name: 'Configurações', icon: Settings, active: false }
  ]

  return (
    <div className={`relative bg-white dark:bg-gray-950 flex flex-col border-r border-gray-200 dark:border-gray-800 flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isExpanded ? 'w-[260px]' : 'w-[80px]'}`}>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3.5 top-7 w-7 h-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-sm z-20 hover:scale-110 transition-all duration-200 focus:outline-none"
        aria-label="Toggle Sidebar"
      >
        {isExpanded ? <ChevronLeft size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />}
      </button>

      {/* Logo Area */}
      <div className={`h-20 flex flex-shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800 transition-all duration-300 ${isExpanded ? 'px-6' : 'px-0 justify-center'}`}>
        <div className={`flex items-center text-blue-600 dark:text-blue-500 ${isExpanded ? '' : 'justify-center w-full'}`}>
          <img src={logo} alt="Logo" className="w-8 h-8 flex-shrink-0" />
          <span className={`text-gray-900 dark:text-white font-bold text-xl tracking-tight font-sans whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}>
            Suite Browser
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {menuItems.map((item) => (
          <button
            key={item.name}
            title={!isExpanded ? item.name : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 group relative ${item.active
                ? 'bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
          >
            {/* Active Indicator Line */}
            {item.active && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-r-md" />
            )}

            <div className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isExpanded ? 'w-12 h-11' : 'w-14 h-14'}`}>
              <item.icon
                size={isExpanded ? 18 : 22}
                className={`transition-all duration-200 ${item.active
                    ? 'text-blue-600 dark:text-blue-500 select-none scale-105'
                    : 'group-hover:scale-105'
                  }`}
              />
            </div>
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-300 text-left ${isExpanded ? 'max-w-[200px] opacity-100 pr-4' : 'max-w-0 opacity-0 pr-0'
                }`}
            >
              {item.name}
            </span>
          </button>
        ))}
      </nav>

      {/* Footer / License */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className={`rounded-xl transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-gray-50 dark:bg-gray-900/50 p-3 border border-gray-100 dark:border-gray-700/50' : 'p-0 h-14 flex items-center justify-center bg-transparent border-transparent'}`}>
          {isExpanded ? (
            <div className="flex items-center justify-between whitespace-nowrap">
              <div>
                <div className="text-[10px] text-gray-400 font-bold mb-0.5 uppercase tracking-wider">Licença Atual</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 font-semibold">Premium Plan</div>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] mr-1"></div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform cursor-help" title="Premium Plan">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
)
