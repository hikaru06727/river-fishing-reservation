export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}時間` : `${hours.toFixed(1)}時間`;
}
