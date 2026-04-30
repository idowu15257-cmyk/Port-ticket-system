const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const filesToPatch = [
  'android/app/capacitor.build.gradle',
  'android/capacitor-cordova-android-plugins/build.gradle',
  'node_modules/@capacitor/android/capacitor/build.gradle',
  'node_modules/@capacitor/camera/android/build.gradle',
  'node_modules/@capacitor/filesystem/android/build.gradle',
  'node_modules/@capacitor/push-notifications/android/build.gradle',
  'node_modules/@capacitor/share/android/build.gradle',
  'node_modules/@capacitor/cli/dist/android/update.js'
];

function patchFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    console.log(`[java17] skipped (missing): ${relativePath}`);
    return;
  }

  const original = fs.readFileSync(absolutePath, 'utf8');
  const updated = original
    .replace(/JavaVersion\\.VERSION_21/g, 'JavaVersion.VERSION_17')
    .replace(/JavaVersion\\.toVersion\\(21\\)/g, 'JavaVersion.toVersion(17)');

  if (updated !== original) {
    fs.writeFileSync(absolutePath, updated, 'utf8');
    console.log(`[java17] patched: ${relativePath}`);
  } else {
    console.log(`[java17] ok: ${relativePath}`);
  }
}

filesToPatch.forEach(patchFile);
