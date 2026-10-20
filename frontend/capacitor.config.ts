import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.grotec.farmeros',
  appName: 'GROTEC FarmerOS',
  webDir: 'dist',
  backgroundColor: '#f8faf9',
  server: {
    androidScheme: 'https',
    cleartext: true,
    ...(process.env.CAPACITOR_SERVER_URL ? { url: process.env.CAPACITOR_SERVER_URL } : {}),
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
