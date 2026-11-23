# CDK Homework — Website on EC2

This project uses AWS CDK and TypeScript to deploy two Apache web servers behind an Application Load Balancer and a private Amazon RDS MySQL database.

## Architecture

- **Network stack (`CdkHomeworkNetwork`)** creates a VPC with one public subnet and one isolated private subnet in each of two Availability Zones.
- **Server stack (`CdkHomeworkServer`)** launches one EC2 web server in each public subnet. An internet-facing Application Load Balancer distributes HTTP traffic across both servers. The RDS MySQL subnet group includes both private subnets.

| Component | Inbound access |
| --- | --- |
| Application Load Balancer | TCP 80 from any IPv4 address |
| EC2 web servers | TCP 80 from any IPv4 address |
| RDS MySQL | TCP 3306 only from the web server security group |

Each web server displays its own name on the home page. AWS Secrets Manager generates the database password.

## Build and deploy in AWS CloudShell

Open AWS CloudShell from the AWS Management Console in **US East (N. Virginia)** (`us-east-1`). Confirm that Node.js 22 or newer is available with `node --version`.

```bash
git clone https://github.com/dennyhoang8/cdk-web-servers.git
cd cdk-web-servers

aws sts get-caller-identity
npm ci
npm run synth
npm run cdk -- bootstrap
npm run cdk -- deploy CdkHomeworkNetwork CdkHomeworkServer
```

Review and approve the deployment when prompted. The server stack outputs `WebsiteUrl`, which points to the public load balancer.

## Verify the deployment

Run the verification script from the repository directory while both stacks are deployed.

```bash
set -o pipefail
bash scripts/verify-aws.sh | tee verification-output.txt
```

The AWS deployment in `us-east-1` produced these results:

| Check | Result |
| --- | --- |
| CloudFormation stacks | Both reached `CREATE_COMPLETE` |
| Subnets | One public and one private subnet in each of `us-east-1a` and `us-east-1b` |
| EC2 instances | One running web server in each public subnet |
| Security groups | Web servers allowed public TCP 80. MySQL allowed TCP 3306 only from the web server security group |
| RDS MySQL | `available`, with public access disabled and both private subnets in its subnet group |
| Load balancer targets | Both instances reported `healthy` on port 80 |
| Website responses | All eight requests returned HTTP `200`, with four responses from each web server |

The separate verification report includes the AWS CLI results.

## Clean up AWS resources

After saving the verification output, delete both homework stacks from the same AWS account and region.

```bash
npm run cdk -- destroy CdkHomeworkServer CdkHomeworkNetwork
```

Confirm the deletion when prompted. In the AWS CloudFormation console, check the deleted stacks and verify that both show `DELETE_COMPLETE`.
