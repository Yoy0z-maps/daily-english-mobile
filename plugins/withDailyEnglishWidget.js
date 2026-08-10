const {
  createRunOncePlugin,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject
} = require('@expo/config-plugins');

const { integrateWidget } = require('../scripts/integrate-ios-widget');

const DEFAULT_GROUP_IDENTIFIER = 'group.com.dailyenglish.widget';

const appendUnique = (items, item) => Array.from(new Set([...(items ?? []), item]));

const withDailyEnglishWidget = (config, props = {}) => {
  const groupIdentifier = props.groupIdentifier ?? DEFAULT_GROUP_IDENTIFIER;

  config = withEntitlementsPlist(config, (pluginConfig) => {
    const currentGroups = pluginConfig.modResults['com.apple.security.application-groups'];
    pluginConfig.modResults['com.apple.security.application-groups'] = appendUnique(currentGroups, groupIdentifier);
    return pluginConfig;
  });

  config = withInfoPlist(config, (pluginConfig) => {
    const currentUrlTypes = pluginConfig.modResults.CFBundleURLTypes ?? [];
    const hasDailyEnglishScheme = currentUrlTypes.some((urlType) =>
      (urlType.CFBundleURLSchemes ?? []).includes('dailyenglish')
    );

    if (!hasDailyEnglishScheme) {
      pluginConfig.modResults.CFBundleURLTypes = [
        ...currentUrlTypes,
        {
          CFBundleURLName: 'dailyenglish',
          CFBundleURLSchemes: ['dailyenglish']
        }
      ];
    }

    return pluginConfig;
  });

  config = withXcodeProject(config, (pluginConfig) => {
    integrateWidget(pluginConfig.modResults, pluginConfig.modRequest.projectRoot, {
      developmentTeam: props.developmentTeam,
      groupIdentifier,
      marketingVersion: config.version,
      widgetBundleIdentifier: props.widgetBundleIdentifier
    });
    return pluginConfig;
  });

  return config;
};

module.exports = createRunOncePlugin(withDailyEnglishWidget, 'with-daily-english-widget', '1.0.0');
