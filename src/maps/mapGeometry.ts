export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export const INTERLAGOS: MapBounds = {
  west: -46.7039,
  east: -46.6901,
  south: -23.708,
  north: -23.6954,
};
const EARTH_RADIUS = 6378137;
export const mercatorY = (latitude: number) =>
  Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
export const latitudeAtY = (y: number) =>
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/** Meridian distance on WGS84, integrated using the ellipsoid's meridional radius. */
export function northSouthDistance(south: number, north: number) {
  const eccentricitySquared = 6.6943799901413165e-3;
  const start = (south * Math.PI) / 180,
    step = ((north - south) * Math.PI) / 180 / 32;
  let sum = 0;
  for (let i = 0; i <= 32; i++) {
    const latitude = start + i * step;
    const radius =
      (EARTH_RADIUS * (1 - eccentricitySquared)) /
      Math.pow(1 - eccentricitySquared * Math.sin(latitude) ** 2, 1.5);
    sum += radius * (i === 0 || i === 32 ? 1 : i % 2 ? 4 : 2);
  }
  return (sum * step) / 3;
}

export function validateBounds(bounds: MapBounds) {
  if (
    !Object.values(bounds).every(Number.isFinite) ||
    bounds.west < -180 ||
    bounds.east > 180 ||
    bounds.south < -85.0511 ||
    bounds.north > 85.0511 ||
    bounds.west >= bounds.east ||
    bounds.south >= bounds.north
  )
    throw new Error(
      "Enter a valid rectangle: west < east, south < north, within Mercator map limits.",
    );
}

/** Static Images uses Mercator, so use projected aspect rather than degree ratios. */
export function mapDimensions(bounds: MapBounds, limit = 1280) {
  validateBounds(bounds);
  const dx = ((bounds.east - bounds.west) * Math.PI) / 180,
    dy = mercatorY(bounds.north) - mercatorY(bounds.south);
  const ratio = dx / dy;
  const width = ratio >= 1 ? limit : Math.max(1, Math.round(limit * ratio));
  const height = ratio >= 1 ? Math.max(1, Math.round(limit / ratio)) : limit;
  // Integer image dimensions can expand one side slightly to fit the selected bbox.
  const spanY = Math.max(dy, (dx * height) / width),
    spanX = (spanY * width) / height;
  const centerX = ((bounds.west + bounds.east) * Math.PI) / 360,
    centerY = (mercatorY(bounds.south) + mercatorY(bounds.north)) / 2;
  const imageBounds = {
    west: ((centerX - spanX / 2) * 180) / Math.PI,
    east: ((centerX + spanX / 2) * 180) / Math.PI,
    south: latitudeAtY(centerY - spanY / 2),
    north: latitudeAtY(centerY + spanY / 2),
  };
  const heightMeters = northSouthDistance(imageBounds.south, imageBounds.north);
  return {
    width,
    height,
    imageBounds,
    widthMeters: (heightMeters * width) / height,
    heightMeters,
  };
}

export function pixelLocation(
  bounds: MapBounds,
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number] {
  const northY = mercatorY(bounds.north),
    southY = mercatorY(bounds.south);
  return [
    bounds.west + ((x + 0.5) / width) * (bounds.east - bounds.west),
    latitudeAtY(northY + ((y + 0.5) / height) * (southY - northY)),
  ];
}

export function staticMapURL(bounds: MapBounds, token: string) {
  const { width, height } = mapDimensions(bounds);
  const bbox = `[${bounds.west},${bounds.south},${bounds.east},${bounds.north}]`;
  const url = new URL(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${bbox}/${width}x${height}@2x.png`,
  );
  url.searchParams.set("padding", "0");
  url.searchParams.set("access_token", token);
  return url.toString();
}
