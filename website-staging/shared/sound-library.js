// Shipped with the app. Users select entries; no uploaded or remote audio.
export const SOUND_LIBRARY = Object.freeze(
  [
    {
      name: "Robot entrance",
      src: "/robot/sounds/robot-arrival.mp3",
      duration: 4.2,
    },
    { name: "Arcade win", src: "/robot/sounds/arcade-win.mp3", duration: 1.8 },
    { name: "Soft chime", src: "/robot/sounds/soft-chime.mp3", duration: 1.6 },
    { name: "Power up", src: "/robot/sounds/power-up.mp3", duration: 1.8 },
    { name: "Glitch pop", src: "/robot/sounds/glitch-pop.mp3", duration: 1.4 },
  ].map(Object.freeze),
);
export const BUILTIN_SOUND = SOUND_LIBRARY[0].src;
export const isLibrarySound = (source) =>
  SOUND_LIBRARY.some((item) => item.src === source);
