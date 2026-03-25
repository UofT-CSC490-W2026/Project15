import type { Cfg } from "./types"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { fromNodeProviderChain } from "@aws-sdk/credential-providers"
import { root } from "./project"

function exists(value?: string) {
  return Boolean(value && value.trim())
}

function parseIni(text: string) {
  const result: Record<string, Record<string, string>> = {}
  let section = ""
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#") || line.startsWith(";")) continue
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1).trim()
      if (!result[section]) result[section] = {}
      continue
    }
    const idx = line.indexOf("=")
    if (idx === -1 || !section) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    result[section][key] = value
  }
  return result
}

async function shared() {
  const home = os.homedir()
  const [configText, credsText] = await Promise.all([
    fs.readFile(path.join(home, ".aws", "config"), "utf8").catch(() => ""),
    fs.readFile(path.join(home, ".aws", "credentials"), "utf8").catch(() => ""),
  ])
  return {
    config: parseIni(configText),
    creds: parseIni(credsText),
  }
}

async function authPath() {
  return path.join(await root(), ".barebones", "auth.json")
}

async function savedApiKey() {
  const file = await authPath()
  const json = await Bun.file(file)
    .json()
    .catch(() => undefined) as { apiKey?: string } | undefined
  return json?.apiKey?.trim()
}

export async function saveApiKey(key: string) {
  const file = await authPath()
  await Bun.write(file, JSON.stringify({ apiKey: key.trim() }, null, 2), { mode: 0o600 })
}

export async function sharedProfile(name: string) {
  const files = await shared()
  const config = files.config[`profile ${name}`] ?? files.config[name] ?? {}
  const creds = files.creds[name] ?? {}
  const accessKeyId = creds["aws_access_key_id"]
  const secretAccessKey = creds["aws_secret_access_key"]
  const sessionToken = creds["aws_session_token"]
  const region = config["region"]
  if (!accessKeyId || !secretAccessKey) return undefined
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
  }
}

export async function hasAwsCreds(cfg?: Cfg) {
  if (exists(process.env.AWS_BEARER_TOKEN_BEDROCK)) return true
  if (exists(await savedApiKey())) return true
  if (exists(process.env.AWS_ACCESS_KEY_ID) && exists(process.env.AWS_SECRET_ACCESS_KEY)) return true
  if (exists(process.env.AWS_WEB_IDENTITY_TOKEN_FILE) && exists(process.env.AWS_ROLE_ARN)) return true
  if (exists(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)) return true
  if (exists(process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI)) return true
  const profile = cfg?.profile || process.env.AWS_PROFILE || "default"
  return Boolean(await sharedProfile(profile))
}

export async function creds(cfg: Cfg) {
  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() || await savedApiKey()
  if (exists(apiKey)) {
    return {
      apiKey,
      region: cfg.region,
      baseURL: cfg.endpoint,
    }
  }
  if (exists(process.env.AWS_ACCESS_KEY_ID) && exists(process.env.AWS_SECRET_ACCESS_KEY)) {
    return {
      region: cfg.region,
      baseURL: cfg.endpoint,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    }
  }
  const profile = cfg.profile || process.env.AWS_PROFILE || "default"
  const shared = await sharedProfile(profile)
  if (shared) {
    return {
      region: cfg.region || shared.region || "us-east-1",
      baseURL: cfg.endpoint,
      accessKeyId: shared.accessKeyId,
      secretAccessKey: shared.secretAccessKey,
      sessionToken: shared.sessionToken,
    }
  }
  return false
}

export async function provider(cfg: Cfg) {
  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() || await savedApiKey()
  if (apiKey) {
    return createAmazonBedrock({
      apiKey,
      region: cfg.region,
      baseURL: cfg.endpoint,
    })
  }
  const profile = cfg.profile || process.env.AWS_PROFILE
  return createAmazonBedrock({
    region: cfg.region,
    baseURL: cfg.endpoint,
    credentialProvider: fromNodeProviderChain(profile ? { profile } : {}),
  })
}

export function bedrockConfig(cfg: Cfg) {
  return {
    model: cfg.model,
    region: cfg.region,
    profile: cfg.profile,
    endpoint: cfg.endpoint,
  }
}

export function modelId(cfg: Cfg) {
  const id = cfg.model.trim()
  if (!id) return id
  if (id.startsWith("arn:aws:bedrock:")) return id

  const prefixes = ["global.", "us.", "eu.", "jp.", "apac.", "au."]
  if (prefixes.some((prefix) => id.startsWith(prefix))) return id

  const region = cfg.region || "us-east-1"
  let prefix = region.split("-")[0]

  switch (prefix) {
    case "us": {
      const needs = ["nova-micro", "nova-lite", "nova-pro", "nova-premier", "nova-2", "claude", "deepseek"]
      if (needs.some((item) => id.includes(item)) && !region.startsWith("us-gov")) return `${prefix}.${id}`
      return id
    }
    case "eu": {
      const regional = ["eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "eu-central-1", "eu-south-1", "eu-south-2"]
      const needs = ["claude", "nova-lite", "nova-micro", "llama3", "pixtral"]
      if (regional.some((item) => region.includes(item)) && needs.some((item) => id.includes(item))) {
        return `${prefix}.${id}`
      }
      return id
    }
    case "ap": {
      const australia = ["ap-southeast-2", "ap-southeast-4"].includes(region)
      const tokyo = region === "ap-northeast-1"
      if (australia && ["anthropic.claude-sonnet-4-5", "anthropic.claude-haiku"].some((item) => id.includes(item))) {
        return `au.${id}`
      }
      if (tokyo && ["claude", "nova-lite", "nova-micro", "nova-pro"].some((item) => id.includes(item))) {
        return `jp.${id}`
      }
      if (["claude", "nova-lite", "nova-micro", "nova-pro"].some((item) => id.includes(item))) {
        return `apac.${id}`
      }
      return id
    }
    default:
      return id
  }
}

export async function assertBedrock(cfg: Cfg) {
  if (!cfg.model) throw new Error("Missing Bedrock model id in .barebones/config.json")
  if (!(await hasAwsCreds(cfg))) throw new Error("Missing AWS credentials for Bedrock")
  return bedrockConfig(cfg)
}
