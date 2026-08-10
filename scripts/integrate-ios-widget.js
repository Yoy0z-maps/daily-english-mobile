const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const widgetTargetName = 'DailyEnglishWidget';
const defaultWidgetBundleIdentifier = 'com.dailyenglish.sentences.DailyEnglishWidget';
const defaultAppGroup = 'group.com.dailyenglish.widget';

const unquote = (value) => String(value ?? '').replace(/^"|"$/g, '');

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing iOS native template directory: ${source}`);
  }

  fs.rmSync(destination, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function copyTemplates(projectRoot) {
  copyDirectory(
    path.join(projectRoot, 'native/ios/DailyEnglishWidget'),
    path.join(projectRoot, 'ios/DailyEnglishWidget')
  );
  copyDirectory(
    path.join(projectRoot, 'native/ios/DailyEnglishWidgetBridge'),
    path.join(projectRoot, 'ios/DailyEnglishWidgetBridge')
  );
}

function getTargetUuid(project, name) {
  const section = project.pbxNativeTargetSection();
  for (const [uuid, target] of Object.entries(section)) {
    if (target && typeof target === 'object' && unquote(target.name) === name) {
      return uuid;
    }
  }
  return null;
}

function ensureGroup(project, name, groupPath) {
  const existing = project.findPBXGroupKey({ name });
  if (existing) {
    return existing;
  }

  return project.pbxCreateGroup(name, groupPath);
}

function ensureBuildPhase(project, targetUuid, phaseType, comment) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const existing = target.buildPhases.find((phase) => phase.comment === comment);

  if (existing) {
    return existing.value;
  }

  return project.addBuildPhase([], phaseType, comment, targetUuid).uuid;
}

function findFileReference(project, filePath) {
  const fileReferenceSection = project.pbxFileReferenceSection();

  return Object.entries(fileReferenceSection).find(([, entry]) => {
    return entry && typeof entry === 'object' && unquote(entry.path) === filePath;
  });
}

function addSourceOnce(project, filePath, targetUuid, groupUuid) {
  const sourcePhaseUuid = ensureBuildPhase(project, targetUuid, 'PBXSourcesBuildPhase', 'Sources');
  const sourcePhase = project.hash.project.objects.PBXSourcesBuildPhase[sourcePhaseUuid];
  const basename = path.basename(filePath);
  const alreadyInTargetSources = sourcePhase.files.some((file) => file.comment === `${basename} in Sources`);

  if (alreadyInTargetSources) {
    return;
  }

  const buildFileSection = project.pbxBuildFileSection();

  if (project.hasFile(filePath)) {
    const fileRef = findFileReference(project, filePath);

    if (fileRef) {
      const buildFileUuid = project.generateUuid();
      buildFileSection[buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: fileRef[0],
        fileRef_comment: basename
      };
      buildFileSection[`${buildFileUuid}_comment`] = `${basename} in Sources`;
      sourcePhase.files.push({
        value: buildFileUuid,
        comment: `${basename} in Sources`
      });
      return;
    }
  }

  project.addSourceFile(filePath, { target: targetUuid }, groupUuid);
}

function removeSourcesFromOtherTargets(project, fileNames, targetUuidToKeep) {
  const sourcePhases = project.hash.project.objects.PBXSourcesBuildPhase;
  const buildFiles = project.pbxBuildFileSection();
  const keepPhaseUuid = ensureBuildPhase(project, targetUuidToKeep, 'PBXSourcesBuildPhase', 'Sources');

  for (const [phaseUuid, phase] of Object.entries(sourcePhases)) {
    if (!phase || typeof phase !== 'object' || !Array.isArray(phase.files) || phaseUuid === keepPhaseUuid) {
      continue;
    }

    phase.files = phase.files.filter((file) => {
      const buildFile = buildFiles[file.value];
      return !fileNames.includes(buildFile?.fileRef_comment);
    });
  }
}

function addFileRefOnce(project, filePath, groupUuid, options = {}) {
  if (project.hasFile(filePath)) {
    return;
  }

  project.addFile(filePath, groupUuid, options);
}

function updateBuildSettings(project, targetUuid, updater) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const configList = project.pbxXCConfigurationList()[target.buildConfigurationList];

  for (const configRef of configList.buildConfigurations) {
    const config = project.pbxXCBuildConfigurationSection()[configRef.value];
    if (!config || typeof config !== 'object') {
      continue;
    }

    updater(config.buildSettings);
  }
}

function getBuildSetting(project, targetUuid, settingName) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const configList = project.pbxXCConfigurationList()[target.buildConfigurationList];

  for (const configRef of configList.buildConfigurations) {
    const config = project.pbxXCBuildConfigurationSection()[configRef.value];
    const value = config?.buildSettings?.[settingName];

    if (value) {
      return value;
    }
  }

  return null;
}

function addFrameworkOnce(project, frameworkName, targetUuid) {
  const frameworksPhaseUuid = ensureBuildPhase(project, targetUuid, 'PBXFrameworksBuildPhase', 'Frameworks');
  const frameworksPhase = project.hash.project.objects.PBXFrameworksBuildPhase[frameworksPhaseUuid];
  const buildFiles = project.pbxBuildFileSection();
  const alreadyLinked = frameworksPhase.files.some((file) => {
    const buildFile = buildFiles[file.value];
    return buildFile?.fileRef_comment === frameworkName;
  });

  if (!alreadyLinked) {
    project.addFramework(frameworkName, { target: targetUuid, weak: false });
  }
}

function ensureAppEntitlements(projectRoot, groupIdentifier) {
  const entitlementsPath = path.join(projectRoot, 'ios/app/app.entitlements');
  const fallbackEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;

  if (!fs.existsSync(entitlementsPath)) {
    fs.mkdirSync(path.dirname(entitlementsPath), { recursive: true });
    fs.writeFileSync(entitlementsPath, fallbackEntitlements);
  }

  const entitlements = fs.readFileSync(entitlementsPath, 'utf8');

  if (!entitlements.includes(groupIdentifier)) {
    const updated = entitlements.replace(
      '</dict>',
      `  <key>com.apple.security.application-groups</key>
  <array>
    <string>${groupIdentifier}</string>
  </array>
