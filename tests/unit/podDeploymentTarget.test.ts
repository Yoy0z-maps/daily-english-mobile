const { alignPodDeploymentTargets } = require('../../plugins/withPodDeploymentTarget');

const podfile = `target 'app' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end
`;

it('aligns dependency targets after React Native setup and survives repeated prebuilds', () => {
  const result = alignPodDeploymentTargets(podfile);
  expect(result.indexOf('minimum_target =')).toBeGreaterThan(result.indexOf(':mac_catalyst_enabled'));
  expect(result).toContain("podfile_properties['ios.deploymentTarget']");
  expect(result).toContain('Gem::Version.new(current_target) < minimum_target');
  expect(alignPodDeploymentTargets(result)).toBe(result);
});

it('reports changed Podfile templates instead of silently omitting the fix', () => {
  expect(() => alignPodDeploymentTargets('unsupported template')).toThrow('Cannot locate');
});
