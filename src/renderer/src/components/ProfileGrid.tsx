import React from 'react'
import { Profile } from '../interfaces/Profile'
import { ProfileCard } from './ProfileCard'

interface ProfileGridProps {
  profiles: Profile[]
  runningProfiles: Set<string>
  onLaunch: (id: string) => void
  onStop: (id: string) => void
  onEdit: (profile: Profile) => void
  onDelete: (id: string) => void
  viewMode: 'list' | 'grid' | 'square'
}

export function ProfileGrid({
  profiles,
  runningProfiles,
  onLaunch,
  onStop,
  onEdit,
  onDelete,
  viewMode
}: ProfileGridProps): React.ReactElement {
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <p className="text-lg font-medium">Nenhum perfil encontrado</p>
        <p className="text-sm">Crie um novo perfil para começar</p>
      </div>
    )
  }

  const getGridClasses = (): string => {
    switch (viewMode) {
      case 'list':
        return 'grid-cols-1'
      case 'grid':
        return 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3'
      case 'square':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
      default:
        return 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3'
    }
  }

  return (
    <div className={`grid ${getGridClasses()} gap-4 p-1 pb-20 fade-in`}>
      {profiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          isRunning={runningProfiles.has(profile.id)}
          onLaunch={onLaunch}
          onStop={onStop}
          onEdit={onEdit}
          onDelete={onDelete}
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}
