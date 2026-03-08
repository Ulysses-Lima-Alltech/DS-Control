export default {
  cli: {
    version: '>= 16.15.0',
    appVersionSource: 'remote',
  },
  build: {
    development: {
      developmentClient: true,
      distribution: 'internal',
      ios: {
        simulator: true,
      },
    },
    'abstract-production': {
      developmentClient: false,
      distribution: 'store',
    },
    preview: {
      extends: 'abstract-production',
      android: {
        buildType: 'apk',
      },
    },
    production: {
      extends: 'abstract-production',
      credentialsSource: 'remote',
      android: {
        buildType: 'app-bundle',
      },
    },
  },
  submit: {
    production: {
      ios: {
        ascAppId: '6749278332',
      },
    },
  },
};
