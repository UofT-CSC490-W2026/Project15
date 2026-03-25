import readline from "readline/promises"

export async function readMessage() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const chunks: string[] = []
  while (true) {
    const line = await rl.question(chunks.length === 0 ? "> " : "| ")
    if (line === ".") break
    if (chunks.length === 0 && line.trim() === "/exit") {
      rl.close()
      return undefined
    }
    chunks.push(line)
  }
  rl.close()
  return chunks.join("\n").trim()
}
