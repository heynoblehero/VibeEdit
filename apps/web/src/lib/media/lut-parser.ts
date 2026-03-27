/**
 * Parse .cube LUT files for color grading.
 * A .cube file defines a 3D color lookup table.
 * Output: a flat Float32Array of RGB values that can be used as a WebGL 3D texture.
 */

export interface ParsedLUT {
  title: string;
  size: number; // Grid size (e.g., 33 means 33x33x33)
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array; // Flat RGB values: [r,g,b, r,g,b, ...]
}

export function parseCubeLUT(content: string): ParsedLUT {
  const lines = content.split(/\r?\n/);
  let title = "Untitled LUT";
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip comments and empty lines
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("TITLE")) {
      title = line.replace(/^TITLE\s+"?/, "").replace(/"$/, "");
      continue;
    }
    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (line.startsWith("DOMAIN_MIN")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      domainMin = [parts[0], parts[1], parts[2]];
      continue;
    }
    if (line.startsWith("DOMAIN_MAX")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      domainMax = [parts[0], parts[1], parts[2]];
      continue;
    }

    // Data line: three floats
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0])) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size === 0) {
    throw new Error("Invalid .cube file: missing LUT_3D_SIZE");
  }

  const expected = size * size * size * 3;
  if (values.length !== expected) {
    throw new Error(`Invalid .cube file: expected ${expected} values, got ${values.length}`);
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(values),
  };
}

// Store loaded LUTs
const lutStore = new Map<string, ParsedLUT>();

export function registerLUT(id: string, lut: ParsedLUT): void {
  lutStore.set(id, lut);
}

export function getLUT(id: string): ParsedLUT | undefined {
  return lutStore.get(id);
}

export function getAllLUTs(): Array<{ id: string; title: string; size: number }> {
  return Array.from(lutStore.entries()).map(([id, lut]) => ({
    id,
    title: lut.title,
    size: lut.size,
  }));
}
