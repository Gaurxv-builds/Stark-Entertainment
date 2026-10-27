import { useSyncExternalStore } from 'react'
import { cell } from './library'

/** Local and cloud-synced profile information. */
export interface Profile {
  name: string
  username?: string | null
  email?: string | null
  avatar: string | null
  banner: string | null
  frame: string | null
}

export const emptyProfile: Profile = {
  name: '',
  username: null,
  email: null,
  avatar: null,
  banner: null,
  frame: null,
}

const store = cell<Profile>('zk:profile', emptyProfile)

export const useProfile = () => useSyncExternalStore(store.subscribe, store.get)
export const getProfile = () => store.get()
export const saveProfile = (p: Partial<Profile>) => store.set({ ...store.get(), ...p })
export const resetProfile = () => store.set(emptyProfile)

/** Crop-to-fill resize of an uploaded image into a compressed data: url, so it fits in localStorage. */
export async function readImage(file: File, w: number, h: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  if (file.size > 12 * 1048576) throw new Error('Image is too large (12 MB max).')
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read that image.')
  })
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const k = Math.max(w / bmp.width, h / bmp.height)
  const dw = bmp.width * k
  const dh = bmp.height * k
  c.getContext('2d')!.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh)
  bmp.close()
  return c.toDataURL('image/jpeg', 0.85)
}