</dict>`
    );
    fs.writeFileSync(entitlementsPath, updated);
  }
}

function integrateWidget(project, projectRoot, options = {}) {
  copyTemplates(projectRoot);

  const groupIdentifier = options.groupIdentifier ?? defaultAppGroup;
  const marketingVersion = options.marketingVersion ?? '1.0.0';
  const widgetBundleIdentifier = options.widgetBundleIdentifier ?? defaultWidgetBundleIdentifier;
  const appTargetUuid = project.getFirstTarget().uuid;
  const bridgeGroupUuid = ensureGroup(project, 'DailyEnglishWidgetBridge', 'DailyEnglishWidgetBridge');

  addSourceOnce(project, 'DailyEnglishWidgetBridge/DailyEnglishWidgetBridge.swift', appTargetUuid, bridgeGroupUuid);
  addSourceOnce(project, 'DailyEnglishWidgetBridge/DailyEnglishWidgetBridge.m', appTargetUuid, bridgeGroupUuid);

  updateBuildSettings(project, appTargetUuid, (settings) => {
    settings.CODE_SIGN_ENTITLEMENTS = 'app/app.entitlements';
    settings.SWIFT_OBJC_BRIDGING_HEADER = 'app/app-Bridging-Header.h';
  });

  const configuredDevelopmentTeam = options.developmentTeam ?? process.env.APPLE_TEAM_ID ?? null;
  const appDevelopmentTeam = getBuildSetting(project, appTargetUuid, 'DEVELOPMENT_TEAM') ?? configuredDevelopmentTeam;
  const appCodeSignStyle = getBuildSetting(project, appTargetUuid, 'CODE_SIGN_STYLE');

  if (configuredDevelopmentTeam) {
    updateBuildSettings(project, appTargetUuid, (settings) => {
      settings.DEVELOPMENT_TEAM = configuredDevelopmentTeam;
    });
  }

  let widgetTargetUuid = getTargetUuid(project, widgetTargetName);
  if (!widgetTargetUuid) {
    const target = project.addTarget(widgetTargetName, 'app_extension', widgetTargetName, widgetBundleIdentifier);
    widgetTargetUuid = target.uuid;
  }

  const widgetGroupUuid = ensureGroup(project, widgetTargetName, widgetTargetName);
  const widgetSourceFiles = [
    'DailyEnglishWidget/DailyEnglishWidget.swift',
    'DailyEnglishWidget/DailyEnglishWidgetBundle.swift',
    'DailyEnglishWidget/WidgetExpression.swift',
    'DailyEnglishWidget/WidgetDataProvider.swift'
  ];

  removeSourcesFromOtherTargets(
    project,
    widgetSourceFiles.map((filePath) => path.basename(filePath)),
    widgetTargetUuid
  );
  widgetSourceFiles.forEach((filePath) => addSourceOnce(project, filePath, widgetTargetUuid, widgetGroupUuid));

  addFileRefOnce(project, 'DailyEnglishWidget/DailyEnglishWidget-Info.plist', widgetGroupUuid, {
    lastKnownFileType: 'text.plist.xml'
  });
  addFileRefOnce(project, 'DailyEnglishWidget/DailyEnglishWidget.entitlements', widgetGroupUuid, {
    lastKnownFileType: 'text.plist.entitlements'
  });

  addFrameworkOnce(project, 'WidgetKit.framework', widgetTargetUuid);
  addFrameworkOnce(project, 'SwiftUI.framework', widgetTargetUuid);

  updateBuildSettings(project, widgetTargetUuid, (settings) => {
    settings.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = 'AccentColor';
    if (appCodeSignStyle) {
      settings.CODE_SIGN_STYLE = appCodeSignStyle;
    }
    settings.CODE_SIGN_ENTITLEMENTS = 'DailyEnglishWidget/DailyEnglishWidget.entitlements';
    settings.CURRENT_PROJECT_VERSION = '1';
    if (appDevelopmentTeam) {
      settings.DEVELOPMENT_TEAM = appDevelopmentTeam;
    }
    settings.GENERATE_INFOPLIST_FILE = 'NO';
    settings.INFOPLIST_FILE = 'DailyEnglishWidget/DailyEnglishWidget-Info.plist';
    settings.IPHONEOS_DEPLOYMENT_TARGET = '16.0';
    settings.MARKETING_VERSION = marketingVersion;
    settings.PRODUCT_BUNDLE_IDENTIFIER = widgetBundleIdentifier;
    settings.PRODUCT_NAME = 'DailyEnglishWidget';
    settings.SKIP_INSTALL = 'YES';
    settings.SWIFT_VERSION = '5.0';
  });

  ensureAppEntitlements(projectRoot, groupIdentifier);
}

if (require.main === module) {
  const root = process.cwd();
  const pbxPath = path.join(root, 'ios/app.xcodeproj/project.pbxproj');
  const project = xcode.project(pbxPath);

  project.parseSync();
  integrateWidget(project, root);
  fs.writeFileSync(pbxPath, project.writeSync());
  console.log(`Integrated ${widgetTargetName} target and native bridge.`);
}

module.exports = {
  copyTemplates,
  integrateWidget
};
