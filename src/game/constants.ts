export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const GOAL_TOP = 170;
export const GOAL_BOTTOM = 430;
export const GOAL_X = 40;
/** Vertical centre of the goal mouth. Derived, never a literal, so it cannot
 *  drift from the posts if the net is ever moved or resized. */
export const GOAL_CENTER_Y = (GOAL_TOP + GOAL_BOTTOM) / 2;
export const GOALIE_RADIUS = 20;
export const PUCK_RADIUS = 6;
export const MAGNUS_ACCELERATION = 200;

export const GOALIE_MAX_SPEED = 240;
export const GOALIE_ACCEL = 1000;
export const GOALIE_DECEL = 1400;

export const POKE_COST = 0.25;
export const POKE_ACTIVE_DURATION = 0.2;
export const POKE_RECOVERY_DURATION = 0.3;

export const DIVE_COST = 0.45;
export const DIVE_ACTIVE_DURATION = 0.3;
export const DIVE_RECOVERY_DURATION = 0.5;
export const DIVE_IMPULSE_SPEED = 600;

export const GLOVE_SNAG_COST = 0.2;
export const GLOVE_SNAG_ACTIVE_DURATION = 0.2;
export const GLOVE_SNAG_RECOVERY_DURATION = 0.25;

export const STAMINA_REGEN_RATE = 0.3;

export const MAGNET_RADIUS = 250;
export const MAGNET_CONE_HALF_ANGLE = Math.PI / 3;
export const MAGNET_HALF_ANGLE = MAGNET_CONE_HALF_ANGLE;
export const MAGNET_MAX_STEER_RATE = 4.0;
export const MAGNET_STEER_RATE = MAGNET_MAX_STEER_RATE;
export const MAGNET_MAX_ANGULAR_RATE = MAGNET_MAX_STEER_RATE;
export const MAGNET_DRAIN_RATE = 0.4;
export const MAGNET_REGEN_RATE = 0.2;

export const SLAP_SHOT_WINDUP = 0.5;
export const SNAP_SHOT_WINDUP = 0.2;
export const WRIST_SHOT_WINDUP = 0.1;

export const SLAP_SHOT_SPEED_MULT = 1.3;
export const SNAP_SHOT_SPEED_MULT = 1.1;
export const WRIST_SHOT_SPEED_MULT = 1.0;

export const DEKE_SKILL_THRESHOLD = 0.65;
export const ESTIMATED_FLIGHT_TIME = 0.35;

export const SHOOTER_MIN_RELEASE_DIST_LOW_SKILL = 280;
export const SHOOTER_MAX_RELEASE_DIST_LOW_SKILL = 350;
export const SHOOTER_MIN_RELEASE_DIST_HIGH_SKILL = 180;
export const SHOOTER_MAX_RELEASE_DIST_HIGH_SKILL = 250;
