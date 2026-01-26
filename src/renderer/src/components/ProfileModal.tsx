import React, { useState, useCallback } from 'react'
import { Profile } from '../interfaces/Profile'
import { X, Upload, Image as ImageIcon } from 'lucide-react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../utils/canvasUtils'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Profile>) => void
  initialData?: Profile
}

const COUNTRIES = [
  { code: 'DE', name: 'Alemanha', icon: '🇩🇪', timezone: 'Europe/Berlin', locale: 'de-DE' },
  { code: 'US', name: 'Estados Unidos', icon: '🇺🇸', timezone: 'America/New_York', locale: 'en-US' },
  { code: 'FR', name: 'França', icon: '🇫🇷', timezone: 'Europe/Paris', locale: 'fr-FR' },
  { code: 'ES', name: 'Espanha', icon: '🇪🇸', timezone: 'Europe/Madrid', locale: 'es-ES' },
  { code: 'BR', name: 'Brasil', icon: '🇧🇷', timezone: 'America/Sao_Paulo', locale: 'pt-BR' }
]

export function ProfileModal({
  isOpen,
  onClose,
  onSave,
  initialData
}: ProfileModalProps): React.ReactElement | null {
  const [formData, setFormData] = useState<Partial<Profile>>(
    initialData || {
      name: '',
      country: 'DE',
      proxy: '',
      avatar: '',
      timezone: 'Europe/Berlin',
      locale: 'de-DE'
    }
  )

  // Image Crop State
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const countryCode = e.target.value
    const countryData = COUNTRIES.find((c) => c.code === countryCode)
    if (countryData) {
      setFormData((prev) => ({
        ...prev,
        country: countryCode,
        timezone: countryData.timezone,
        locale: countryData.locale
      }))
    }
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const imageDataUrl = await readFile(file)
      setImageSrc(imageDataUrl as string)
      setIsCropping(true)
    }
  }

  const readFile = (file: File): Promise<string | ArrayBuffer | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(reader.result), false)
      reader.readAsDataURL(file)
    })
  }

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropSave = async (): Promise<void> => {
    if (imageSrc && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels)
        if (croppedImage) {
          setFormData((prev) => ({ ...prev, avatar: croppedImage }))
          setIsCropping(false)
          setImageSrc(null)
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {initialData ? 'Editar Perfil' : 'Novo Perfil'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Cropper UI Override */}
          {isCropping && imageSrc ? (
            <div className="relative h-64 w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shadow-inner">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 flex gap-2">
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer range-sm"
                />
              </div>
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => setIsCropping(false)}
                  className="bg-white/90 p-1.5 rounded-full hover:bg-white text-gray-700 shadow-sm"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 group-hover:border-blue-500 transition-all shadow-sm">
                  {formData.avatar && formData.avatar.startsWith('data:') ? (
                    <img
                      src={formData.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : formData.avatar && formData.avatar.startsWith('http') ? (
                    <img
                      src={formData.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-gray-400 dark:text-gray-500">
                      {formData.avatar || <ImageIcon size={32} />}
                    </span>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                  <Upload size={20} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </label>
              </div>
              {isCropping && (
                <button
                  onClick={handleCropSave}
                  className="text-xs bg-blue-600 px-3 py-1 rounded text-white shadow-sm"
                >
                  Salvar Recorte
                </button>
              )}
            </div>
          )}

          {isCropping && (
            <div className="flex justify-end">
              <button
                onClick={handleCropSave}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20"
              >
                Confirmar Recorte
              </button>
            </div>
          )}

          {!isCropping && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Nome do Perfil
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                  placeholder="Ex: Canal Dark 01"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                    País / Região
                  </label>
                  <select
                    value={formData.country}
                    onChange={handleCountryChange}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm appearance-none"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                    Avatar (Emoji/URL)
                  </label>
                  <input
                    type="text"
                    value={formData.avatar}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                    placeholder="🤖, http://... ou Upload"
                  />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Clique na imagem acima para enviar um arquivo
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Proxy{' '}
                  <span className="text-gray-500 dark:text-gray-400 font-normal normal-case">
                    (http://user:pass@ip:port)
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.proxy}
                  onChange={(e) => setFormData({ ...formData, proxy: e.target.value })}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                  placeholder="http://user:pass@192.168.1.1:8080"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="block mb-1 font-medium text-gray-500 dark:text-gray-500">
                    Timezone Detectado:
                  </span>
                  <code className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 font-bold">
                    {formData.timezone}
                  </code>
                </div>
                <div>
                  <span className="block mb-1 font-medium text-gray-500 dark:text-gray-500">
                    Locale Detectado:
                  </span>
                  <code className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 font-bold">
                    {formData.locale}
                  </code>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  User Agent (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.userAgent || ''}
                  onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
                  placeholder="Mozilla/5.0..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Notas
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none h-20 resize-none shadow-sm"
                  placeholder="Informações adicionais sobre o canal..."
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 rounded-b-xl border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          {!isCropping && (
            <button
              onClick={() => onSave(formData)}
              disabled={!formData.name}
              className="px-6 py-2.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Salvar Perfil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
