import { useEffect, useState } from 'react'

export function WorldviewAnalyzerView(): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.worldview
      .getUrl()
      .then((serviceUrl) => {
        if (!cancelled) setUrl(serviceUrl)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-900 text-sm text-red-400">
        世界观分析服务启动失败：{error}
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-900 text-sm text-gray-500">
        正在启动世界观分析服务…
      </div>
    )
  }

  return (
    <iframe
      className="h-full w-full border-0 bg-surface-900"
      src={url}
      title="世界观分析"
    />
  )
}
