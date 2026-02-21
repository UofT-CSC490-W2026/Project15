terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

module "raw_bucket" {
  source = "../../modules/s3_bucket"
  name   = var.raw_bucket
  tags   = var.tags
}

module "clean_bucket" {
  source = "../../modules/s3_bucket"
  name   = var.clean_bucket
  tags   = var.tags
}

module "glue_db" {
  source      = "../../modules/glue_database"
  name        = var.glue_database
  description = "OpenCode pipeline catalog (prod)"
}

module "runs_table" {
  source   = "../../modules/glue_table"
  database = module.glue_db.name
  name     = "runs"
  location = "s3://${var.clean_bucket}/curated/runs/"
  columns = [
    { name = "run_id", type = "string" },
    { name = "timestamp", type = "string" },
    { name = "repo_id", type = "string" },
    { name = "repo_hash", type = "string" },
    { name = "prompt", type = "string" },
    { name = "model", type = "string" },
    { name = "model_params", type = "string" },
    { name = "status", type = "string" },
    { name = "duration_ms", type = "bigint" },
    { name = "cpu_ms", type = "bigint" },
    { name = "mem_mb", type = "double" },
    { name = "repair_success", type = "boolean" },
    { name = "regression", type = "boolean" },
    { name = "taint_spread", type = "int" },
  ]
}

module "run_steps_table" {
  source   = "../../modules/glue_table"
  database = module.glue_db.name
  name     = "run_steps"
  location = "s3://${var.clean_bucket}/curated/run_steps/"
  columns = [
    { name = "run_id", type = "string" },
    { name = "step_id", type = "int" },
    { name = "timestamp", type = "string" },
    { name = "action", type = "string" },
    { name = "command", type = "string" },
    { name = "diff_ref", type = "string" },
    { name = "stdout_ref", type = "string" },
    { name = "stderr_ref", type = "string" },
  ]
}

module "verification_table" {
  source   = "../../modules/glue_table"
  database = module.glue_db.name
  name     = "verification_results"
  location = "s3://${var.clean_bucket}/curated/verification_results/"
  columns = [
    { name = "run_id", type = "string" },
    { name = "module", type = "string" },
    { name = "status", type = "string" },
    { name = "time_ms", type = "bigint" },
  ]
}

module "errors_table" {
  source   = "../../modules/glue_table"
  database = module.glue_db.name
  name     = "errors"
  location = "s3://${var.clean_bucket}/curated/errors/"
  columns = [
    { name = "run_id", type = "string" },
    { name = "file", type = "string" },
    { name = "line", type = "int" },
    { name = "error_kind", type = "string" },
    { name = "message_hash", type = "string" },
    { name = "raw_message", type = "string" },
  ]
}

module "graph_table" {
  source   = "../../modules/glue_table"
  database = module.glue_db.name
  name     = "graph_snapshots"
  location = "s3://${var.clean_bucket}/curated/graph_snapshots/"
  columns = [
    { name = "run_id", type = "string" },
    { name = "snapshot_ts", type = "string" },
    { name = "nodes", type = "string" },
    { name = "edges", type = "string" },
    { name = "dirty_count", type = "int" },
    { name = "tainted_count", type = "int" },
  ]
}

module "athena" {
  source         = "../../modules/athena_workgroup"
  name           = "project15-prod"
  result_output  = "s3://${var.clean_bucket}/athena-results/prod/"
}
