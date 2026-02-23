# Terraform (IaC)

This folder provisions the pipeline infrastructure for dev and prod.
Current scope: S3 buckets, Glue Data Catalog tables, and Athena workgroups.

## Structure

- `terraform/modules/s3_bucket` exists to standardize S3 bucket creation with optional versioning and tags. It creates the bucket and configures versioning based on the `versioning` input.
- `terraform/modules/glue_database` exists to define a Glue Data Catalog database in one place. It creates an `aws_glue_catalog_database` with a name and optional description.
- `terraform/modules/glue_table` exists to declare JSON-backed Glue external tables for Athena/Glue queries. It creates an `EXTERNAL_TABLE` with JSON SerDe settings and a dynamic column list from `columns`.
- `terraform/modules/athena_workgroup` exists to enforce a consistent Athena workgroup configuration. It creates a workgroup and forces query results to an S3 output location.
- `terraform/environments/dev` exists to provision a full dev stack using the shared modules. It creates raw/clean buckets, a Glue database, several Glue tables, and an Athena workgroup with results stored under the dev S3 prefix.
- `terraform/environments/prod` exists to provision the production stack with the same layout and module wiring. It mirrors dev resources but points outputs and table locations at the prod S3 prefixes and workgroup.

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
