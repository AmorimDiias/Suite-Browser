import { Profile } from '../interfaces/Profile'
import { Play, MoreVertical, Square } from 'lucide-react'

interface ProfileTableProps {
  profiles: Profile[]
  runningProfiles?: Set<string>
  onLaunch: (id: string) => void
  onStop: (id: string) => void
  onEdit: (profile: Profile) => void
  onDelete: (id: string) => void
}

export function ProfileTable({
  profiles,
  runningProfiles = new Set(),
  onLaunch,
  onStop,
  onEdit,
  onDelete
}: ProfileTableProps): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-900 sticky top-0 z-10">
          <tr>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Perfil
            </th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              País
            </th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Proxy
            </th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">
              Último Uso
            </th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right sticky right-0 bg-gray-900 z-20 shadow-[-10px_0_20px_-5px_rgba(0,0,0,0.5)]">
              Ação
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {profiles.map((profile) => {
            const isRunning = runningProfiles.has(profile.id)
            return (
              <tr key={profile.id} className="group hover:bg-gray-800/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-lg overflow-hidden border border-gray-600 shrink-0">
                      {profile.avatar &&
                        (profile.avatar.startsWith('http') ||
                          profile.avatar.startsWith('data:')) ? (
                        <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{profile.avatar ? profile.avatar : '👤'}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-200">{profile.name}</div>
                      <div className="text-xs text-gray-500 font-mono truncate max-w-[100px]">
                        {profile.id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2" title={profile.country}>
                    <img
                      src={`https://flagcdn.com/w40/${profile.country.toLowerCase()}.png`}
                      srcSet={`https://flagcdn.com/w80/${profile.country.toLowerCase()}.png 2x`}
                      width="24"
                      height="18"
                      alt={profile.country}
                      className="rounded-sm shadow-sm"
                    />
                    <span className="text-sm text-gray-400">{profile.country}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${profile.proxy ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    <span className="text-sm text-gray-400 font-mono truncate max-w-[150px] block">
                      {profile.proxy
                        ? // Extract IP from proxy string for display
                        profile.proxy.match(/@([\d.]+)/)?.[1] || 'Proxy Configurado'
                        : 'Direct'}
                    </span>
                  </div>
                </td>
                <td className="p-4 hidden xl:table-cell">
                  <span className="text-sm text-gray-500">
                    {profile.lastUsed
                      ? new Date(profile.lastUsed).toLocaleDateString()
                      : 'Nunca'}
                  </span>
                </td>
                <td className="p-4 text-right sticky right-0 bg-gray-950 group-hover:bg-gray-900 transition-colors z-10 shadow-[-10px_0_20px_-5px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-end gap-2">
                    {isRunning ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onStop(profile.id)
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-1.5 px-4 rounded-full flex items-center gap-1 shadow-lg shadow-red-900/20 active:scale-95 transition-all"
                      >
                        <Square size={12} fill="currentColor" /> PARAR
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onLaunch(profile.id)
                        }}
                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 px-4 rounded-full flex items-center gap-1 shadow-lg shadow-green-900/20 active:scale-95 transition-all"
                      >
                        <Play size={12} fill="currentColor" /> INICIAR
                      </button>
                    )}

                    <div className="relative group/menu">
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                        <MoreVertical size={16} />
                      </button>
                      {/* Dropdown would go here, simplified for now */}
                      <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded shadow-xl py-1 w-32 hidden group-focus-within/menu:block group-hover/menu:block z-50">
                        <button
                          onClick={() => onEdit(profile)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm('Tem certeza? Isso deletará os dados do navegador também.')
                            ) {
                              onDelete(profile.id)
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                        >
                          Deletar
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
