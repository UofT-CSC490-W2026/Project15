import { args } from "./cli"
import { loadConfig } from "./config"
import { openDb, ensureProject } from "./db"
import { ensurePaths } from "./project"
import { current, addAssistant, addSystem, history } from "./session"
import { assertBedrock, hasAwsCreds, saveApiKey } from "./bedrock"
import { SYSTEM } from "./prompt"
import { app } from "./ui/app"
import { runTurn } from "./loop"
import readline from "readline/promises"

async function ensureAuth() {
  if (await hasAwsCreds(cfg)) return
  process.stdout.write("No Bedrock credentials detected.\n")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const key = (await rl.question("Enter Bedrock API key: ")).trim()
  rl.close()
  if (!key) return
  process.env.AWS_BEARER_TOKEN_BEDROCK = key
  await saveApiKey(key)
}

const input = args()
const paths = await ensurePaths()
const cfg = await loadConfig(paths.root)
await ensureAuth()
await assertBedrock(cfg)

const db = openDb(paths)
ensureProject(db, paths.root)
const session = current(db, paths.root, cfg)

if (history(db).length === 0) addSystem(db, SYSTEM)
let currentSession = session
if (input.prompt) {
  try {
    currentSession = (
      await runTurn({
        db,
        paths,
        cfg,
        session,
        system: SYSTEM,
        text: input.prompt,
      })
    ).session
  } catch (error) {
    addAssistant(db, error instanceof Error ? error.message : String(error))
  }
}
await app({
  db,
  paths,
  cfg,
  session: currentSession,
  system: SYSTEM,
})
