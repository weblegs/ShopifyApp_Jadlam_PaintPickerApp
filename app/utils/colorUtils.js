// ─── Hex → RGB ────────────────────────────────────────────────────────────────
export const hexToRgb = (hex) => {
  hex = hex.replace("#", "");
  let r = 0, g = 0, b = 0;
  if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  return { r, g, b };
};

// ─── Check if RGB is within a defined range ───────────────────────────────────
const isInRgbRange = (rgb, range) =>
  rgb.r >= range.r[0] && rgb.r <= range.r[1] &&
  rgb.g >= range.g[0] && rgb.g <= range.g[1] &&
  rgb.b >= range.b[0] && rgb.b <= range.b[1];

// ─── Primary color ranges (exact same as Gadget index.jsx) ───────────────────
const PRIMARY_COLORS = {
  Red:       { r: [190, 255], g: [80, 150],  b: [0, 80]   },
  Crimson:   { r: [150, 220], g: [0, 60],    b: [40, 70]  },
  Blue:      { r: [0, 120],   g: [0, 150],   b: [100, 255]},
  Yellow:    { r: [170, 255], g: [150, 255], b: [0, 150]  },
  Gold:      { r: [200, 255], g: [150, 210], b: [0, 80]   },
  Lime:      { r: [100, 200], g: [200, 255], b: [0, 120]  },
  Green:     { r: [0, 100],   g: [50, 255],  b: [0, 100]  },
  Orange:    { r: [200, 255], g: [60, 160],  b: [0, 100]  },
  Brown:     { r: [50, 160],  g: [20, 80],   b: [10, 40]  },
  OliveBrown:{ r: [80, 160],  g: [50, 110],  b: [30, 70]  },
  Grey:      { r: [100, 200], g: [100, 200], b: [110, 200]},
  Silver:    { r: [160, 220], g: [160, 220], b: [160, 220]},
  Black:     { r: [0, 100],   g: [0, 100],   b: [10, 80]  },
  White:     { r: [220, 255], g: [220, 255], b: [220, 255]},
  Olive:     { r: [85, 160],  g: [70, 130],  b: [0, 80]   },
  Copper:    { r: [160, 200], g: [80, 140],  b: [20, 50]  },
  Rust:      { r: [140, 210], g: [60, 130],  b: [10, 50]  },
  Lavender:  { r: [170, 200], g: [100, 130], b: [220, 255]},
};

// ─── Secondary color ranges (exact same as Gadget index.jsx) ─────────────────
const SECONDARY_COLORS = {
  Cyan:     { r: [0, 100],   g: [150, 255], b: [150, 255]},
  Magenta:  { r: [150, 255], g: [0, 110],   b: [100, 255]},
  Amber:    { r: [180, 255], g: [180, 255], b: [0, 100]  },
  Violet:   { r: [100, 220], g: [0, 100],   b: [150, 255]},
  Beige:    { r: [180, 255], g: [160, 255], b: [100, 220]},
  Purple:   { r: [100, 200], g: [0, 80],    b: [150, 255]},
  Pink:     { r: [180, 255], g: [100, 180], b: [150, 255]},
  Teal:     { r: [0, 100],   g: [100, 180], b: [100, 180]},
  Lavender: { r: [170, 210], g: [100, 140], b: [210, 240]},
};

// ─── Classify a hex code → returns first matched group name ──────────────────
// Used by index page (same logic as Gadget index.jsx checkColorCategory)
export const classifyHexToGroup = (hexCode) => {
  if (!hexCode) return null;
  const rgb = hexToRgb(hexCode);

  const primary = Object.keys(PRIMARY_COLORS).filter((c) =>
    isInRgbRange(rgb, PRIMARY_COLORS[c])
  );
  if (primary.length > 0) return primary[0];

  const secondary = Object.keys(SECONDARY_COLORS).filter((c) =>
    isInRgbRange(rgb, SECONDARY_COLORS[c])
  );
  if (secondary.length > 0) return secondary[0];

  return null;
};

// ─── Classify hex → returns { primary[], secondary[] } ────────────────────────
// Used by GetColorGroup page (same logic as Gadget GetColorGroup.jsx)
export const classifyHexFull = (hexCode) => {
  if (!hexCode) return { primary: [], secondary: [] };
  const rgb = hexToRgb(hexCode);

  const primary = Object.keys(PRIMARY_COLORS).filter((c) =>
    isInRgbRange(rgb, PRIMARY_COLORS[c])
  );
  const secondary = Object.keys(SECONDARY_COLORS).filter((c) =>
    isInRgbRange(rgb, SECONDARY_COLORS[c])
  );

  return { primary, secondary };
};

// ─── Extract color name from product title ────────────────────────────────────
// Used by GetColorGroup page (same logic as Gadget GetColorGroup.jsx)
export const getColorFromTitle = (title) => {
  const colorNames = [
    "Red", "Blue", "Yellow", "Green", "Orange", "Brown", "Grey", "Black", "White",
    "Cyan", "Magenta", "Amber", "Lime", "Teal", "Violet", "Beige", "Purple",
    "Olive", "OliveBrown", "Crimson", "Silver", "Copper", "Pink", "Rust", "Gold",
  ];

  for (const color of colorNames) {
    if (title.toLowerCase().includes(color.toLowerCase())) {
      if (color.toLowerCase() === "silver") return "Grey";
      if (color.toLowerCase() === "copper" || color.toLowerCase() === "rust") return "Brown";
      return color;
    }
  }
  return null;
};

// ─── Full group resolution (used by index page Save logic) ───────────────────
// Priority: colourgroup stored in DB → title color → hex classification
export const resolveGroupName = (colourgroup, productTitle, hexValue) => {
  if (colourgroup && colourgroup.length > 0) return colourgroup;
  const titleColor = getColorFromTitle(productTitle);
  if (titleColor) return titleColor;
  return classifyHexToGroup(hexValue) || "";
};

// ─── Full pipeline: classify a single product's hex code ─────────────────────
// Returns the group name string to save in HexCodeProduct
export const classifyProduct = ({ product_title, metafield_value, colourgroup }) => {
  return resolveGroupName(colourgroup, product_title, metafield_value);
};
