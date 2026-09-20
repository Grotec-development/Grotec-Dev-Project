#!/usr/bin/env bash
set -e

# ==============================================================================
# GROTEC FarmerOS — Android & Tablet App Build Automation
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"

echo "=========================================================="
echo "  GROTEC FarmerOS — Building Android Mobile & Tablet App"
echo "=========================================================="
echo ""

echo "▶ Step 1: Building production web assets..."
cd "$PROJECT_ROOT"
npm run build:frontend

echo ""
echo "▶ Step 2: Synchronizing web assets with Capacitor Android..."
cd "$FRONTEND_DIR"
npx cap sync android

echo ""
echo "▶ Step 3: Checking Android build toolchain..."
if [ -d "$ANDROID_DIR" ]; then
  cd "$ANDROID_DIR"
  if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ] || [ -d "$HOME/Android/Sdk" ]; then
    echo "✔ Android SDK detected. Compiling Debug APK..."
    export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
    export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
    ./gradlew assembleDebug --no-daemon
    
    APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_PATH" ]; then
      echo ""
      echo "🎉 Build Complete! Android APK generated successfully at:"
      echo "   $APK_PATH"
      echo ""
      echo "Install on any connected phone/tablet via ADB:"
      echo "   adb install -r \"$APK_PATH\""
      exit 0
    fi
  else
    echo "ℹ No local Android SDK found in default paths."
    echo "  To build the APK on your machine or in Android Studio:"
    echo "  1. Open Android Studio and select the folder:"
    echo "     $ANDROID_DIR"
    echo "  2. Or run: npx cap open android (from frontend/ directory)"
    echo "  3. Click 'Build' > 'Build Bundle(s) / APK(s)' > 'Build APK(s)'"
  fi
fi

echo ""
echo "=========================================================="
echo "✔ Mobile & Tablet assets prepared and synchronized."
echo "=========================================================="
