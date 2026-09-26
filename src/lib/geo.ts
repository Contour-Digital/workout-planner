import type { GeoPoint } from '../models/cardioActivity'

const EARTH_RADIUS_METERS = 6371000

/** Great-circle distance between two points, in metres. */
export function haversineDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Total distance along a route, summing the distance between each consecutive point. */
export function routeDistanceMeters(route: GeoPoint[]): number {
  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += haversineDistance(route[i - 1], route[i])
  }
  return total
}

export interface DistanceSample {
  distanceKm: number
  value: number
}

/** Elevation (metres) at each point that reported one, against cumulative distance.
 *  Returns null when the device never reported an altitude for this activity (common
 *  on network-based or low-end GPS fixes) — there's nothing honest to chart then. */
export function elevationSeries(route: GeoPoint[]): DistanceSample[] | null {
  if (!route.some((p) => typeof p.altitude === 'number')) return null
  let cumulative = 0
  const series: DistanceSample[] = []
  for (let i = 0; i < route.length; i++) {
    if (i > 0) cumulative += haversineDistance(route[i - 1], route[i])
    const altitude = route[i].altitude
    if (typeof altitude === 'number') series.push({ distanceKm: cumulative / 1000, value: altitude })
  }
  return series.length > 1 ? series : null
}

/** Sum of climbs of more than 1m between consecutive altitude readings — the 1m floor
 *  filters out GPS altitude jitter (routinely ±5-10m even with a good fix) rather than
 *  counting every wobble as a "climb". */
export function elevationGainMeters(route: GeoPoint[]): number {
  const readings = route.filter((p): p is GeoPoint & { altitude: number } => typeof p.altitude === 'number')
  let gain = 0
  for (let i = 1; i < readings.length; i++) {
    const delta = readings[i].altitude - readings[i - 1].altitude
    if (delta > 1) gain += delta
  }
  return gain
}

/** Pace (seconds per km) for each GPS segment against cumulative distance — the raw,
 *  un-smoothed per-segment reading, so a real stop or a burst of speed still shows up
 *  as a spike rather than being averaged away. Segments too short to time reliably
 *  (near-zero distance/duration) are skipped rather than producing a wild spike. */
export function paceSeries(route: GeoPoint[]): DistanceSample[] {
  let cumulative = 0
  const series: DistanceSample[] = []
  for (let i = 1; i < route.length; i++) {
    const segmentMeters = haversineDistance(route[i - 1], route[i])
    const segmentSeconds = (new Date(route[i].timestamp).getTime() - new Date(route[i - 1].timestamp).getTime()) / 1000
    cumulative += segmentMeters
    if (segmentMeters < 1 || segmentSeconds <= 0) continue
    series.push({ distanceKm: cumulative / 1000, value: segmentSeconds / (segmentMeters / 1000) })
  }
  return series
}
