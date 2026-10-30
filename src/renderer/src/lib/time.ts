/** 把毫秒时间戳格式化为「刚刚 / N 分钟前 / N 小时前 / M月D日」 */
export function formatRelative(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`

  const date = new Date(ts)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(
    'zh-CN',
    sameYear
      ? { month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'long', day: 'numeric' }
  )
}

/** 把毫秒时间戳格式化为 HH:mm，用于「已保存」提示 */
export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
