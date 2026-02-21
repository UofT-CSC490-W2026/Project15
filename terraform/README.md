# Terraform (IaC)

This folder provisions the pipeline infrastructure for dev and prod.
Current scope: S3 buckets, Glue Data Catalog tables, and Athena workgroups.

## Structure

- `terraform/modules/s3_bucket` reusable S3 bucket module
- `terraform/modules/glue_database` Glue catalog database
- `terraform/modules/glue_table` Glue external table (JSON)
- `terraform/modules/athena_workgroup` Athena workgroup
- `terraform/environments/dev` dev environment
- `terraform/environments/prod` prod environment

## Credentials

Terraform uses the standard AWS credential chain (env vars or `aws configure`).
Do not store credentials in code.

## Run

```bash
cd terraform/environments/dev
terraform init
terraform plan
terraform apply
```

```bash
cd terraform/environments/prod
terraform init
terraform plan
terraform apply
```
