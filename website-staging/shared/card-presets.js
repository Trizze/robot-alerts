export const CARD_PRESET_ORDER = [
  "02",
  "03",
  "04",
  "05",
  "07",
  "08",
  "09",
  "01",
  "10",
];
export const CARD_PRESETS = {
  "02": {
    name: "Neon signal",
    colors: {
      background: "#18152f",
      text: "#ffffff",
      accent: "#64fcdf",
      secondary: "#e863ff",
      symbol: "#ffffff",
      amount: "#64fcdf",
    },
  },
  "03": {
    name: "Soft badge",
    colors: {
      background: "#f9f8f1",
      text: "#161b20",
      accent: "#007f68",
      secondary: "#172c31",
      symbol: "#8df2c9",
      amount: "#007f68",
    },
  },
  "04": {
    name: "Broadcast ticker",
    colors: {
      background: "#101923",
      text: "#ffffff",
      accent: "#ffcb57",
      secondary: "#ffcb57",
      symbol: "#ffffff",
      amount: "#ffcb57",
    },
  },
  "05": {
    name: "Vaporwave",
    colors: {
      background: "#21083e",
      text: "#ffffff",
      accent: "#f87dff",
      secondary: "#080c29",
      symbol: "#56f2ff",
      amount: "#56f2ff",
    },
  },
  "07": {
    name: "Name first",
    colors: {
      background: "#101c22",
      text: "#ffffff",
      accent: "#94f5d7",
      secondary: "#182a30",
      symbol: "#76edc8",
      amount: "#94f5d7",
    },
  },
  "08": {
    name: "Pop arcade",
    colors: {
      background: "#ffcb47",
      text: "#152129",
      accent: "#152129",
      secondary: "#fa5a55",
      symbol: "#152129",
      amount: "#152129",
    },
  },
  "09": {
    name: "Clean tech",
    colors: {
      background: "#f3f7f8",
      text: "#142334",
      accent: "#195eb9",
      secondary: "#4182d9",
      symbol: "#195eb9",
      amount: "#195eb9",
    },
  },
  "01": {
    name: "Bold type",
    colors: {
      background: "#f1f1eb",
      text: "#14282c",
      accent: "#007d69",
      secondary: "#39bfa1",
      symbol: "#14282c",
      amount: "#007d69",
    },
  },
  10: {
    name: "Pixel terminal",
    colors: {
      background: "#12131b",
      text: "#ffffff",
      accent: "#72ffc9",
      secondary: "#4be7c2",
      symbol: "#72ffc9",
      amount: "#72ffc9",
    },
  },
};
for (const preset of Object.values(CARD_PRESETS))
  Object.assign(preset.colors, {
    name: preset.colors.text,
    message: preset.colors.text,
    amountUnit: preset.colors.amount,
  });
export const CARD_SYMBOLS = {
  event: "Event icon",
  uploaded: "Uploaded image",
  star: "✦",
  heart: "♥",
  spark: "✺",
  bolt: "ϟ",
  arrow: "↻",
  diamond: "◆",
  flag: "⚑",
  plus: "＋",
  screen: "▣",
  none: "None",
};
export const CARD_EVENTS = [
  "sub",
  "resub",
  "gift",
  "cheer",
  "raid",
  "follow",
  "preview",
];
