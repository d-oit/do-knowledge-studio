# Infrastructure as Code Examples

Terraform and Pulumi examples for database infrastructure. Updated for 2026 with latest Terraform AWS provider (v6.x).

## Overview

This guide provides practical examples for managing database infrastructure using Infrastructure as Code (IaC) tools with current best practices.

## Terraform Examples

### PostgreSQL on AWS RDS (2026 Updated)

```hcl
# variables.tf
variable "db_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# main.tf
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"  # 2026: Use latest AWS provider
    }
  }
}

provider "aws" {
  region = "us-west-2"
  
  # 2026: Default tags for cost allocation
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Team        = "database"
    }
  }
}

resource "aws_db_instance" "main" {
  identifier = "production-db"
  
  engine         = "postgres"
  engine_version = "18.3"  # 2026: PostgreSQL 18
  instance_class = "db.t3.medium"
  
  allocated_storage       = 100
  max_allocated_storage   = 1000  # Enable storage autoscaling
  storage_type           = "gp3"   # 2026: gp3 is default
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.db.arn
  
  db_name  = "myapp"
  username = "dbadmin"
  password = var.db_password
  
  # Backup settings
  backup_retention_period = 35     # 2026: Max for compliance
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # High availability
  multi_az               = true
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "production-db-final"
  
  # VPC configuration
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false
  
  # Monitoring (2026 enhanced)
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  monitoring_interval            = 60
  monitoring_role_arn            = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled   = true
  performance_insights_retention_period = 7
  
  # Parameter group
  parameter_group_name = aws_db_parameter_group.main.name
  
  # Auto minor version upgrade
  auto_minor_version_upgrade = true
  
  copy_tags_to_snapshot = true
}

# 2026: gp3 storage optimization
resource "aws_db_instance" "main_gp3" {
  identifier = "production-db-gp3"
  
  engine         = "postgres"
  engine_version = "18.3"
  instance_class = "db.t3.medium"
  
  allocated_storage     = 100
  storage_type         = "gp3"
  storage_throughput   = 125  # Additional throughput for gp3
  iops                = 3000   # Provisioned IOPS
  storage_encrypted   = true
  
  # ... other settings
}

resource "aws_security_group" "db" {
  name_prefix = "db-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
    description = "PostgreSQL from VPC"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "database-security-group"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "main"
  subnet_ids = aws_subnet.private[*].id
  
  tags = {
    Name = "Main DB subnet group"
  }
}

# 2026: Custom parameter group
resource "aws_db_parameter_group" "main" {
  family = "postgres18"
  name   = "production-postgres18"
  
  parameter {
    name  = "log_connections"
    value = "1"
  }
  
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log slow queries (>1s)
  }
  
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,auto_explain"
  }
  
  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }
}

# outputs.tf
output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = false
}

output "db_name" {
  value = aws_db_instance.main.db_name
}

output "db_arn" {
  value = aws_db_instance.main.arn
}
```

### Read Replicas

```hcl
resource "aws_db_instance" "replica" {
  identifier = "production-db-replica"
  
  replicate_source_db    = aws_db_instance.main.arn
  instance_class         = "db.t3.small"
  
  # 2026: Read replicas can have enhanced monitoring
  monitoring_interval  = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  # Replicas inherit most settings from source
  vpc_security_group_ids = [aws_security_group.db.id]
  
  tags = {
    Purpose = "read-replica"
  }
}

# Cross-region replica (2026)
resource "aws_db_instance" "cross_region_replica" {
  provider = aws.us_east_1  # Different region
  
  identifier = "production-db-replica-east"
  
  replicate_source_db    = aws_db_instance.main.arn
  instance_class         = "db.t3.medium"
  
  vpc_security_group_ids = [aws_security_group.db_east.id]
  
  # Disaster recovery configuration
  deletion_protection = true
  
  tags = {
    Purpose = "disaster-recovery"
  }
}
```

### PostgreSQL on Azure (2026)

