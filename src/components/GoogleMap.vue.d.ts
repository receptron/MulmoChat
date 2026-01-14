import { DefineComponent } from "vue";

declare const GoogleMap: DefineComponent<
  {
    location: string | { lat: number; lng: number };
    apiKey: string | null;
    zoom?: number;
  },
  Record<string, never>,
  unknown
>;

export default GoogleMap;
