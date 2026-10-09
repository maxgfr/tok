// Where recordings live. OPFS when the browser can stream into it (chunks go
// straight to disk, not RAM); otherwise the chunks are kept and saved as one
// Blob in IndexedDB at the end (Safari). Appended chunks come from
// MediaRecorder, positioned ones from the MP4 muxer.

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

/** A positioned write, as an MP4 muxer emits them. */
export interface VideoChunk {
  type: 'write'
  data: Uint8Array
  position: number
}

export interface VideoSink {
  store: VideoRef['store']
  /** Takes positioned writes; closing it saves the file. */
  stream: WritableStream<VideoChunk>
  /** Resolves to the file's size once the stream has closed and the file is saved. */
  saved: Promise<number>
}

/** Like `openVideoWriter`, for a muxer that writes at byte positions. */
export async function openVideoSink(file: string): Promise<VideoSink> {
  let size = 0
  let resolveSaved: (bytes: number) => void = () => {}
  let rejectSaved: (error: unknown) => void = () => {}
  const saved = new Promise<number>((resolve, reject) => {
    resolveSaved = resolve
    rejectSaved = reject
  })
  saved.catch(() => {})
  const grow = (chunk: VideoChunk) => {
    size = Math.max(size, chunk.position + chunk.data.byteLength)
  }

  const dir = await recordingsDir()
  const handle = dir ? await dir.getFileHandle(file, { create: true }) : null
  if (handle && 'createWritable' in handle) {
    const writable = await handle.createWritable()
    return {
      store: 'opfs',
      saved,
      stream: new WritableStream<VideoChunk>({
        write: async (chunk) => {
          grow(chunk)
          await writable.write({
            type: 'write',
            position: chunk.position,
            data: chunk.data as Uint8Array<ArrayBuffer>,
          })
        },
        close: async () => {
          await writable.close()
          resolveSaved(size)
        },
        abort: async (reason) => {
          await writable.abort(reason)
          rejectSaved(reason)
        },
      }),
    }
  }
  // Safari: kept in memory, saved as one Blob at the end.
  const chunks: VideoChunk[] = []
  return {
    store: 'idb',
    saved,
    stream: new WritableStream<VideoChunk>({
      write: (chunk) => {
        grow(chunk)
        // The muxer may reuse its buffer once the write resolves.
        chunks.push({ ...chunk, data: chunk.data.slice() })
      },
      close: async () => {
        const bytes = new Uint8Array(size)
        for (const c of chunks) bytes.set(c.data, c.position)
        await putVideoBlob(file, new Blob([bytes], { type: 'video/mp4' }))
        resolveSaved(size)
      },
      abort: (reason) => rejectSaved(reason),
    }),
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
