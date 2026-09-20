#!/usr/bin/env bash
set -e

# ==============================================================================
# GROTEC FarmerOS — Android CLI Toolchain Bootstrapper
# Sets up portable JDK 21 and Android SDK in user space (~/.android-sdk)
# ==============================================================================

SDK_ROOT="$HOME/.android-sdk"
JDK_DIR="$SDK_ROOT/jdk-21"
CMDLINE_TOOLS_DIR="$SDK_ROOT/cmdline-tools/latest"

mkdir -p "$SDK_ROOT"

echo "=========================================================="
echo "  Setting up Android CLI Toolchain for GROTEC FarmerOS"
echo "=========================================================="
echo ""

# 1. Download & Extract JDK 21 (Temurin LTS)
if [ ! -f "$JDK_DIR/bin/javac" ]; then
  echo "▶ Step 1/4: Downloading Eclipse Temurin OpenJDK 21 (LTS)..."
  mkdir -p "$JDK_DIR"
  curl -fsSL "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_x64_linux_hotspot_21.0.6_7.tar.gz" | tar -xz -C "$JDK_DIR" --strip-components=1
  echo "✔ JDK 21 installed at $JDK_DIR"
else
  echo "✔ JDK 21 already installed."
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"

# 2. Download & Extract Android Command-Line Tools
if [ ! -f "$CMDLINE_TOOLS_DIR/bin/sdkmanager" ]; then
  echo ""
  echo "▶ Step 2/4: Downloading Google Android Command-Line Tools..."
  TMP_ZIP="/tmp/cmdline-tools.zip"
  curl -fsSL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$TMP_ZIP"
  
  TMP_EXTRACT="/tmp/cmdline-tools-extracted"
  rm -rf "$TMP_EXTRACT"
  mkdir -p "$TMP_EXTRACT"
  unzip -q "$TMP_ZIP" -d "$TMP_EXTRACT"
  
  mkdir -p "$SDK_ROOT/cmdline-tools"
  rm -rf "$CMDLINE_TOOLS_DIR"
  mv "$TMP_EXTRACT/cmdline-tools" "$CMDLINE_TOOLS_DIR"
  rm -f "$TMP_ZIP"
  rm -rf "$TMP_EXTRACT"
  echo "✔ Android Command-Line Tools installed at $CMDLINE_TOOLS_DIR"
else
  echo "✔ Android Command-Line Tools already installed."
fi

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$CMDLINE_TOOLS_DIR/bin:$SDK_ROOT/platform-tools:$PATH"

# 3. Accept Licenses
echo ""
echo "▶ Step 3/4: Accepting Android SDK Licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# 4. Install Platforms & Build-Tools
echo ""
echo "▶ Step 4/4: Installing Android Platform 34 and Build-Tools..."
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"

echo ""
echo "=========================================================="
echo "🎉 Android CLI Toolchain Setup Complete!"
echo "   SDK: $SDK_ROOT"
echo "   JDK: $JDK_DIR"
echo "=========================================================="
