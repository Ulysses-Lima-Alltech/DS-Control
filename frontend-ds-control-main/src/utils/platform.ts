function isBrowserFunction() {
  return typeof window !== 'undefined';
}

export const isBrowser = isBrowserFunction();

export type Platform = 'web' | 'ios' | 'android' | 'unknown';

export interface PlatformInfo {
  platform: Platform;
  deepLink: string;
  accessUrl: string;
}

export async function getPlatform(): Promise<PlatformInfo> {
  if (!isBrowser) {
    return {
      platform: 'unknown',
      deepLink: '',
      accessUrl: 'https://backoffice.dstechbrasil.com.br/auth/login',
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return {
      platform: 'ios',
      deepLink: 'appdscontrol://',
      accessUrl: 'https://apps.apple.com/br/app/ds-control/id6749278332',
    };
  }

  if (/android/.test(userAgent)) {
    return {
      platform: 'android',
      deepLink: 'appdscontrol://',
      accessUrl: 'https://play.google.com/store/apps/details?id=com.dstech.dscontrol',
    };
  }

  return {
    platform: 'web',
    deepLink: '',
    accessUrl: 'https://backoffice.dstechbrasil.com.br/auth/login',
  };
}

export async function isMobile(): Promise<boolean> {
  const platformInfo = await getPlatform();
  return platformInfo.platform === 'ios' || platformInfo.platform === 'android';
}
