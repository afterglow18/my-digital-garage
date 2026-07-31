import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalgarage.app',
  appName: 'My Garage',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents flash on launch — matches dark garage door splash
    backgroundColor: '#0d0d0d',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // Privacy usage descriptions — all three are required by iOS/TCC
    infoPlist: {
      NSCameraUsageDescription:
        'My Digital Garage uses your camera to photograph items for your garage.',
      NSPhotoLibraryUsageDescription:
        'My Digital Garage reads your photo library so you can add images from your photos.',
      NSPhotoLibraryAddUsageDescription:
        'My Digital Garage saves captured photos to your photo library.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F9F4EE',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F9F4EE',
      overlaysWebView: true,
    },
  },
};

export default config;
