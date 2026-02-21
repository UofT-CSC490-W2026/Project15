variable "database" {
  type = string
}

variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "columns" {
  type = list(object({
    name = string
    type = string
  }))
}

variable "classification" {
  type    = string
  default = "json"
}
