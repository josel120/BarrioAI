/** Human distance: meters below 1 km, one decimal km above. */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(meters)) return "";
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}
