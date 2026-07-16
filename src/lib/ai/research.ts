const JINA_READER_ENDPOINT = 'https://r.jina.ai/'
const URL_REGEX = /https?:\/\/[^\s<>")\]]+/gi
const MAX_CONTENT_LENGTH = 8000

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []
  return [...new Set(matches)].filter((url) => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  })
}

export interface ResearchResult {
  url: string
  title: string
  content: string
  success: boolean
  error?: string
}

export async function fetchUrlContent(
  url: string,
  signal?: AbortSignal,
): Promise<ResearchResult> {
  try {
    const encodedUrl = encodeURIComponent(url)
    const res = await fetch(`${JINA_READER_ENDPOINT}${encodedUrl}`, {
      headers: {
        Accept: 'text/markdown',
      },
      signal,
    })

    if (!res.ok) {
      return {
        url,
        title: '',
        content: '',
        success: false,
        error: `Jina Reader error ${res.status}`,
      }
    }

    const text = await res.text()
    const titleMatch = text.match(/^#\s+(.+)/m)
    const title = titleMatch?.[1] ?? new URL(url).hostname
    const content = text.length > MAX_CONTENT_LENGTH
      ? text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated]'
      : text

    return { url, title, content, success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { url, title: '', content: '', success: false, error: msg }
  }
}

export async function fetchUrls(
  urls: string[],
  signal?: AbortSignal,
): Promise<ResearchResult[]> {
  return Promise.all(urls.map((url) => fetchUrlContent(url, signal)))
}

export function buildResearchContext(results: ResearchResult[]): string {
  const successful = results.filter((r) => r.success)
  if (successful.length === 0) return ''

  const parts = successful.map((r) => {
    const snippet = r.content.slice(0, 3000)
    return `### ${r.title}\nSource: ${r.url}\n\n${snippet}`
  })

  return `\n\nFetched web content:\n${parts.join('\n\n---\n\n')}`
}
