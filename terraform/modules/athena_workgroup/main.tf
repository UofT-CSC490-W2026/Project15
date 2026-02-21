resource "aws_athena_workgroup" "this" {
  name          = var.name
  force_destroy = true

  configuration {
    enforce_workgroup_configuration = true

    result_configuration {
      output_location = var.result_output
    }
  }
}
