export function args(argv = process.argv.slice(2)) {
  return {
    prompt: argv.join(" ").trim() || undefined,
  }
}
