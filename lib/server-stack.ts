import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as targets,
  aws_rds as rds,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface ServerStackProps extends StackProps {
  readonly vpc: ec2.IVpc;
}

export class ServerStack extends Stack {
  constructor(scope: Construct, id: string, props: ServerStackProps) {
    super(scope, id, props);
    const { vpc } = props;

    const webSecurityGroup = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc,
      description: 'Allow public HTTP to the web servers for the CDK homework',
    });
    webSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Allow MySQL from the web servers',
    });
    databaseSecurityGroup.addIngressRule(webSecurityGroup, ec2.Port.tcp(3306));

    const webServers = vpc.publicSubnets.map((subnet, index) => {
      const serverName = `WebServer${index + 1}`;
      const userData = ec2.UserData.forLinux();
      userData.addCommands(
        'set -euo pipefail',
        'dnf -y install httpd',
        `printf '%s\\n' '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CDK Homework</title></head><body><h1>CDK Homework</h1><p>Served by ${serverName}</p></body></html>' > /var/www/html/index.html`,
        'systemctl enable --now httpd',
      );

      return new ec2.Instance(this, serverName, {
        vpc,
        vpcSubnets: { subnets: [subnet] },
        associatePublicIpAddress: true,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        machineImage: ec2.MachineImage.latestAmazonLinux2023(),
        requireImdsv2: true,
        securityGroup: webSecurityGroup,
        userData,
      });
    });

    const database = new rds.DatabaseInstance(this, 'MySql', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_4_7 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromGeneratedSecret('dbadmin'),
      allocatedStorage: 20,
      storageEncrypted: true,
      publiclyAccessible: false,
      securityGroups: [databaseSecurityGroup],
      multiAz: false,
      backupRetention: Duration.days(0),
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const loadBalancerSecurityGroup = new ec2.SecurityGroup(this, 'LoadBalancerSecurityGroup', {
      vpc,
      description: 'Permit the load balancer to reach the web servers',
      allowAllOutbound: false,
    });
    loadBalancerSecurityGroup.addEgressRule(webSecurityGroup, ec2.Port.tcp(80));

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      internetFacing: true,
      securityGroup: loadBalancerSecurityGroup,
    });
    const listener = loadBalancer.addListener('Http', { port: 80, open: true });
    const targetGroup = listener.addTargets('WebServers', {
      port: 80,
      targets: webServers.map((server) => new targets.InstanceTarget(server)),
      healthCheck: { path: '/', healthyHttpCodes: '200' },
    });

    new CfnOutput(this, 'WebsiteUrl', { value: `http://${loadBalancer.loadBalancerDnsName}` });
    new CfnOutput(this, 'TargetGroupArn', { value: targetGroup.targetGroupArn });
    new CfnOutput(this, 'DatabaseIdentifier', { value: database.instanceIdentifier });
    new CfnOutput(this, 'WebSecurityGroupId', { value: webSecurityGroup.securityGroupId });
    new CfnOutput(this, 'DatabaseSecurityGroupId', { value: databaseSecurityGroup.securityGroupId });
    new CfnOutput(this, 'VpcId', { value: vpc.vpcId });
  }
}
