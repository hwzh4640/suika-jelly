/** World is a portrait 480x800 box; the jar sits in the middle. All units are world px. */
export const WORLD_W = 480;
export const WORLD_H = 800;

/** Jar body interior (where fruits live). */
export const JAR_X0 = 60;
export const JAR_X1 = 420;
export const JAR_W = JAR_X1 - JAR_X0;
export const JAR_BOTTOM = 740;
/** The neck is a little narrower than the body; the shoulder slopes between them. */
export const NECK_X0 = 76;
export const NECK_X1 = 404;
/** Top of the lip / opening. */
export const RIM_Y = 140;
/** Where the straight neck ends and the shoulder starts curving out. */
export const NECK_Y = 205;
/** Where the shoulder meets the full-width body. */
export const SHOULDER_Y = 248;
/** Fruits resting above this line for a second end the game. */
export const DANGER_Y = 252;
/** Y at which the held fruit hovers before dropping. */
export const DROP_Y = 88;

export const STEP_MS = 1000 / 60;
export const DROP_COOLDOWN = 0.45;
export const OVERFLOW_SECONDS = 1.0;
