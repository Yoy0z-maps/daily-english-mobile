const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const PROVIDERS = [
  ['DailyEnglishWidgetProvider', '', 'daily_english_widget_name'],
  ['DailyEnglishCircularWidgetProvider', '_circular', 'daily_english_widget_circular_name'],
  ['DailyEnglishRectangularWidgetProvider', '_rectangular', 'daily_english_widget_rectangular_name'],
  ['DailyEnglishInlineWidgetProvider', '_inline', 'daily_english_widget_inline_name']
];

module.exports = function withAndroidDailyEnglishWidget(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    const names = PROVIDERS.map(([name]) => `com.dailyenglish.widget.${name}`);
    app.receiver = (app.receiver ?? []).filter((item) => !names.includes(item.$['android:name']));
    for (const [name, suffix, label] of PROVIDERS) {
      const PROVIDER = `com.dailyenglish.widget.${name}`;
      app.receiver.push({
        $: { 'android:name': PROVIDER, 'android:exported': 'false', 'android:label': `@string/${label}` },
        'intent-filter': [{ action: [
          'android.appwidget.action.APPWIDGET_UPDATE', 'android.intent.action.DATE_CHANGED',
          'android.intent.action.TIME_SET', 'android.intent.action.TIMEZONE_CHANGED'
        ].map((name) => ({ $: { 'android:name': name } })) }],
        'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': `@xml/daily_english_widget${suffix}_info` } }]
      });
    }
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    const registration = 'add(com.dailyenglish.widget.DailyEnglishWidgetPackage())';
    if (!mod.modResults.contents.includes(registration)) {
      const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!anchor.test(mod.modResults.contents)) throw new Error('Cannot register Android widget package in MainApplication');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, (match) => `${match}\n          ${registration}`);
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const source = path.join(mod.modRequest.projectRoot, 'native/android/widget');
    const main = path.join(mod.modRequest.platformProjectRoot, 'app/src/main');
    const java = path.join(main, 'java/com/dailyenglish/widget');
    fs.mkdirSync(java, { recursive: true });
    for (const file of ['DailyEnglishWidgetProvider.kt', 'DailyEnglishWidgetPackage.kt']) {
      const contents = fs.readFileSync(path.join(source, file), 'utf8')
        .replace('import com.dailyenglish.sentences.R', `import ${mod.android.package}.R`);
      fs.writeFileSync(path.join(java, file), contents);
    }
    fs.cpSync(path.join(source, 'res'), path.join(main, 'res'), { recursive: true });
    return mod;
  }]);
};
