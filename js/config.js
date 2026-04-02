export const MAP_SIZE = 35;
export const VISUAL_FLOOR = 150;
export const MIN_SPAWN_DIST = 5.5;

export const MOVEMENT_MODE = Object.freeze({
    ROAM: "roam",
    ASSEMBLE: "assemble"
});

export const SHIFT_ORDER = Object.freeze([
    "Shift A",
    "Shift B",
    "Shift C",
    "Shift D",
    "Day time"
]);

export const SHIFT_CODES = Object.freeze({
    "Shift A": "A",
    "Shift B": "B",
    "Shift C": "C",
    "Shift D": "D",
    "Day time": "DAY",
    Management: "MGT"
});

export const ROLE_SCALE = Object.freeze({
    manager: 1.15,
    supervisor: 1.08,
    teamLeader: 1.03,
    operator: 1.0,
    daytime: 0.98
});

export const SHIFT_ACCENT = Object.freeze({
    "Shift A": 0xc53b32,
    "Shift B": 0x158f98,
    "Shift C": 0x5a3db4,
    "Shift D": 0xd46b08,
    "Day time": 0x5b9f2f,
    Management: 0x006d77
});

export const CAMERA_DEFAULTS = Object.freeze({
    distance: 52,
    phi: Math.PI / 2.55,
    theta: Math.PI + Math.PI / 12,
    targetX: MAP_SIZE - 10,
    targetY: 3.2,
    targetZ: 4
});

export const ENABLE_RANDOM_WALK_CONTROL = false;