export interface LoadedFont {
  id: string;
  name: string;
  family: string;
  file: File;
  url: string;
}

const loadedFonts = new Map<string, LoadedFont>();

export async function loadCustomFont(file: File): Promise<LoadedFont> {
  const id = crypto.randomUUID();
  const url = URL.createObjectURL(file);

  // Extract font family name from filename
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const family = `custom-${baseName}-${id.slice(0, 6)}`;

  // Register with CSS FontFace API
  const fontFace = new FontFace(family, `url(${url})`);
  await fontFace.load();
  document.fonts.add(fontFace);

  const loaded: LoadedFont = { id, name: baseName, family, file, url };
  loadedFonts.set(id, loaded);
  return loaded;
}

export function getLoadedFonts(): LoadedFont[] {
  return Array.from(loadedFonts.values());
}

export function getFontFamily(id: string): string | undefined {
  return loadedFonts.get(id)?.family;
}
