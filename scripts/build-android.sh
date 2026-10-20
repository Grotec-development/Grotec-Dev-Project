#!/usr/bin/env bash
set -e

# ==============================================================================
# GROTEC FarmerOS — Android APK Build & Optimization Script
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"

# Detect custom user-space Android CLI SDK & JDK 21
if [ -d "$HOME/.android-sdk/jdk-21" ]; then
  export JAVA_HOME="$HOME/.android-sdk/jdk-21"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [ -d "$HOME/.android-sdk" ]; then
  export ANDROID_HOME="$HOME/.android-sdk"
  export ANDROID_SDK_ROOT="$HOME/.android-sdk"
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
fi

echo "=========================================================="
echo "  GROTEC FarmerOS — Building Optimized Mobile APK"
echo "=========================================================="
echo "✔ Java Home: ${JAVA_HOME:-$(which java)}"
echo "✔ Android SDK: ${ANDROID_HOME:-$HOME/.android-sdk}"
echo ""

# 1. Clean any duplicate APK in public/ to avoid recursive bundling
echo "▶ Step 1: Cleaning previous bundle artifacts..."
rm -f "$FRONTEND_DIR/public/grotec-farmeros.apk"
rm -f "$ANDROID_DIR/app/src/main/assets/public/grotec-farmeros.apk"

# 2. Build shared library and web assets
echo "▶ Step 2: Compiling shared packages and production web assets..."
cd "$PROJECT_ROOT"
npm run build:shared

cd "$FRONTEND_DIR"
VITE_API_BASE_URL="https://grotec-dev-project.onrender.com/api/v1" npm run build

# Ensure no .apk or .map was copied into dist
rm -f "$FRONTEND_DIR/dist/grotec-farmeros.apk"
rm -f "$FRONTEND_DIR/dist/"*.map

# 3. Synchronize with Capacitor Android
echo "▶ Step 3: Synchronizing web assets with Capacitor Android..."
npx cap sync android

# Ensure assets directory in Android app is clean of any nested APKs
rm -f "$ANDROID_DIR/app/src/main/assets/public/grotec-farmeros.apk"

# 4. Compile standard Android APK via Gradle
echo "▶ Step 4: Compiling complete Android APK with Gradle..."
cd "$ANDROID_DIR"

./gradlew assembleDebug --no-daemon

DEBUG_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
FINAL_APK="$DEBUG_APK"

if [ -f "$FINAL_APK" ]; then
  cp "$FINAL_APK" "$PROJECT_ROOT/grotec-farmeros.apk"
  cp "$FINAL_APK" "$FRONTEND_DIR/dist/grotec-farmeros.apk" 2>/dev/null || true
  
  APK_SIZE=$(du -h "$PROJECT_ROOT/grotec-farmeros.apk" | cut -f1)
  APK_BYTES=$(wc -c < "$PROJECT_ROOT/grotec-farmeros.apk")

  echo ""
  echo "=========================================================="
  echo "🎉 SUCCESS! New Optimized APK generated successfully:"
  echo "   Location: $PROJECT_ROOT/grotec-farmeros.apk"
  echo "   Size: $APK_SIZE ($APK_BYTES bytes)"
  echo "=========================================================="
  echo ""
  echo "Installation commands:"
  echo "  USB adb: PATH=\"$HOME/.android-sdk/platform-tools:\$PATH\" adb install -r \"$PROJECT_ROOT/grotec-farmeros.apk\""
  echo "=========================================================="
  exit 0
else
  echo "❌ Error: Could not find generated APK."
  exit 1
fi
