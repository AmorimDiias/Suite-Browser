import React from 'react'
import { Profile } from '../interfaces/Profile'
import { Play, Shield } from 'lucide-react'

interface ProfileCardProps {
  profile: Profile
  onLaunch: (id: string) => void
}

const FLAG_MAP: Record<string, string> = {
  DE: '🇩🇪',
  US: '🇺🇸',
  FR: '🇫🇷',
  ES: '🇪🇸'
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onLaunch }) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-blue-500 transition-colors shadow-lg group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl filter drop-shadow-md">
            {FLAG_MAP[profile.country] || '🏳️'}
          </span>
          <div>
            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
              {profile.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono">ID: {profile.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-md border border-slate-700">
          <Shield size={12} className={profile.proxy ? 'text-green-400' : 'text-red-400'} />
          <span className="text-xs font-semibold text-slate-300">
            {profile.proxy ? 'PROXY' : 'DIRECT'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 text-sm">
        <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
          <span className="block text-slate-500 text-xs mb-0.5">Timezone</span>
          <span className="text-slate-300 font-mono">{profile.timezone}</span>
        </div>
        <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
          <span className="block text-slate-500 text-xs mb-0.5">Locale</span>
          <span className="text-slate-300 font-mono">{profile.locale}</span>
        </div>
      </div>

      <button
        onClick={() => onLaunch(profile.id)}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-blue-900/20 shadow-lg"
      >
        <Play size={18} fill="currentColor" />
        INICIAR PERFIL
      </button>
    </div>
  )
}
