import { DefineComponent } from "vue";

declare const GoogleMap: DefineComponent<
  {
    googleMapKey: string | null;
    lat: number;
    lng: number;
    zoom?: number;
    markers?: Array<{ lat: number; lng: number; label?: string }>;
  },
  {},
  any
>;

export default GoogleMap;
