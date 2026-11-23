#!/usr/bin/env bash
set -euo pipefail

export AWS_PAGER=""
stack=CdkHomeworkServer

output() {
  aws cloudformation describe-stacks --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text
}

url=$(output WebsiteUrl)
target_group=$(output TargetGroupArn)
database=$(output DatabaseIdentifier)
vpc=$(output VpcId)
web_sg=$(output WebSecurityGroupId)
db_sg=$(output DatabaseSecurityGroupId)

printf '\n## CloudFormation stacks\n'
for name in CdkHomeworkNetwork "$stack"; do
  aws cloudformation describe-stacks --stack-name "$name" \
    --query 'Stacks[0].{Stack:StackName,Status:StackStatus}' --output table
done

printf '\n## VPC subnets\n'
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc" \
  --query 'Subnets[].{ID:SubnetId,AZ:AvailabilityZone,PublicIPOnLaunch:MapPublicIpOnLaunch}' --output table

printf '\n## Web instances\n'
aws ec2 describe-instances --filters "Name=instance.group-id,Values=$web_sg" 'Name=instance-state-name,Values=running' \
  --query 'Reservations[].Instances[].{ID:InstanceId,AZ:Placement.AvailabilityZone,Subnet:SubnetId}' --output table

printf '\n## Security group ingress\n'
aws ec2 describe-security-group-rules --filters "Name=group-id,Values=$web_sg,$db_sg" \
  --query 'SecurityGroupRules[?IsEgress==`false`].{Group:GroupId,Protocol:IpProtocol,FromPort:FromPort,ToPort:ToPort,CIDR:CidrIpv4,SourceGroup:ReferencedGroupInfo.GroupId}' --output table

printf '\n## RDS database and its subnets\n'
aws rds describe-db-instances --db-instance-identifier "$database" \
  --query 'DBInstances[0].{Engine:Engine,Status:DBInstanceStatus,Public:PubliclyAccessible,Subnets:DBSubnetGroup.Subnets[].SubnetIdentifier}' --output json

printf '\n## ALB target health\n'
aws elbv2 wait target-in-service --target-group-arn "$target_group"
aws elbv2 describe-target-health --target-group-arn "$target_group" \
  --query 'TargetHealthDescriptions[].{Instance:Target.Id,Port:Target.Port,State:TargetHealth.State}' --output table

printf '\n## HTTP responses from %s\n' "$url"
for ((attempt = 1; attempt <= 8; attempt++)); do
  curl --fail --silent --show-error --max-time 15 \
    --write-out 'HTTP %{http_code}\n' "$url/" |
    sed -nE 's/.*<p>(Served by [^<]+)<\/p>.*/\1/p; /^HTTP /p'
done
