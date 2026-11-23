import { App } from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { ServerStack } from '../lib/server-stack';

const app = new App();
const network = new NetworkStack(app, 'CdkHomeworkNetwork');
new ServerStack(app, 'CdkHomeworkServer', { vpc: network.vpc });
