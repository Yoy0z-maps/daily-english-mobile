const devApiBaseUrl = process.env.EXPO_PUBLIC_DEV_API_BASE_URL;
const prodApiBaseUrl = process.env.EXPO_PUBLIC_PROD_API_BASE_URL;

if (!devApiBaseUrl || !prodApiBaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_DEV_API_BASE_URL / EXPO_PUBLIC_PROD_API_BASE_URL must be set",
  );
}

export const API_BASE = __DEV__ ? devApiBaseUrl : prodApiBaseUrl;
