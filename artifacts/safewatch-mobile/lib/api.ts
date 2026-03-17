function resolveApiUrl(): string {
  if (__DEV__ && process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }

  return (
    process.env.EXPO_PUBLIC_API_URL ||
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "http://localhost:5000")
  );
}

const API_URL = resolveApiUrl();

export function getApiUrl(): string {
  return API_URL;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
