variable "region" {
  type    = string
  default = "ca-central-1"
}

variable "raw_bucket" {
  type    = string
  default = "project15-raw-chris"
}

variable "clean_bucket" {
  type    = string
  default = "project15-clean-chris"
}

variable "tags" {
  type = map(string)
  default = {
    environment = "prod"
    project     = "project15"
  }
}

variable "glue_database" {
  type    = string
  default = "project15_pipeline_prod"
}
