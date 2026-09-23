const { withPodfile } = require('@expo/config-plugins');

const marker = '# daily-english: align Pod deployment targets';

function alignPodDeploymentTargets(contents) {
  if (contents.includes(marker)) return contents;
  const anchor = /    react_native_post_install\([\s\S]*?\n    \)/;
  if (!anchor.test(contents)) {
    throw new Error('Cannot locate react_native_post_install to align Pod deployment targets.');
  }
  return contents.replace(anchor, (match) => `${match}

    ${marker}
    minimum_target = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '17.0')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_target.nil? || Gem::Version.new(current_target) < minimum_target
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_target.to_s
        end
      end
    end`);
}

module.exports = (config) => withPodfile(config, (result) => {
  result.modResults.contents = alignPodDeploymentTargets(result.modResults.contents);
  return result;
});
module.exports.alignPodDeploymentTargets = alignPodDeploymentTargets;
