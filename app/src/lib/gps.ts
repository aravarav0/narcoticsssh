export type GpsFix = {
  lat: number
  lon: number
  accuracyM: number | null
}

export function readGps(): Promise<GpsFix | null> {
  if (!navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 2500, maximumAge: 15000 },
    )
  })
}
