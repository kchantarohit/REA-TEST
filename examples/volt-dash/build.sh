#!/usr/bin/env bash
# Build Volt Dash end to end: web bundle -> single offline index.html -> signed APK.
# Output: out/volt-dash.apk. Needs node/npm, a JDK, and Android build tools on PATH
# (aapt v1, dalvik-exchange, zipalign, apksigner, keytool).
set -euo pipefail
cd "$(dirname "$0")"

ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
BUILD=build
OUT=out
APK="$OUT/volt-dash.apk"
KEYSTORE=android/debug.keystore
KS_PASS=android # debug-only key, safe to commit

step() { printf '\n==> %s\n' "$*"; }

step "npm install (local, pinned)"
npm install --no-audit --no-fund --loglevel=error

step "esbuild bundle (single IIFE)"
rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$OUT" android/assets
./node_modules/.bin/esbuild src/main.js --bundle --format=iife --minify --target=es2020 \
  --outfile="$BUILD/game.js" --log-level=warning

step "inline into android/assets/index.html"
node scripts/inline.mjs src/index.html "$BUILD/game.js" android/assets/index.html

step "self-check (pattern generator)"
node scripts/selfcheck.mjs

if [ ! -f android/res/mipmap-xxxhdpi/ic_launcher.png ]; then
  step "render launcher icons"
  node scripts/make-icon.mjs
fi

step "javac (Java 8 bytecode for dx)"
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD/classes" android/src/com/reatest/voltdash/MainActivity.java

step "dx"
dalvik-exchange --dex --min-sdk-version=21 --output="$BUILD/classes.dex" "$BUILD/classes"

step "aapt package (resources.arsc stored uncompressed)"
aapt package -f -0 arsc -M android/AndroidManifest.xml -S android/res -A android/assets \
  -I "$ANDROID_JAR" -F "$BUILD/unaligned.apk"
(cd "$BUILD" && aapt add unaligned.apk classes.dex >/dev/null)

step "zipalign"
zipalign -p -f 4 "$BUILD/unaligned.apk" "$BUILD/aligned.apk"

step "sign (v1 + v2 + v3)"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -noprompt -keystore "$KEYSTORE" -storetype PKCS12 -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Volt Dash Debug,O=Debug,C=US"
fi
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --ks-key-alias androiddebugkey \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$APK" "$BUILD/aligned.apk"
rm -f "$APK.idsig"

step "verify"
zipalign -c -p 4 "$APK"
# (no grep -q / head here: closing the pipe early trips pipefail via SIGPIPE)
unzip -v "$APK" resources.arsc | grep ' Stored ' || { echo "resources.arsc must be stored uncompressed" >&2; exit 1; }
apksigner verify --min-sdk-version 21 "$APK"
aapt dump badging "$APK" | sed -n 1p
ls -l "$APK"
echo "OK: $APK"
