// The camera, for recording now and ball tracking later. Back camera by default:
// the phone faces the court.

export async function startCamera(
  facingMode: 'environment' | 'user' = 'environment',
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  })
}
