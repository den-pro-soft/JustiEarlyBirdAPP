const { getParamsFromParameterStore } = require('../helpers/parameterStore');
const { mapAsync } = require('../helpers/mapAsync');
const logger = require('../helpers/logger');

const envVarsNames = require('./envVarsNames');

const defaultConfig = {
  app: {
    port: 8000,
    frontendURL: 'http://localhost:3000',
    trialPeriodLaterPlan: 3,
    pricePerDayLaterPlan: 1500,
  },
  aws: {
    region: 'us-east-1',
    dynamoDBName: 'test_db',
  },
};

const getConfig = () => ({
  database: {
    db_url: process.env.DB_URL,
  },
  app: {
    port: process.env.PORT,
    stripeSecret: process.env.STRIPE_SECRET,
    frontendURL: process.env.FRONTEND_URL,
    jwtSecret: process.env.TOKEN_SECRET,
    monitoringUrl: process.env.MONITORING_URL,
    nowPlanPriceId: process.env.NOW_PLAN_PRICE_ID,
    trialPeriodLaterPlan: process.env.TRIAL_PERIOD_LATER_PLAN,
    pricePerDayLaterPlan: process.env.PRICE_PER_DAY_LATER_PLAN,
    emailFrom: process.env.EMAIL_FROM,
    sendgripApiKey: process.env.SENDGRID_API_KEY,
    trackingId: process.env.TRACKINGID,
  },
  aws: {
    region: process.env.AWS_REGION,
    dynamoDBName: process.env.DYNAMO_DB,
  },
});

const deepMerge = (target, source, override = false) => {
  const nestStack = [[target, source]];

  while (nestStack.length) {
    const [currTarget, currSource] = nestStack.pop();

    Object.entries(currSource).forEach(([key, value]) => {
      if (
        typeof currTarget[key] === 'object' && !Array.isArray(currTarget[key])
        && typeof value === 'object' && !Array.isArray(value)
      ) {
        nestStack.push([currTarget[key], value]);
      } else if (currTarget[key] === undefined || (override && value !== undefined)) {
        currTarget[key] = value;
      }
    });
  }

  return target;
};

const config = deepMerge(getConfig(), defaultConfig);

config.getEnvsFromParameterStore = async () => {
  const recievedParams = [];
  const invalidParams = [];

  // Splitting env variables' names into batches of the size of 10
  const envVarNamesBatches = envVarsNames
    .filter((varName) => !(varName in process.env))
    .reduce((batches, varName, index) => {
      const batchIndex = Math.floor(index / 10);
      if (!batches[batchIndex]) batches.push([]);
      batches[batchIndex].push(varName);
      return batches;
    }, []);

  await mapAsync(envVarNamesBatches, async (namesBatch) => {
    try {
      const parametersBatch = await getParamsFromParameterStore(namesBatch);
      recievedParams.push(...parametersBatch.recievedParams);
      invalidParams.push(...parametersBatch.invalidParams);
    } catch (err) {
      logger.error(`Error on retrieving paremeters from Parameter Store: ${err.message}`);
    }
  });

  recievedParams.forEach((p) => { process.env[p.name.replace(/^\/[^/]+\//, '')] = p.value; });

  deepMerge(config, getConfig(), true);
  config.receivedEnvsFromParameterStore = true;

  return {
    recievedParams: recievedParams.map((p) => p.name),
    invalidParams,
  };
};

module.exports = config;
