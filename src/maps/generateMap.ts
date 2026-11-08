import mapboxgl from "mapbox-gl";
import {
  mapDimensions,
  pixelLocation,
  staticMapURL,
  type MapBounds,
} from "./mapGeometry";
import { addPNGMetadata, heightmapPNG } from "./png";
import type { NcMapData } from "./ncmap";
import { mapboxErrorMessage } from "./mapboxErrors";

export type GeneratedMap = {
  map: Blob;
  heightmap: Blob;
  heightMeters: number;
  widthMeters: number;
  width: number;
  height: number;
  minElevation: number;
  maxElevation: number;
  data: NcMapData;
};

function waitForMap(
  map: mapboxgl.Map,
  event: "load" | "idle",
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      map.off(event, done);
      map.off("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = (event: mapboxgl.ErrorEvent) => {
      cleanup();
      reject(new Error(mapboxErrorMessage(event.error, "terrain data")));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Terrain loading timed out. Check your connection and try again.",
        ),
      );
    }, 45000);
    map.on(event, done);
    map.on("error", failed);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

async function sampleTerrain(
  bounds: MapBounds,
  token: string,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  const dimensions = mapDimensions(bounds),
    grid = mapDimensions(bounds, 512);
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
  });
  document.body.append(container);
  // Elevation queries need only DEM tiles. A satellite basemap would fetch
  // unrelated world tiles and could fail before the DEM source is even added.
  const map = new mapboxgl.Map({
    container,
    accessToken: token,
    style: {
      version: 8,
      sources: {
        elevation: {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        },
      },
      terrain: { source: "elevation", exaggeration: 1 },
      layers: [
        {
          id: "ground",
          type: "background",
          paint: { "background-color": "#ffffff" },
        },
      ],
    },
    bounds: [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    fitBoundsOptions: { padding: 32 },
    interactive: false,
    attributionControl: false,
    renderWorldCopies: false,
    projection: "mercator",
    fadeDuration: 0,
  });
  try {
    progress("Loading Terrain-DEM elevation tiles…");
    await waitForMap(map, "idle", signal);
    const values = new Float32Array(grid.width * grid.height);
    for (let y = 0; y < grid.height; y++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      for (let x = 0; x < grid.width; x++) {
        const location = pixelLocation(bounds, x, y, grid.width, grid.height);
        const value = map.queryTerrainElevation(location, {
          exaggerated: false,
        });
        if (value === null || value === undefined || !Number.isFinite(value))
          throw new Error(
            "Elevation data is missing for part of this rectangle. Try a smaller area or another location.",
          );
        values[y * grid.width + x] = value;
      }
      if (y % 16 === 0) {
        progress(`Sampling heightmap… ${Math.round((y / grid.height) * 100)}%`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return { values, width: grid.width, height: grid.height };
  } finally {
    map.remove();
    container.remove();
  }
}

export async function generateMap(
  bounds: MapBounds,
  token: string,
  signal: AbortSignal,
  progress: (message: string) => void,
): Promise<GeneratedMap> {
  const dimensions = mapDimensions(bounds);
  progress("Generating high-resolution satellite map…");
  const response = await fetch(staticMapURL(bounds, token), { signal });
  if (!response.ok)
    throw new Error(
      mapboxErrorMessage({ status: response.status }, "static map"),
    );
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode map PNG.")),
      "image/png",
    ),
  );
  const metadata = {
    version: 1,
    selectedBounds: bounds,
    bounds: dimensions.imageBounds,
    projection: "EPSG:3857",
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
    northUp: true,
    attribution: "© Mapbox © OpenStreetMap",
  };
  const terrain = await sampleTerrain(
    dimensions.imageBounds,
    token,
    signal,
    progress,
  );
  progress("Encoding 16-bit heightmap…");
  const heightmap = await heightmapPNG(
    terrain.values,
    terrain.width,
    terrain.height,
    {
      ...metadata,
      source: "mapbox.mapbox-terrain-dem-v1",
      width: terrain.width,
      height: terrain.height,
    },
  );
  const data: NcMapData = {
    format: "ncmap",
    version: 1,
    createdAt: new Date().toISOString(),
    projection: "EPSG:3857",
    northUp: true,
    unitsPerMeter: 10,
    selectedBounds: { ...bounds },
    bounds: dimensions.imageBounds,
    attribution: metadata.attribution,
    map: {
      file: "map.png",
      width: canvas.width,
      height: canvas.height,
      widthMeters: dimensions.widthMeters,
      heightMeters: dimensions.heightMeters,
      source: "mapbox/satellite-v9",
      pixelRatio: 2,
    },
    heightmap: {
      file: "heightmap.png",
      width: terrain.width,
      height: terrain.height,
      bitDepth: 16,
      encoding: "normalized-grayscale",
      minElevationMeters: heightmap.min,
      maxElevationMeters: heightmap.max,
      source: "mapbox.mapbox-terrain-dem-v1",
    },
  };
  return {
    map: await addPNGMetadata(png, {
      ...metadata,
      width: canvas.width,
      height: canvas.height,
    }),
    heightmap: heightmap.blob,
    data,
    heightMeters: dimensions.heightMeters,
    widthMeters: dimensions.widthMeters,
    width: canvas.width,
    height: canvas.height,
    minElevation: heightmap.min,
    maxElevation: heightmap.max,
  };
}
