import { getSession } from "./api"

// Shrink a phone photo before upload: max 2000px on the long side, JPEG ~85%.
// Keeps bills readable while staying well under upload limits.
export async function compressImage(file, maxSide = 2000, quality = 0.85) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return file // format the browser can't decode (e.g. HEIC outside Safari): send as is
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality))
  return blob ? new File([blob], (file.name || "bill").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file
}

// Fetch an authenticated image and return an object URL for <img src>.
export async function fetchImageUrl(path) {
  const token = getSession()?.access_token
  const res = await fetch("/api/v1" + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error("Couldn't load the bill photo")
  return URL.createObjectURL(await res.blob())
}
