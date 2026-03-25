import { args } from "./cli"
import { loadConfig } from "./config"
import { openDb, ensureProject } from "./db"
import { ensurePaths } from "./project"
import { current, addAssistant, addSystem, history } from "./session"
import { assertBedrock } from "./bedrock"
import { SYSTEM } from "./prompt"
import { app } from "./ui/app"
import { runTurn } from "./loop"

const input = args()
const paths = await ensurePaths()
const cfg = await loadConfig(paths.root)
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
