# AWS CDK Homework — Website on EC2

This TypeScript CDK project deploys two Apache web servers behind a public Application Load Balancer and a private Amazon RDS MySQL instance.

## Architecture

- [CdkHomeworkNetwork](lib/network-stack.ts) creates a VPC with one public subnet and one isolated private subnet in each of two Availability Zones.
- [CdkHomeworkServer](lib/server-stack.ts) places one EC2 web server in each public subnet, registers both with the load balancer, and creates an RDS MySQL subnet group that spans both private subnets.

| Component | Inbound access |
| --- | --- |
| Application Load Balancer | TCP 80 from any IPv4 address |
| EC2 web servers | TCP 80 from any IPv4 address |
| RDS MySQL | TCP 3306 from the web servers' security group only |

Each web server displays its name on the home page. AWS Secrets Manager generates the MySQL password.

## Deployment results

I deployed both stacks to `us-east-1` using the AWS CDK CLI from Windows PowerShell. Both stacks reached `CREATE_COMPLETE`.

The [verification script](scripts/verify-aws.sh) confirmed the subnet layout, one running EC2 web server in each public subnet, and an available MySQL instance with public access disabled. It also checked the web and database security group rules.

Both load balancer targets were healthy on port 80. All eight HTTP requests returned `200`, with four responses from `WebServer1` and four from `WebServer2`. The separate verification report contains the AWS CLI results.

## Reproduce in AWS CloudShell

Open AWS CloudShell in **US East (N. Virginia)** and use Node.js 22 or newer.

```bash
git clone https://github.com/dennyhoang8/cdk-web-servers.git
cd cdk-web-servers

export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

npm ci
npm run synth
npm run cdk -- bootstrap
npm run cdk -- deploy CdkHomeworkNetwork CdkHomeworkServer
```

The server stack prints `WebsiteUrl` after deployment. While both stacks are active, run the verification script to check the AWS resources and test the website.

```bash
set -o pipefail
bash scripts/verify-aws.sh | tee verification-output.txt
```

## Clean up

After saving the verification output, delete both homework stacks from the same AWS account and region.

```bash
npm run cdk -- destroy CdkHomeworkServer CdkHomeworkNetwork
```

Confirm that both stacks reach `DELETE_COMPLETE` in AWS CloudFormation.
