// Where recordings live. OPFS when the browser can stream into it (chunks go
// straight to disk, not RAM); otherwise the chunks are kept and saved as one
// Blob in IndexedDB at the end (Safari).

import { deleteVideoBlob, getVideoBlob, putVideoBlob, type VideoRef } from '../store/db.ts'

const DIR = 'recordings'

export interface VideoWriter {
  store: VideoRef['store']
  write: (chunk: Blob) => void
  /** Flushes everything; resolves to the bytes written. */
  close: () => Promise<number>
}

async function recordingsDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage?.getDirectory?.()
    return root ? await root.getDirectoryHandle(DIR, { create: true }) : null
  } catch {
    return null
  }
}

export async function openVideoWriter(file: string): Promise<VideoWriter> {
  const dir = await recordingsDir()
  const handle = dir ? await dir.getFileHandle(file, { create: true }) : null
  if (handle && 'createWritable' in handle) {
    const writable = await handle.createWritable()
    let bytes = 0
    // Writes are queued so chunks land in order even when they arrive fast.
    let queue: Promise<void> = Promise.resolve()
    return {
      store: 'opfs',
      write: (chunk) => {
        bytes += chunk.size
        queue = queue.then(() => writable.write(chunk))
      },
      close: async () => {
        await queue
        await writable.close()
        return bytes
      },
    }
  }
  const chunks: Blob[] = []
  return {
    store: 'idb',
    write: (chunk) => chunks.push(chunk),
    close: async () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type ?? 'video/webm' })
      await putVideoBlob(file, blob)
      return blob.size
    },
  }
}

export async function readVideo(ref: VideoRef): Promise<Blob | null> {
  if (ref.store === 'idb') return (await getVideoBlob(ref.file)) ?? null
  try {
    const dir = await recordingsDir()
    const handle = await dir?.getFileHandle(ref.file)
    const file = await handle?.getFile()
    return file ? new Blob([file], { type: ref.mimeType }) : null
  } catch {
    return null
  }
}

export async function deleteVideo(ref: VideoRef): Promise<void> {
  if (ref.store === 'idb') return deleteVideoBlob(ref.file)
  try {
    await (await recordingsDir())?.removeEntry(ref.file)
  } catch {
    // Already gone.
  }
}

/** Removes every recording (Settings → delete everything). */
export async function clearVideos(): Promise<void> {
  try {
    const root = await navigator.storage?.getDirectory?.()
    await root?.removeEntry(DIR, { recursive: true })
  } catch {
    // Nothing recorded yet.
  }
}
