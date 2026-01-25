import React, { useEffect, useState } from 'react'
import { Profile } from './interfaces/Profile'
import { Layout } from './components/Layout'
import { Header } from './components/Header'
import { ProfileTable } from './components/ProfileTable'
import { ProfileModal } from './components/ProfileModal'
import { Loader2 } from 'lucide-react'

function App(): React.ReactElement {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

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

  return (
    <Layout>
      <Header onSearch={setSearchTerm} onCreate={handleCreate} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
        </div>
      ) : (
        <ProfileTable
          profiles={filteredProfiles}
          runningProfiles={runningProfiles}
          onLaunch={handleLaunch}
          onStop={handleStop}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

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
