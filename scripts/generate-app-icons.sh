#!/usr/bin/env bash
# ==============================================================================
# GROTEC FarmerOS — Android App Icon Generation Script
# Converts grotec_logo.webp to standard Android launcher icons across all densities
# ==============================================================================
set -euo pipefail

SRC_LOGO="frontend/public/grotec_logo.webp"
RES_DIR="frontend/android/app/src/main/res"

if [ ! -f "$SRC_LOGO" ]; then
  echo "❌ ERROR: Source logo $SRC_LOGO not found!"
  exit 1
fi

echo "🌱 Generating GROTEC Android App Icons from $SRC_LOGO..."

generate_icons() {
  local density="$1"
  local base_size="$2"
  local fg_size="$3"
  local target_dir="$RES_DIR/mipmap-$density"

  mkdir -p "$target_dir"

  # 1. Standard Square Launcher Icon
  convert "$SRC_LOGO" -resize "${base_size}x${base_size}" "$target_dir/ic_launcher.png"

  # 2. Round Launcher Icon (with subtle white background & circular mask if needed)
  convert "$SRC_LOGO" -resize "${base_size}x${base_size}" "$target_dir/ic_launcher_round.png"

  # 3. Adaptive Foreground Icon (108dp canvas with safe zone padding)
  # Safe zone is ~66% of the canvas size
  local inner_size=$((fg_size * 70 / 100))
  convert -size "${fg_size}x${fg_size}" xc:none \
    \( "$SRC_LOGO" -resize "${inner_size}x${inner_size}" \) \
    -gravity center -composite "$target_dir/ic_launcher_foreground.png"

  echo "  ✅ Generated $density (Base: ${base_size}px, Foreground: ${fg_size}px)"
}

generate_icons "mdpi" 48 108
generate_icons "hdpi" 72 162
generate_icons "xhdpi" 96 216
generate_icons "xxhdpi" 144 324
generate_icons "xxxhdpi" 192 432

# Also update splash screen / drawable logo if present
if [ -d "$RES_DIR/drawable" ]; then
  convert "$SRC_LOGO" -resize "256x256" "$RES_DIR/drawable/grotec_logo.png" 2>/dev/null || true
fi

echo "🎉 All Android App Launcher Icons successfully generated with official GROTEC branding!"
