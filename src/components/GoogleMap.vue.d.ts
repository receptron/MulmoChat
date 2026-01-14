import { DefineComponent } from "vue";

declare const GoogleMap: DefineComponent<
  {
    googleMapKey: string | null;
    lat: number;
    lng: number;
    zoom?: number;
    markers?: Array<{ lat: number; lng: number; label?: string }>;
  },
  Record<string, never>,
  unknown
>;

export default GoogleMap;
