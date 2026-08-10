const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] ?? '/private/tmp/dailyenglish-ios-build');
const shouldSkipPods = process.argv.includes('--skip-pods');

const run = (command, args, cwd) => {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit'
  });
};

const ensureAsciiPath = (value) => {
  if (!/^[\x00-\x7F]+$/.test(value)) {
    throw new Error(`The iOS build copy path must be ASCII-only: ${value}`);
  }
};

ensureAsciiPath(destination);

fs.rmSync(destination, { force: true, recursive: true });
fs.mkdirSync(destination, { recursive: true });

run(
  'rsync',
  [
    '-a',
    '--delete',
    "--exclude=.git",
    "--exclude=ios/Pods",
    "--exclude=ios/build",
    "--exclude=ios/Podfile.lock",
    "--exclude=android/.gradle",
    "--exclude=android/app/build",
    `${projectRoot}/`,
    `${destination}/`
  ],
  projectRoot
);

run('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install'], destination);

if (!shouldSkipPods) {
  run('pod', ['install'], path.join(destination, 'ios'));
}

console.log(`\nPrepared iOS build copy: ${destination}`);
console.log(`Open in Xcode: ${path.join(destination, 'ios/app.xcworkspace')}`);
console.log('For widget-only compile check:');
console.log(
  `xcodebuild -project ${path.join(destination, 'ios/app.xcodeproj')} -scheme DailyEnglishWidget -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
);
