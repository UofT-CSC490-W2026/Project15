export type Diagnostic = {
  file: string
  line?: number
  column?: number
  message: string
}

export function parseOutput(text: string) {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*(.+)$/)
      if (!match) return []
      return [
        {
          file: match[1],
          line: Number(match[2]),
          column: Number(match[3]),
          message: match[4],
        } satisfies Diagnostic,
      ]
    })
}
