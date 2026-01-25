provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "gopang" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "gopang-vpc" }
}

# 인터넷 게이트웨이
resource "aws_internet_gateway" "gopang" {
  vpc_id = aws_vpc.gopang.id
  tags   = { Name = "gopang-igw" }
}

# 퍼블릭 서브넷
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.gopang.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "gopang-public-subnet" }
}

# 프라이빗 서브넷
resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.gopang.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "gopang-private-subnet" }
}

# 퍼블릭 라우팅 테이블
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.gopang.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gopang.id
  }
  tags = { Name = "gopang-public-rt" }
}

# 퍼블릭 서브넷 라우팅 연결
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# VPC Flow Logs
resource "aws_flow_log" "gopang" {
  vpc_id          = aws_vpc.gopang.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/aws/vpc/gopang-flow-logs"
  retention_in_days = 7
}

resource "aws_iam_role" "flow_log" {
  name = "gopang-vpc-flow-log-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "flow_log" {
  name = "gopang-vpc-flow-log-policy"
  role = aws_iam_role.flow_log.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}

# 출력
output "vpc_id" { value = aws_vpc.gopang.id }
output "public_subnet_id" { value = aws_subnet.public.id }
output "private_subnet_id" { value = aws_subnet.private.id }

# EC2 보안 그룹
resource "aws_security_group" "ec2" {
  name        = "gopang-ec2-sg-new"
  description = "Security group for Gopang EC2"
  vpc_id      = aws_vpc.gopang.id

  # SSH (2222)
  ingress {
    from_port   = 2222
    to_port     = 2222
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }

  # HTTPS (443)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # HTTP (80) - HTTPS 리다이렉트용
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP redirect"
  }

  # 내부 통신 (3000 - Backend API)
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Backend API internal"
  }

  # 내부 통신 (8000 - AI Engine)
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "AI Engine internal"
  }

  # 아웃바운드 전체 허용
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "gopang-ec2-sg" }
}

# EFS 보안 그룹
resource "aws_security_group" "efs" {
  name        = "gopang-efs-sg"
  description = "Security group for Gopang EFS"
  vpc_id      = aws_vpc.gopang.id

  # NFS (2049) - EC2에서만 접근
  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "NFS from EC2"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "gopang-efs-sg" }
}

output "ec2_security_group_id" { value = aws_security_group.ec2.id }
output "efs_security_group_id" { value = aws_security_group.efs.id }

# EFS 파일 시스템
resource "aws_efs_file_system" "gopang" {
  creation_token = "gopang-efs"
  encrypted      = true
  
  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = { Name = "gopang-efs" }
}

# EFS 마운트 타겟 (프라이빗 서브넷)
resource "aws_efs_mount_target" "gopang" {
  file_system_id  = aws_efs_file_system.gopang.id
  subnet_id       = aws_subnet.private.id
  security_groups = [aws_security_group.efs.id]
}

# AWS Backup Vault
resource "aws_backup_vault" "gopang" {
  name = "gopang-backup-vault"
}

# AWS Backup Plan
resource "aws_backup_plan" "gopang" {
  name = "gopang-efs-backup-plan"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.gopang.name
    schedule          = "cron(0 17 * * ? *)"  # 매일 KST 02:00 (UTC 17:00)
    
    lifecycle {
      delete_after = 7
    }
  }
}

# IAM Role for Backup
resource "aws_iam_role" "backup" {
  name = "gopang-backup-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

# Backup Selection
resource "aws_backup_selection" "gopang" {
  name         = "gopang-efs-selection"
  plan_id      = aws_backup_plan.gopang.id
  iam_role_arn = aws_iam_role.backup.arn

  resources = [aws_efs_file_system.gopang.arn]
}

output "efs_id" { value = aws_efs_file_system.gopang.id }
output "efs_dns" { value = aws_efs_file_system.gopang.dns_name }
