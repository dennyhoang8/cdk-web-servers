# CDK Homework · Website on EC2

The network stack creates a VPC with one public subnet and one private isolated subnet in each of two Availability Zones. The server stack places an Apache web server in each public subnet and puts both behind an internet-facing Application Load Balancer. An Amazon RDS MySQL instance uses both private subnets in its DB subnet group.

| Component | Inbound access |
| --- | --- |
| Load balancer | HTTP on TCP 80 |
| Web servers | HTTP on TCP 80 from any IPv4 address |
| MySQL | TCP 3306 from the web server security group |

Each server returns its own name on the home page so the load balancer can be verified. AWS Secrets Manager generates the database password.

## Build and synthesize

Use Node.js 22 or newer. For AWS commands, use the AWS CLI with an authenticated account and select the region you intend to deploy to. The shell commands below use Bash, which is available in AWS CloudShell and Git Bash.

```bash
npm ci
npm run synth
```

## Deploy

Use the same AWS account and region for deployment, verification, and cleanup. The EC2 instances, ALB, RDS, and supporting resources can incur charges while deployed.

```bash
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION="$AWS_REGION"
aws sts get-caller-identity
npm run cdk -- bootstrap
npm run cdk -- deploy CdkHomeworkNetwork CdkHomeworkServer
```

## Verify

Open the `WebsiteUrl` CloudFormation output in a browser. Run the verification script in the same AWS account and region. It records the stacks, subnets, instances, inbound rules, database, load balancer target health, and HTTP responses. Both instances should be healthy and both names should appear in the requests.

```bash
set -o pipefail
bash scripts/verify-aws.sh | tee verification-output.txt
```

## Clean up

These commands delete the two homework stacks and their database. CDK removes the dependent server stack first. Verify that both stacks show `DELETE_COMPLETE`.

```bash
npm run cdk -- destroy CdkHomeworkServer CdkHomeworkNetwork
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE \
  --query 'StackSummaries[?StackName==`CdkHomeworkServer` || StackName==`CdkHomeworkNetwork`].[StackName,StackStatus,DeletionTime]' \
  --output table | tee -a verification-output.txt
```

The reusable `CDKToolkit` stack can be shared with other CDK projects.

## Publish and submit

From the project directory, with Git and the GitHub CLI installed and Git configured with your name and email, create a new public repository.

```bash
gh auth login
git init -b main
git add .
git commit -m "Build EC2 website and MySQL infrastructure with AWS CDK"
gh repo create cdk-web-servers --public --source=. --push
```

Submit the GitHub URL and the completed verification report on Canvas. Paste the actual terminal output from `verification-output.txt` into the report and summarize what the responses showed.
