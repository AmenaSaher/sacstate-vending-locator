export type Place = {
  id: string;
  place: string;
  coordinates: [number, number]; // [lat, lng]
  description?: string;
  photos?: string[];
  type: string[]; // ["vending"] or ["microwave"]
};