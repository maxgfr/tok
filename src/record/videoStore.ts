// Where recordings live. OPFS when the browser can stream into it; otherwise
// (iOS) each chunk goes to IndexedDB as it comes and the file is put back
// together when read. Either way a long session never sits in RAM. Appended
// chunks come from MediaRecorder, positioned ones from the MP4 muxer.

import {
  deleteVideoBlob,
  deleteVideoChunks,
  getVideoBlob,
  getVideoChunks,
  listSummaries,
  listVideoKeys,
  putVideoChunk,
  type VideoRef,
} from '../store/db.ts'

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
  let seq = 0
  let bytes = 0
  let queue: Promise<void> = Promise.resolve()
  return {
    store: 'idb',
    write: (chunk) => {
      const record = { file, seq: seq++, position: bytes, data: chunk, at: Date.now() }
      bytes += chunk.size
      queue = queue.then(() => putVideoChunk(record))
    },
    close: async () => {
      await queue
      return bytes
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
  // iOS: each write goes to IndexedDB as it comes.
  let seq = 0
  return {
    store: 'idb',
    saved,
    stream: new WritableStream<VideoChunk>({
      write: async (chunk) => {
        grow(chunk)
        // A copy: the muxer may reuse its buffer once the write resolves.
        const data = new Blob([chunk.data.slice()])
        await putVideoChunk({ file, seq: seq++, position: chunk.position, data, at: Date.now() })
      },
      close: () => resolveSaved(size),
      abort: (reason) => rejectSaved(reason),
    }),
  }
}

/**
 * A recording kept in IndexedDB chunks, as one Blob. Appended chunks are
 * joined as they are (the Blobs stay on disk); writes that went back to an
 * earlier position are laid out in memory.
 */
async function joinChunks(file: string, type: string): Promise<Blob | null> {
  const chunks = await getVideoChunks(file)
  if (chunks.length === 0) return null
  let end = 0
  const appended = chunks.every((c) => {
    const inOrder = c.position === end
    end += c.data.size
    return inOrder
  })
  if (appended)
    return new Blob(
      chunks.map((c) => c.data),
      { type },
    )
  const size = Math.max(...chunks.map((c) => c.position + c.data.size))
  const bytes = new Uint8Array(size)
  for (const c of chunks) bytes.set(new Uint8Array(await c.data.arrayBuffer()), c.position)
  return new Blob([bytes], { type })
}

export async function readVideo(ref: VideoRef): Promise<Blob | null> {
  // Saved whole by an older version, else in chunks.
  if (ref.store === 'idb')
    return (await getVideoBlob(ref.file)) ?? joinChunks(ref.file, ref.mimeType)
  try {
    const dir = await recordingsDir()
    const handle = await dir?.getFileHandle(ref.file)
    const file = await handle?.getFile()
    // Empty: the tab died before the file was closed (OPFS keeps writes aside until then).
    return file && file.size > 0 ? new Blob([file], { type: ref.mimeType }) : null
  } catch {
    return null
  }
}

export async function deleteVideo(ref: VideoRef): Promise<void> {
  if (ref.store === 'idb') {
    await Promise.all([deleteVideoBlob(ref.file), deleteVideoChunks(ref.file)])
    return
  }
  try {
    await (await recordingsDir())?.removeEntry(ref.file)
  } catch {
    // Already gone.
  }
}

/** A file written to this recently may be a recording still going: left alone. */
const FRESH_MS = 60_000

/**
 * Removes recordings no session points to any more: what a crash or a closed
 * tab left behind. `keep`: the files sessions refer to.
 */
export async function pruneRecordings(keep: ReadonlySet<string>): Promise<number> {
  let removed = 0
  const dir = await recordingsDir()
  if (dir) {
    for await (const [name, handle] of dir.entries()) {
      if (keep.has(name) || handle.kind !== 'file') continue
      try {
        const file = await (handle as FileSystemFileHandle).getFile()
        if (Date.now() - file.lastModified < FRESH_MS) continue
        await dir.removeEntry(name)
        removed += 1
      } catch {
        // Locked by a recording, or gone already.
      }
    }
  }
  for (const name of await listVideoKeys()) {
    if (keep.has(name)) continue
    const latest = Math.max(0, ...(await getVideoChunks(name)).map((c) => c.at))
    if (Date.now() - latest < FRESH_MS) continue
    await Promise.all([deleteVideoBlob(name), deleteVideoChunks(name)])
    removed += 1
  }
  return removed
}

/** At launch: the recordings a crash or a closed tab left with no session. */
export async function pruneOrphanRecordings(): Promise<number> {
  const keep = new Set((await listSummaries()).flatMap((s) => s.videoFiles))
  return pruneRecordings(keep)
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
