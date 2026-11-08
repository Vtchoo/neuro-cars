import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { validateBounds, type MapBounds } from "./mapGeometry";

export type NcMapData = {
  format: "ncmap";
  version: 1;
  createdAt: string;
  projection: "EPSG:3857";
  northUp: true;
  unitsPerMeter: 10;
  selectedBounds: MapBounds;
  bounds: MapBounds;
  attribution: string;
  map: {
    file: "map.png";
    width: number;
    height: number;
    widthMeters: number;
    heightMeters: number;
    source: string;
    pixelRatio: 2;
  };
  heightmap: {
    file: "heightmap.png";
    width: number;
    height: number;
    bitDepth: 16;
    encoding: "normalized-grayscale";
    minElevationMeters: number;
    maxElevationMeters: number;
    source: string;
  };
};

export type NcMap = { map: Blob; heightmap: Blob; data: NcMapData };

function pngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 33 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, i) => bytes[i] === value,
    ) ||
    strFromU8(bytes.subarray(12, 16)) !== "IHDR"
  )
    throw new Error("The .ncmap package contains an invalid PNG image.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function validateData(value: unknown): asserts value is NcMapData {
  const data = value as NcMapData | undefined;
  const positive = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const size = (value: unknown) => positive(value) && Number.isInteger(value);
  if (!data || data.format !== "ncmap" || data.version !== 1)
    throw new Error("Unsupported .ncmap format or version.");
  if (
    data.projection !== "EPSG:3857" ||
    data.northUp !== true ||
    data.unitsPerMeter !== 10 ||
    !data.map ||
    data.map.file !== "map.png" ||
    !positive(data.map.heightMeters) ||
    !positive(data.map.widthMeters) ||
    !size(data.map.width) ||
    !size(data.map.height) ||
    !data.heightmap ||
    data.heightmap.file !== "heightmap.png" ||
    data.heightmap.bitDepth !== 16 ||
    data.heightmap.encoding !== "normalized-grayscale" ||
    !size(data.heightmap.width) ||
    !size(data.heightmap.height) ||
    !Number.isFinite(data.heightmap.minElevationMeters) ||
    !Number.isFinite(data.heightmap.maxElevationMeters) ||
    data.heightmap.minElevationMeters > data.heightmap.maxElevationMeters
  )
    throw new Error(
      "The .ncmap package has invalid dimensions, scale, or elevation metadata.",
    );
  validateBounds(data.bounds);
  validateBounds(data.selectedBounds);
  if (
    Math.abs(
      data.map.widthMeters / data.map.heightMeters -
        data.map.width / data.map.height,
    ) > 1e-6
  )
    throw new Error(
      "The .ncmap image aspect and real-world dimensions do not match.",
    );
}

function validateImages(
  map: Uint8Array,
  heightmap: Uint8Array,
  data: NcMapData,
) {
  const mapSize = pngDimensions(map),
    heightSize = pngDimensions(heightmap);
  if (
    mapSize.width !== data.map.width ||
    mapSize.height !== data.map.height ||
    heightSize.width !== data.heightmap.width ||
    heightSize.height !== data.heightmap.height ||
    heightSize.bitDepth !== 16 ||
    heightSize.colorType !== 0
  )
    throw new Error("The .ncmap images do not match data.json.");
}

/** A standard ZIP archive; PNG bytes are preserved, including 16-bit heights and metadata. */
export async function createNcMap(input: NcMap): Promise<Blob> {
  validateData(input.data);
  const map = new Uint8Array(await input.map.arrayBuffer()),
    heightmap = new Uint8Array(await input.heightmap.arrayBuffer());
  validateImages(map, heightmap, input.data);
  const archive = zipSync({
    "map.png": [map, { level: 0 }],
    "heightmap.png": [heightmap, { level: 0 }],
    "data.json": [strToU8(JSON.stringify(input.data, null, 2)), { level: 6 }],
  });
  return new Blob([archive], { type: "application/zip" });
}

export async function readNcMap(blob: Blob): Promise<NcMap> {
  if (blob.size > 128 * 1024 * 1024)
    throw new Error("This .ncmap package is too large to load.");
  let files: ReturnType<typeof unzipSync>;
  let total = 0;
  try {
    files = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
      filter: (file) => {
        if (!["map.png", "heightmap.png", "data.json"].includes(file.name))
          return false;
        total += file.originalSize;
        if (
          total > 128 * 1024 * 1024 ||
          (file.name === "data.json" && file.originalSize > 1024 * 1024)
        )
          throw new Error("Archive is too large.");
        return true;
      },
    });
  } catch {
    throw new Error("Could not read the .ncmap ZIP archive.");
  }
  if (!files["map.png"] || !files["heightmap.png"] || !files["data.json"])
    throw new Error(
      "The .ncmap package must contain map.png, heightmap.png, and data.json.",
    );
  let data: unknown;
  try {
    data = JSON.parse(strFromU8(files["data.json"]));
  } catch {
    throw new Error("The .ncmap data.json is not valid JSON.");
  }
  validateData(data);
  validateImages(files["map.png"], files["heightmap.png"], data);
  return {
    map: new Blob([files["map.png"]], { type: "image/png" }),
    heightmap: new Blob([files["heightmap.png"]], { type: "image/png" }),
    data,
  };
}
