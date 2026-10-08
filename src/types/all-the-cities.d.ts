declare module "all-the-cities" {
  export interface GeoCity {
    cityId: number;
    name: string;
    altName: string;
    country: string; // ISO 3166-1 alpha-2
    featureCode: string; // PPLC = capital, PPL = populated place…
    adminCode: string;
    population: number;
    loc: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
  }
  const cities: GeoCity[];
  export default cities;
}