```hcl
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

resource "azurerm_resource_group" "main" {
  name     = "database-rg"
  location = "West US 2"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "production-postgres"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "16"  # 2026: Latest stable
  
  administrator_login    = "psqladmin"
  administrator_password = var.db_password
  
  storage_mb   = 32768
  sku_name     = "GP_Standard_D2s_v3"
  
  backup_retention_days        = 35
  geo_redundant_backup_enabled = true
  
  public_network_access_enabled = false
  delegated_subnet_id          = azurerm_subnet.db.id
  private_dns_zone_id          = azurerm_private_dns_zone.db.id
  
  # 2026: High availability
  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }
  
  # 2026: Maintenance window
  maintenance_window {
    day_of_week  = 0
    start_hour   = 3
    start_minute = 0
  }
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "myapp"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

# 2026: Firewall rules
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
```

### Cloud SQL on GCP (2026)

```hcl
provider "google" {
  project = var.project_id
  region  = "us-central1"
}

resource "google_sql_database_instance" "main" {
  name             = "production-postgres"
  database_version = "POSTGRES_16"  # 2026: PostgreSQL 16
  region           = "us-central1"
  
  settings {
    tier = "db-n1-standard-2"
    
    # Storage
    disk_size = 100
    disk_type = "PD_SSD"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = "us"
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }
    
    maintenance_window {
      day          = "7"  # Sunday
      hour         = "4"
      update_track = "stable"
    }
    
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
      query_plans_per_minute = 5  # 2026: New setting
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }
    
    # 2026: Database flags
    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }
  
  deletion_protection = true
}

resource "google_sql_database" "main" {
  name     = "myapp"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "admin" {
  name     = "admin"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
```

## Pulumi Examples

### PostgreSQL on AWS (Python)

```python
import pulumi
import pulumi_aws as aws
from pulumi import Config

config = Config()

# Create a VPC
vpc = aws.ec2.Vpc("main",
    cidr_block="10.0.0.0/16",
    enable_dns_hostnames=True,
    enable_dns_support=True,
    tags={"Name": "main-vpc"}
)

# Create subnets across AZs
subnets = []
for i, az in enumerate(["us-west-2a", "us-west-2b", "us-west-2c"]):
    subnet = aws.ec2.Subnet(f"subnet-{i}",
        vpc_id=vpc.id,
        cidr_block=f"10.0.{i+1}.0/24",
        availability_zone=az,
        tags={"Name": f"db-subnet-{i}"}
    )
    subnets.append(subnet)

# DB Subnet Group
subnet_group = aws.rds.SubnetGroup("main",
    subnet_ids=[s.id for s in subnets],
    tags={"Name": "main-db-subnet-group"}
)

# Security Group
security_group = aws.ec2.SecurityGroup("db",
    vpc_id=vpc.id,
    ingress=[{
        "protocol": "tcp",
        "from_port": 5432,
        "to_port": 5432,
        "cidr_blocks": [vpc.cidr_block],
        "description": "PostgreSQL from VPC"
    }],
    egress=[{
        "protocol": "-1",
        "from_port": 0,
        "to_port": 0,
        "cidr_blocks": ["0.0.0.0/0"]
    }],
    tags={"Name": "db-security-group"}
)

# KMS Key for encryption
kms_key = aws.kms.Key("db",
    description="KMS key for RDS encryption",
    deletion_window_in_days=7
)

# RDS Instance
# 2026: Using PostgreSQL 18
rds_instance = aws.rds.Instance("main",
    engine="postgres",
    engine_version="18.3",
    instance_class="db.t3.medium",
    allocated_storage=100,
    storage_type="gp3",
    storage_encrypted=True,
    kms_key_id=kms_key.arn,
    db_name="myapp",
    username="dbadmin",
    password=config.require_secret("db_password"),
    vpc_security_group_ids=[security_group.id],
    db_subnet_group_name=subnet_group.name,
    backup_retention_period=35,
    multi_az=True,
    deletion_protection=True,
    skip_final_snapshot=False,
    final_snapshot_identifier="production-db-final",
    performance_insights_enabled=True,
    performance_insights_retention_period=7,
    monitoring_interval=60,
    enabled_cloudwatch_logs_exports=["postgresql", "upgrade"],
    tags={
        "Environment": "production",
        "Team": "database"
    }
)

# Export values
pulumi.export("db_endpoint", rds_instance.endpoint)
pulumi.export("db_name", rds_instance.db_name)
pulumi.export("db_arn", rds_instance.arn)
```

