export interface Developer {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface SiteKey {
  id: string; // SITE_KEY
  secretKey: string; // SECRET_KEY
  developerId: string;
  name: string;
  domains: string[]; // Allowed hostnames/domains for the widget
  theme: 'light' | 'dark' | 'auto';
  compact: boolean;
  scoreThreshold: number; // Defaults to 70
  createdAt: string;
}

export interface CaptchaLog {
  id: string;
  siteKey: string;
  timestamp: string;
  score: number;
  success: boolean;
  hostname: string;
  ip: string;
  device: string;
  behaviorMetrics: {
    mousePathLength: number;
    mousePointsCount: number;
    speedVariance: number;
    isLinear: boolean;
    mouseJitters: number;
    timeSpentMs: number;
    hadFocus: boolean;
    challengeType?: 'none' | 'puzzle' | 'slider' | 'click_target';
    challengePassed?: boolean;
  };
}

export interface CaptchaState {
  isVerifying: boolean;
  isVerified: boolean;
  error: string | null;
  score: number;
  token: string | null;
  challengeActive: boolean;
}

export function getApiUrl(path: string): string {
  const productionBackend = 'https://ais-pre-kckrycxlhocj4lcjts6v3u-817894283024.asia-east1.run.app';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window === 'undefined') {
    return `${productionBackend}${cleanPath}`;
  }

  const hostname = window.location.hostname;

  // For localhost and active dev environments inside the IDE workspace, use relative paths
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('ais-dev-')
  ) {
    return cleanPath;
  }

  // For the production shared URL, relative path is correct.
  if (hostname.startsWith('ais-pre-') && hostname.endsWith('.run.app')) {
    return cleanPath;
  }

  // For static worker domains (humancheck.vwebapp.workers.dev) and external sites,
  // we must target the production Cloud Run Express API directly.
  return `${productionBackend}${cleanPath}`;
}

