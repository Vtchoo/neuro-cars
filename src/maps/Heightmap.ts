import { unzlibSync } from "fflate";
import type { NcMap } from "./ncmap";

export type HeightmapData = {
  version: 1;
  width: number;
  height: number;
  widthMeters: number;
  heightMeters: number;
  originX: number;
  originY: number;
  datumMeters: number;
  elevationsMeters: number[];
};

/** Renderer-free elevation field. Horizontal coordinates stay in simulation units. */
export class Heightmap {
  readonly samples: Float32Array;
  constructor(
    readonly data: Omit<HeightmapData, "elevationsMeters">,
    samples: ArrayLike<number>,
  ) {
    if (
      data.version !== 1 ||
      !Number.isInteger(data.width) ||
      !Number.isInteger(data.height) ||
      data.width < 1 ||
      data.height < 1 ||
      data.width * data.height > 4194304 ||
      samples.length !== data.width * data.height ||
      ![data.widthMeters, data.heightMeters].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      ![data.originX, data.originY, data.datumMeters].every(Number.isFinite)
    )
      throw new Error("Invalid heightmap dimensions or scale.");
    this.samples = Float32Array.from(samples);
    if (!this.samples.every(Number.isFinite))
      throw new Error("Invalid heightmap elevations.");
    let minimum = Infinity;
    for (const value of this.samples) minimum = Math.min(minimum, value);
    this.data = { ...data, datumMeters: minimum };
  }
  static fromData(data: HeightmapData) {
    const { elevationsMeters, ...metadata } = data;
    return new Heightmap(metadata, elevationsMeters);
  }
  toData(): HeightmapData {
    return { ...this.data, elevationsMeters: Array.from(this.samples) };
  }
  sampleMeters(x: number, y: number) {
    const { width, height, widthMeters, heightMeters, originX, originY } =
      this.data;
    const px = Math.max(
      0,
      Math.min(
        width - 1,
        ((x - originX) / (widthMeters * 10) + 0.5) * width - 0.5,
      ),
    );
    const py = Math.max(
      0,
      Math.min(
        height - 1,
        ((y - originY) / (heightMeters * 10) + 0.5) * height - 0.5,
      ),
    );
    const x0 = Math.floor(px),
      y0 = Math.floor(py),
      x1 = Math.min(x0 + 1, width - 1),
      y1 = Math.min(y0 + 1, height - 1);
    const fx = px - x0,
      fy = py - y0;
    const a =
      this.samples[y0 * width + x0] * (1 - fx) +
      this.samples[y0 * width + x1] * fx;
    const b =
      this.samples[y1 * width + x0] * (1 - fx) +
      this.samples[y1 * width + x1] * fx;
    return a * (1 - fy) + b * fy;
  }
  /** Relative height keeps the lowest terrain at zero; stored samples retain real elevations. */
  worldHeight(x: number, y: number) {
    return (this.sampleMeters(x, y) - this.data.datumMeters) * 10;
  }

  static async fromNcMap(input: NcMap) {
    const bytes = new Uint8Array(await input.heightmap.arrayBuffer()),
      view = new DataView(bytes.buffer);
    const width = view.getUint32(16),
      height = view.getUint32(20);
    if (
      bytes[24] !== 16 ||
      bytes[25] !== 0 ||
      bytes[28] !== 0 ||
      width !== input.data.heightmap.width ||
      height !== input.data.heightmap.height ||
      width * height > 4194304
    )
      throw new Error(
        "Expected a non-interlaced 16-bit grayscale heightmap PNG.",
      );
    const parts: Uint8Array[] = [];
    let length = 0;
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const size = view.getUint32(offset),
        type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (offset + size + 12 > bytes.length)
        throw new Error("Truncated heightmap PNG.");
      if (type === "IDAT") {
        const part = bytes.subarray(offset + 8, offset + 8 + size);
        parts.push(part);
        length += size;
      }
      offset += size + 12;
    }
    const compressed = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      compressed.set(part, offset);
      offset += part.length;
    }
    const raw = unzlibSync(compressed),
      stride = width * 2;
    if (raw.length !== (stride + 1) * height)
      throw new Error("Invalid heightmap pixel data.");
    const decoded = new Uint8Array(stride * height);
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      if (filter > 4) throw new Error("Unsupported heightmap PNG filter.");
      for (let x = 0; x < stride; x++) {
        const index = y * stride + x,
          a = x >= 2 ? decoded[index - 2] : 0,
          b = y ? decoded[index - stride] : 0,
          c = y && x >= 2 ? decoded[index - stride - 2] : 0;
        decoded[index] =
          (raw[y * (stride + 1) + x + 1] +
            (filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? Math.floor((a + b) / 2)
                  : filter === 4
                    ? paeth(a, b, c)
                    : 0)) &
          255;
      }
    }
    const min = input.data.heightmap.minElevationMeters,
      max = input.data.heightmap.maxElevationMeters;
    const samples = new Float32Array(width * height);
    for (let i = 0; i < samples.length; i++)
      samples[i] =
        min +
        ((decoded[i * 2] * 256 + decoded[i * 2 + 1]) / 65535) * (max - min);
    return new Heightmap(
      {
        version: 1,
        width,
        height,
        widthMeters: input.data.map.widthMeters,
        heightMeters: input.data.map.heightMeters,
        originX: 0,
        originY: 0,
        datumMeters: min,
      },
      samples,
    );
  }
}
