import { Search, Plus } from 'lucide-react'

import logo from '../assets/logo.svg'

interface HeaderProps {
  onSearch: (value: string) => void
  onCreate: () => void
}

export function Header({ onSearch, onCreate }: HeaderProps) {
  return (
    <div className="h-16 border-b border-gray-700 bg-gray-900 px-6 flex items-center justify-between">
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Suite Browser" className="w-8 h-8" />
          <h1 className="text-xl font-semibold text-white tracking-tight">Suite Browser</h1>
        </div>
        <div className="h-6 w-px bg-gray-800" />
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Pesquisar perfis..."
            className="bg-gray-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder:text-gray-500 w-64 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={onCreate}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Novo Perfil
      </button>
    </div>
  )
}
