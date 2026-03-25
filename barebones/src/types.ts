export type Role = "system" | "user" | "assistant" | "tool"

export type Msg = {
  id: string
  role: Role
  text: string
  created_at: number
  tool_call_id?: string
}

export type ToolRecord = {
  id: string
  name: string
  input: string
  output: string
  status: "running" | "completed" | "failed"
  created_at: number
  updated_at: number
}

export type Session = {
  id: string
  project_root: string
  title: string
  model: string
  created_at: number
  updated_at: number
}

export type Cfg = {
  model: string
  region: string
  profile?: string
  endpoint?: string
  max_steps: number
  dafny_command: string
}

export type Paths = {
  root: string
  barebones: string
  dafny: string
  db: string
  config: string
}
