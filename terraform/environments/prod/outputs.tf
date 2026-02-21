output "raw_bucket_name" {
  value = module.raw_bucket.name
}

output "clean_bucket_name" {
  value = module.clean_bucket.name
}

output "glue_database_name" {
  value = module.glue_db.name
}

output "athena_workgroup" {
  value = module.athena.name
}
