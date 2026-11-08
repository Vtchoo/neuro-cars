// PNG metadata keeps bounds and elevation decoding together with reusable images.
const encoder = new TextEncoder();
function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}
function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function chunk(type: string, data: Uint8Array) {
  const body = concat([encoder.encode(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return concat([uint32(data.length), body, uint32((crc ^ 0xffffffff) >>> 0)]);
}
function metadataChunk(metadata: unknown) {
  const json = JSON.stringify(metadata).replace(
    /[^\x00-\x7f]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return chunk("tEXt", encoder.encode(`SmartRace\0${json}`));
}
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export async function addPNGMetadata(blob: Blob, metadata: unknown) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!signature.every((value, i) => bytes[i] === value))
    throw new Error("Expected a PNG image.");
  return new Blob(
    [bytes.slice(0, -12), metadataChunk(metadata), bytes.slice(-12)],
    { type: "image/png" },
  );
}

/** True 16-bit grayscale PNG; metadata stores the min/max needed to recover meters. */
export async function heightmapPNG(
  values: Float32Array,
  width: number,
  height: number,
  metadata: object,
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    values.length !== width * height
  )
    throw new Error("Heightmap dimensions do not match the elevation grid.");
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value))
      throw new Error("Elevation coverage is incomplete.");
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const raw = new Uint8Array(height * (1 + width * 2)),
    view = new DataView(raw.buffer);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const value =
        max === min
          ? 0
          : Math.round(((values[y * width + x] - min) / (max - min)) * 65535);
      view.setUint16(y * (width * 2 + 1) + 1 + x * 2, value);
    }
  const header = new Uint8Array(13),
    headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 16;
  const stream = new Blob([raw])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return {
    blob: new Blob(
      [
        signature,
        chunk("IHDR", header),
        metadataChunk({
          ...metadata,
          minElevationMeters: min,
          maxElevationMeters: max,
          encoding:
            "16-bit grayscale; elevationMeters = minElevationMeters + gray / 65535 * (maxElevationMeters - minElevationMeters)",
        }),
        chunk("IDAT", compressed),
        chunk("IEND", new Uint8Array()),
      ],
      { type: "image/png" },
    ),
    min,
    max,
  };
}
