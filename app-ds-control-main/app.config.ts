export const appVersion = '1.9.2';

export default {
  expo: {
    name: 'DS Control',
    owner: 'dstechbrasil',
    slug: 'dscontrol',
    version: appVersion,
    icon: './assets/images/icon.png',
    scheme: 'appdscontrol',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      url: 'https://u.expo.dev/76717c73-949f-4266-8ad5-792c6d1fbd85',
    },
    runtimeVersion: appVersion,
    platforms: ['ios', 'android'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.dstech.dscontrol',
      orientation: [
        'portrait',
        'landscape',
        'portrait-upside-down',
        'landscape-left',
        'landscape-right',
      ],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['location'],
      },
    },
    android: {
      package: 'com.dstech.dscontrol',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      orientation: 'default',
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
      ],
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/adaptive-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F7FBF3',
        },
      ],
      'expo-font',
      'expo-web-browser',
      [
        'expo-build-properties',
        {
          android: {
            extraGradleProperties: {
              'android.enableV3Lint': 'false',
            },
            lintOptions: {
              checkReleaseBuilds: false,
              abortOnError: false,
            },
          },
        },
      ],
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Permite acessar a localização do usuário para mostrá-la em relação ao mapa da fazenda e dos lotes.',
          locationAlwaysAndWhenInUsePermission:
            'Permite acessar a localização do usuário mesmo quando o app está em segundo plano para agilizar o uso da aplicação mesmo com conectividade fraca.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '76717c73-949f-4266-8ad5-792c6d1fbd85',
      },
    },
  },
};
