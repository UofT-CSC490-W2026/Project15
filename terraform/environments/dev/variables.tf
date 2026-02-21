variable "region" {
  type    = string
  default = "ca-central-1"
}

variable "raw_bucket" {
  type    = string
  default = "project15-raw-chris-dev"
}

variable "clean_bucket" {
  type    = string
  default = "project15-clean-chris-dev"
}

variable "tags" {
  type = map(string)
  default = {
    environment = "dev"
    project     = "project15"
  }
}

variable "glue_database" {
  type    = string
  default = "project15_pipeline_dev"
}
