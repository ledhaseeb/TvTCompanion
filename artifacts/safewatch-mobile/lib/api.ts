const API_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:5000";

export function getApiUrl(): string {
  return API_URL;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
