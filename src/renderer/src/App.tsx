import React, { useEffect, useState } from 'react'
import { Profile } from './interfaces/Profile'
import { Layout } from './components/Layout'
import { Header } from './components/Header'
import { ProfileGrid } from './components/ProfileGrid'
import { StatsGrid } from './components/StatsGrid'
import { ProfileModal } from './components/ProfileModal'
import { Loader2 } from 'lucide-react'

function App(): React.ReactElement {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'square'>(() => {
    const savedMode = localStorage.getItem('viewMode') as 'list' | 'grid' | 'square'
    return savedMode || 'grid'
  })

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>(undefined)

  // Running Profiles State
  const [runningProfiles, setRunningProfiles] = useState<Set<string>>(new Set())

  // Fetch Profiles
  const fetchProfiles = async (): Promise<void> => {
    try {
      setLoading(true)
      // @ts-ignore: window.electron is not typed in global scope yet
      const data = await window.electron.ipcRenderer.invoke('get-profiles')
      setProfiles(data)
    } catch (error) {
      console.error('Failed to load profiles', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  // Check Proxy Health Periodic
  useEffect(() => {
    const checkProxies = async () => {
      // Get IDs of profiles with proxies that need checking (or check all periodically)
      // To avoid spamming, we can check 1 by 1 or in batches.
      // For now, let's just trigger a check for all profiles that have proxies
      // and haven't been checked recently? 
      // Simplest for "dashboard" feel: Check all on load and then every 5 mins.

      const profilesWithProxy = profiles.filter(p => !!p.proxy)

      for (const p of profilesWithProxy) {
        if (p.proxyStatus === 'checking') continue // already checking

        // Optimistic update locally? No, wait for result.
        // @ts-ignore
        window.electron.ipcRenderer.invoke('check-proxy-health', p.id).then(status => {
          setProfiles(prev => prev.map(prof => prof.id === p.id ? { ...prof, proxyStatus: status } : prof))
        })
      }
    }

    // Check initially after profiles are loaded (and if they have 'unknown' status or just always)
    if (profiles.length > 0) {
      // Debounce slightly to not compete with initial render
      const timer = setTimeout(() => {
        checkProxies()
      }, 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [profiles.length]) // Trigger when profiles list changes (loaded)

  // Listen for unexpected profile stops (user closing Chrome manually)
  useEffect(() => {
    // @ts-ignore: window.api is not typed in global scope yet
    const unsubscribe = window.api.onProfileStopped((profileId: string) => {
      console.log('Profile stopped unexpectedly:', profileId)
      setRunningProfiles((prev) => {
        const next = new Set(prev)
        next.delete(profileId)
        return next
      })
    })

    return () => unsubscribe()
  }, [])

  // Handlers
  const handleLaunch = (id: string): void => {
    // @ts-ignore: window.electron is not typed in global scope yet
    window.electron.ipcRenderer.send('launch-profile', id)
    setRunningProfiles((prev) => new Set(prev).add(id))
  }

  const handleStop = (id: string): void => {
    // @ts-ignore: window.electron is not typed in global scope yet
    window.electron.ipcRenderer.send('stop-profile', id)
    setRunningProfiles((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleCreate = (): void => {
    setEditingProfile(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (profile: Profile): void => {
    setEditingProfile(profile)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      // @ts-ignore: window.electron is not typed in global scope yet
      await window.electron.ipcRenderer.invoke('delete-profile', id)
      await fetchProfiles() // Refresh
    } catch (error) {
      console.error('Failed to delete', error)
    }
  }

  const handleSave = async (data: Partial<Profile>): Promise<void> => {
    try {
      if (editingProfile) {
        // Update
        // @ts-ignore: window.electron is not typed in global scope yet
        await window.electron.ipcRenderer.invoke('update-profile', { id: editingProfile.id, data })
      } else {
        // Create
        // @ts-ignore: window.electron is not typed in global scope yet
        await window.electron.ipcRenderer.invoke('create-profile', data)
      }
      setIsModalOpen(false)
      fetchProfiles()
    } catch (error) {
      console.error('Failed to save', error)
    }
  }

  // Filter
  const filteredProfiles = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalUsage = profiles.reduce((acc, curr) => acc + (curr.totalDataUsage || 0), 0)

  // Proxy Stats
  const proxyProfiles = profiles.filter((p) => !!p.proxy)
  const proxyTotalCount = proxyProfiles.length
  const proxyHealthyCount = proxyProfiles.filter((p) => p.proxyStatus === 'online').length

  return (
    <Layout>
      <Header
        onSearch={setSearchTerm}
        onCreate={handleCreate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="p-8 overflow-y-auto h-full">
        <StatsGrid
          activeCount={runningProfiles.size}
          totalCount={profiles.length}
          totalUsage={totalUsage}
          proxyHealthyCount={proxyHealthyCount}
          proxyTotalCount={proxyTotalCount}
        />

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
          </div>
        ) : (
          <ProfileGrid
            profiles={filteredProfiles}
            runningProfiles={runningProfiles}
            viewMode={viewMode}
            onLaunch={handleLaunch}
            onStop={handleStop}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <ProfileModal
        key={editingProfile ? editingProfile.id : 'new'}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingProfile}
      />
    </Layout>
  )
}

export default App
