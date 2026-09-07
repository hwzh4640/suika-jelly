/** World is a portrait 480x800 box; the jar sits in the middle. All units are world px. */
export const WORLD_W = 480;
export const WORLD_H = 800;

/** Jar interior (where fruits live). */
export const JAR_X0 = 60;
export const JAR_X1 = 420;
export const JAR_W = JAR_X1 - JAR_X0;
export const JAR_BOTTOM = 740;
/** Where the jar body meets the neck / threads. */
export const NECK_Y = 200;
/** Top of the rim opening. */
export const RIM_Y = 150;
/** Fruits resting above this line for a second end the game. */
export const DANGER_Y = 230;
/** Y at which the held fruit hovers before dropping. */
export const DROP_Y = 100;

export const STEP_MS = 1000 / 60;
export const DROP_COOLDOWN = 0.45;
export const OVERFLOW_SECONDS = 1.0;
