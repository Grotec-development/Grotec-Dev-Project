import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.grotec.farmeros',
  appName: 'GROTEC FarmerOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Live update source: APK loads directly from live hosted deployment.
    // Pushing updates to your web hosting immediately updates the mobile app without reinstalling APK.
    url: process.env.CAPACITOR_SERVER_URL || 'https://grotec-dev-project-frontend.vercel.app',
    cleartext: true
  }
};

export default config;
