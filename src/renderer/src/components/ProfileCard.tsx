import { memo } from 'react'
import { Profile } from '../interfaces/Profile'
import { Play, Square, MoreVertical, Edit2, Trash2 } from 'lucide-react'
import { formatBytes } from '../utils/format'

export interface ProfileCardProps {
  profile: Profile
  isRunning: boolean
  onLaunch: (id: string) => void
  onStop: (id: string) => void
  onEdit: (profile: Profile) => void
  onDelete: (id: string) => void
  viewMode?: 'list' | 'grid' | 'square'
}

export const ProfileCard = memo(function ProfileCard({
  profile,
  isRunning,
  onLaunch,
  onStop,
  onEdit,
  onDelete,
  viewMode = 'grid'
}: ProfileCardProps) {
  // === LIST VIEW ===
  if (viewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 p-3 flex items-center gap-4 group">
        {/* Status Line */}
        <div
          className={`w-1 h-10 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
            }`}
        />

        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-lg overflow-hidden">
            {profile.avatar &&
              (profile.avatar.startsWith('http') || profile.avatar.startsWith('data:')) ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span>{profile.avatar || '👤'}</span>
            )}
          </div>
          {isRunning && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-800 animate-pulse" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-4">
            <h3 className="font-bold text-gray-900 dark:text-white truncate text-sm">
              {profile.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
              {profile.id}
            </p>
          </div>

          <div className="col-span-3 flex items-center gap-2">
            <img
              src={`https://flagcdn.com/w20/${profile.country.toLowerCase()}.png`}
              alt={profile.country}
              className="w-4 rounded-sm"
              loading="lazy"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
              {profile.country}
            </span>
          </div>

          <div className="col-span-3 text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
            {profile.proxy ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {profile.proxy.match(/@([\d.]+)/)?.[1] || profile.proxy}
              </span>
            ) : (
              <span className="text-gray-400 opacity-50">Direct</span>
            )}
          </div>

          <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400 truncate text-right">
            <span className="font-medium text-gray-900 dark:text-white">
              {formatBytes(profile.totalDataUsage || 0)}
            </span>
            <span className="text-gray-400 ml-1">used</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={() => onStop(profile.id)}
              className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              title="Parar"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => onLaunch(profile.id)}
              className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              title="Iniciar"
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => onEdit(profile)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => confirm('Tem certeza?') && onDelete(profile.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  // === SQUARE VIEW ===
  if (viewMode === 'square') {
    return (
      <div
        onClick={() => (isRunning ? onStop(profile.id) : onLaunch(profile.id))}
        className={`relative group rounded-xl border transition-all duration-200 p-4 flex flex-col items-center justify-center gap-3 cursor-pointer aspect-square ${isRunning
          ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-500 ring-1 ring-blue-500 shadow-md'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:-translate-y-1'
          }`}
      >
        {/* Menu Actions (Top Right) - Stop Propagation to prevent launch/stop when clicking menu */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(profile)}
              className="p-1.5 bg-white/90 dark:bg-gray-700/90 rounded-full text-gray-600 dark:text-gray-300 hover:text-blue-500 shadow-sm backdrop-blur-sm"
              title="Editar"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => confirm('Apagar?') && onDelete(profile.id)}
              className="p-1.5 bg-white/90 dark:bg-gray-700/90 rounded-full text-gray-600 dark:text-gray-300 hover:text-red-500 shadow-sm backdrop-blur-sm"
              title="Excluir"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Avatar */}
        <div className="relative pointer-events-none">
          <div
            className={`w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 border-2 shadow-sm flex items-center justify-center text-2xl overflow-hidden transition-all ${isRunning
              ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105'
              : 'border-white dark:border-gray-600 group-hover:scale-105'
              }`}
          >
            {profile.avatar &&
              (profile.avatar.startsWith('http') || profile.avatar.startsWith('data:')) ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span>{profile.avatar || '👤'}</span>
            )}
          </div>

          {/* Status Badge */}
          {isRunning && (
            <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white dark:border-gray-900 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              ON
            </div>
          )}

          {/* Country Flag Badge (Only if not running, to avoid clutter) */}
          {!isRunning && (
            <div className="absolute -top-1 -right-1 shadow-md rounded-full overflow-hidden w-5 h-5 border-2 border-white dark:border-gray-800">
              <img
                src={`https://flagcdn.com/w40/${profile.country.toLowerCase()}.png`}
                alt={profile.country}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-center w-full pointer-events-none">
          <h3
            className={`font-bold truncate text-sm px-2 ${isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}
          >
            {profile.name}
          </h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono truncate px-4">
            {profile.id.substring(0, 8)}
          </p>

          {isRunning && (
            <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium animate-pulse">
              Em execução...
            </p>
          )}
        </div>
      </div>
    )
  }

  // === GRID VIEW (DEFAULT RECTANGULAR) ===
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 p-5 flex flex-col md:flex-row gap-6 group relative overflow-hidden h-full">
      {/* Active Status Border/Indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${isRunning
          ? 'bg-green-500'
          : 'bg-transparent group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
          } transition-colors`}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Header: Avatar & Name */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-2xl overflow-hidden shadow-sm">
              {profile.avatar &&
                (profile.avatar.startsWith('http') || profile.avatar.startsWith('data:')) ? (
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span>{profile.avatar || '👤'}</span>
              )}
            </div>
            {isRunning && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-gray-800 animate-pulse" />
            )}
          </div>

          <div className="overflow-hidden">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {profile.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">
              {profile.id.substring(0, 12)}
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-2 mt-1">
          {/* Country */}
          <div className="flex items-center gap-2">
            <img
              src={`https://flagcdn.com/w20/${profile.country.toLowerCase()}.png`}
              srcSet={`https://flagcdn.com/w40/${profile.country.toLowerCase()}.png 2x`}
              alt={profile.country}
              className="rounded-sm shadow-sm w-5"
              loading="lazy"
              onError={(e) => {
                ; (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">
              {profile.country}
            </span>
          </div>

          {/* Proxy */}
          <div className="text-sm">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Proxy</p>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${profile.proxy ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              />
              <span className="font-medium text-gray-700 dark:text-gray-200 font-mono truncate max-w-[200px]">
                {profile.proxy ? profile.proxy.match(/@([\d.]+)/)?.[1] || profile.proxy : '----'}
              </span>
              {profile.proxy && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  - Ativo | Alta Velocidade
                </span>
              )}
            </div>
          </div>

          {/* Last Used */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Last utilized:{' '}
            {profile.lastUsed ? new Date(profile.lastUsed).toLocaleString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Action Buttons Column */}
      <div className="flex flex-col gap-2.5 justify-center md:w-32 flex-shrink-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 md:pl-5">
        {/* Primary Action */}
        {isRunning ? (
          <button
            onClick={() => onStop(profile.id)}
            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-[0.98] text-sm"
          >
            <Square size={14} fill="currentColor" />
            PARAR
          </button>
        ) : (
          <button
            onClick={() => onLaunch(profile.id)}
            className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-green-600/20 active:scale-[0.98] text-sm"
          >
            <Play size={14} fill="currentColor" />
            INICIAR
          </button>
        )}

        {/* Secondary Actions */}
        <button
          onClick={() => onEdit(profile)}
          className="w-full py-2 bg-white dark:bg-gray-800 border-2 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 transition-all text-sm uppercase tracking-wide"
        >
          <Edit2 size={14} />
          EDITAR
        </button>

        <button
          onClick={() => {
            if (confirm('Tem certeza?')) onDelete(profile.id)
          }}
          className="w-full py-2 bg-white dark:bg-gray-800 border-2 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 transition-all text-sm uppercase tracking-wide"
        >
          <Trash2 size={14} />
          EXCLUIR
        </button>

        {/* Three dots menu - optional, keeping for completeness if user wants more options later */}
        <div className="absolute top-3 right-3 md:hidden">
          <MoreVertical size={18} className="text-gray-400" />
        </div>
      </div>
    </div>
  )
})
