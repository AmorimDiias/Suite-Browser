import { Search, Plus, Moon, Sun, List, LayoutList, LayoutGrid } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import React, { useState, useEffect } from 'react'

interface HeaderProps {
  onSearch: (value: string) => void
  onCreate: () => void
  viewMode: 'list' | 'grid' | 'square'
  onViewModeChange: (mode: 'list' | 'grid' | 'square') => void
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  onCreate,
  viewMode,
  onViewModeChange
}) => {
  const { theme, toggleTheme } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      onSearch(searchTerm)
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, onSearch])

  return (
    <header className="h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 flex-shrink-0 z-10 shadow-sm relative transition-colors duration-200">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg leading-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm shadow-sm"
          placeholder="Pesquisar perfis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 ml-4">
        {/* View Mode Toggle */}
        <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-all ${viewMode === 'list'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            title="Lista"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-md transition-all ${viewMode === 'grid'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            title="Cards Retangulares"
          >
            <LayoutList size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('square')}
            className={`p-2 rounded-md transition-all ${viewMode === 'square'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            title="Cards Quadrados"
          >
            <LayoutGrid size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98] text-sm font-bold ml-2"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Novo Perfil</span>
        </button>
      </div>
    </header>
  )
}
