import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smintons.app',
  appName: 'SmintonS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