### Kubernetes + PostgreSQL (2026)

```python
import pulumi
import pulumi_kubernetes as k8s

# Create namespace
ns = k8s.core.v1.Namespace("database",
    metadata={"name": "database"}
)

# Create config map for PostgreSQL configuration
config_map = k8s.core.v1.ConfigMap("postgres-config",
    metadata={
        "name": "postgres-config",
        "namespace": ns.metadata["name"]
    },
    data={
        "postgresql.conf": """
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 64MB
work_mem = 4MB
        """
    }
)

# PostgreSQL StatefulSet
postgres = k8s.apps.v1.StatefulSet("postgres",
    metadata={
        "name": "postgres",
        "namespace": ns.metadata["name"]
    },
    spec={
        "serviceName": "postgres",
        "replicas": 1,
        "selector": {
            "matchLabels": {"app": "postgres"}
        },
        "template": {
            "metadata": {
                "labels": {"app": "postgres"}
            },
            "spec": {
                "containers": [{
                    "name": "postgres",
                    "image": "postgres:16",  # 2026: PostgreSQL 16
                    "ports": [{"containerPort": 5432}],
                    "env": [
                        {"name": "POSTGRES_DB", "value": "myapp"},
                        {"name": "POSTGRES_USER", "value": "dbuser"},
                        {"name": "POSTGRES_PASSWORD", "valueFrom": {
                            "secretKeyRef": {
                                "name": "db-credentials",
                                "key": "password"
                            }
                        }},
                    ],
                    "volumeMounts": [
                        {
                            "name": "data",
                            "mountPath": "/var/lib/postgresql/data"
                        },
                        {
                            "name": "config",
                            "mountPath": "/etc/postgresql/postgresql.conf",
                            "subPath": "postgresql.conf"
                        }
                    ],
                    "resources": {
                        "requests": {
                            "memory": "512Mi",
                            "cpu": "250m"
                        },
                        "limits": {
                            "memory": "1Gi",
                            "cpu": "500m"
                        }
                    },
                    "livenessProbe": {
                        "exec": {
                            "command": ["pg_isready", "-U", "dbuser"]
                        },
                        "initialDelaySeconds": 30,
                        "periodSeconds": 10
                    },
                    "readinessProbe": {
                        "exec": {
                            "command": ["pg_isready", "-U", "dbuser"]
                        },
                        "initialDelaySeconds": 5,
                        "periodSeconds": 5
                    }
                }],
                "volumes": [{
                    "name": "config",
                    "configMap": {
                        "name": config_map.metadata["name"]
                    }
                }]
            }
        },
        "volumeClaimTemplates": [{
            "metadata": {"name": "data"},
            "spec": {
                "accessModes": ["ReadWriteOnce"],
                "resources": {
                    "requests": {"storage": "100Gi"}
                },
                "storageClassName": "gp3"  # 2026: gp3 storage class
            }
        }]
    }
)

# Headless Service
service = k8s.core.v1.Service("postgres",
    metadata={
        "name": "postgres",
        "namespace": ns.metadata["name"]
    },
    spec={
        "selector": {"app": "postgres"},
        "ports": [{"port": 5432, "targetPort": 5432}],
        "type": "ClusterIP",
        "clusterIP": "None"  # Headless for StatefulSet
    }
)
```

## Best Practices 2026

1. **Store State Securely**: Use remote state with encryption (S3 with KMS)
2. **Use Variables**: Don't hardcode credentials or environment-specific values
3. **Version Pinning**: Pin provider and module versions
4. **Immutable Infrastructure**: Recreate instead of modify
5. **Drift Detection**: Regularly run `terraform plan` to detect drift
6. **Module Reuse**: Create reusable modules for common patterns
7. **Tagging**: Consistently tag all resources for cost allocation
8. **Backup State**: Protect state files (they contain sensitive data)
9. **Use gp3 Storage**: AWS gp3 provides better IOPS/cost ratio than gp2
10. **Enable Enhanced Monitoring**: Use Performance Insights and CloudWatch Logs
11. **Use KMS Encryption**: Enable encryption at rest with customer-managed keys
12. **Parameter Groups**: Use custom parameter groups for database tuning
