/** "https://www.example.com/a" -> "example.com"; falls back to the input if it is not a URL. */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
