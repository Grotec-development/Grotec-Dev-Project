import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.grotec.farmeros',
  appName: 'GROTEC FarmerOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'grotec-dev-project-frontend.vercel.app',
    cleartext: true
  }
};

export default config;
