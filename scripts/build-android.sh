#!/usr/bin/env bash
set -e

# ==============================================================================
# GROTEC FarmerOS — Android & Tablet App Build Automation
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
echo "  GROTEC FarmerOS — Building Android Mobile & Tablet App"
echo "=========================================================="
echo ""

echo "▶ Step 1: Building production web assets..."
cd "$PROJECT_ROOT"
VITE_API_BASE_URL="https://grotec-dev-project.onrender.com/api/v1" npm run build:frontend

echo ""
echo "▶ Step 2: Synchronizing web assets with Capacitor Android..."
cd "$FRONTEND_DIR"
npx cap sync android

echo ""
echo "▶ Step 3: Checking Android build toolchain..."
if [ -d "$ANDROID_DIR" ]; then
  cd "$ANDROID_DIR"
  if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ] || [ -d "$HOME/Android/Sdk" ] || [ -d "$HOME/.android-sdk" ]; then
    echo "✔ Android SDK detected at ${ANDROID_HOME:-$HOME/.android-sdk}"
    if [ -n "$JAVA_HOME" ]; then
      echo "✔ Using JDK: $JAVA_HOME"
    fi
    echo "▶ Compiling Debug APK via Gradle..."
    ./gradlew assembleDebug --no-daemon
    
    APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_PATH" ]; then
      cp "$APK_PATH" "$PROJECT_ROOT/grotec-farmeros.apk"
      cp "$APK_PATH" "$FRONTEND_DIR/public/grotec-farmeros.apk"
      echo ""
      echo "=========================================================="
      echo "🎉 SUCCESS! Android APK generated successfully:"
      echo "   $PROJECT_ROOT/grotec-farmeros.apk"
      echo "=========================================================="
      echo ""
      echo "To install on an Android phone or tablet:"
      echo "  1. Connect your phone via USB with USB Debugging enabled, and run:"
      echo "     adb install -r \"$APK_PATH\""
      echo "  2. Or download directly over Wi-Fi from:"
      echo "     http://<YOUR_LOCAL_IP>:8080/grotec-farmeros.apk"
      echo ""
      exit 0
    fi
  else
    echo "ℹ No local Android SDK detected."
    echo "  You have two quick options:"
    echo "  Option 1 (Command Line): Run ./scripts/setup-android-cli.sh"
    echo "  Option 2 (Android Studio): Run npx cap open android from frontend/"
  fi
fi

echo ""
echo "=========================================================="
echo "✔ Mobile & Tablet assets prepared and synchronized."
echo "=========================================================="
