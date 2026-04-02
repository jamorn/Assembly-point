import {
    MAP_SIZE,
    MIN_SPAWN_DIST,
    ROLE_SCALE,
    SHIFT_ACCENT,
    SHIFT_CODES
} from "./config.js";
import { shortenDisplayName } from "./utils/text.js";

const ROLE_LABELS = Object.freeze({
    manager: "Manager",
    supervisor: "Supervisor",
    teamLeader: "Team Leader",
    operator: "Operator",
    daytime: "Day Time"
});

function createCallSign(role, shiftCode, index) {
    if (role === "manager") {
        return "MGR";
    }
    if (role === "supervisor") {
        return `SUP-${shiftCode}`;
    }
    if (role === "teamLeader") {
        return `TL-${shiftCode}${index + 1}`;
    }
    if (role === "operator") {
        return `OP-${shiftCode}${index + 1}`;
    }
    return `DAY-${index + 1}`;
}

function getDistributedSpawnPoint(existingPoints, mapSize, minSpawnDist) {
    let x = 0;
    let z = 0;
    let attempts = 0;
    let isTooClose = false;
    const spawnRange = mapSize * 0.85;

    do {
        isTooClose = false;
        x = (Math.random() - 0.5) * spawnRange * 2;
        z = (Math.random() - 0.5) * spawnRange * 2;

        for (const point of existingPoints) {
            const dx = x - point.x;
            const dz = z - point.z;
            if (Math.sqrt(dx * dx + dz * dz) < minSpawnDist) {
                isTooClose = true;
                break;
            }
        }

        attempts += 1;
    } while (isTooClose && attempts < 150);

    return { x, z };
}

export function buildRoster(sourceData) {
    const roster = [];
    let sequence = 1;

    roster.push({
        id: `member-${sequence++}`,
        rawName: sourceData.manager,
        displayName: shortenDisplayName(sourceData.manager),
        callSign: createCallSign("manager", "MGT", 0),
        role: "manager",
        roleLabel: ROLE_LABELS.manager,
        shift: "Management",
        shiftCode: SHIFT_CODES.Management,
        shiftIndex: -1,
        memberIndex: 0,
        leaderIndex: null,
        isAssign: false,
        scale: ROLE_SCALE.manager,
        accentColor: SHIFT_ACCENT.Management
    });

    sourceData.shifts.forEach((shiftData, shiftIndex) => {
        const shiftCode = SHIFT_CODES[shiftData.shift];
        const accentColor = SHIFT_ACCENT[shiftData.shift];

        if (shiftData.shift === "Day time") {
            (shiftData.daytimeNames || []).forEach((name, index) => {
                roster.push({
                    id: `member-${sequence++}`,
                    rawName: name,
                    displayName: shortenDisplayName(name),
                    callSign: createCallSign("daytime", shiftCode, index),
                    role: "daytime",
                    roleLabel: ROLE_LABELS.daytime,
                    shift: shiftData.shift,
                    shiftCode,
                    shiftIndex,
                    memberIndex: index,
                    leaderIndex: null,
                    isAssign: false,
                    scale: ROLE_SCALE.daytime,
                    accentColor
                });
            });
            return;
        }

        roster.push({
            id: `member-${sequence++}`,
            rawName: shiftData.supervisor,
            displayName: shortenDisplayName(shiftData.supervisor),
            callSign: createCallSign("supervisor", shiftCode, 0),
            role: "supervisor",
            roleLabel: ROLE_LABELS.supervisor,
            shift: shiftData.shift,
            shiftCode,
            shiftIndex,
            memberIndex: 0,
            leaderIndex: null,
            isAssign: false,
            scale: ROLE_SCALE.supervisor,
            accentColor
        });

        const teamLeaders = shiftData.teamLeader || [];
        const operators = shiftData.operators || [];
        const operatorsPerLeader = teamLeaders.length ? Math.ceil(operators.length / teamLeaders.length) : 0;

        teamLeaders.forEach((leader, leaderIndex) => {
            const isAssign = leader.includes("(Assign)");
            const cleanName = leader.replace("(Assign)", "").trim();

            roster.push({
                id: `member-${sequence++}`,
                rawName: cleanName,
                displayName: shortenDisplayName(cleanName),
                callSign: createCallSign("teamLeader", shiftCode, leaderIndex),
                role: "teamLeader",
                roleLabel: ROLE_LABELS.teamLeader,
                shift: shiftData.shift,
                shiftCode,
                shiftIndex,
                memberIndex: leaderIndex,
                leaderIndex,
                isAssign,
                scale: ROLE_SCALE.teamLeader,
                accentColor
            });

            const startIndex = leaderIndex * operatorsPerLeader;
            const endIndex = Math.min(startIndex + operatorsPerLeader, operators.length);

            operators.slice(startIndex, endIndex).forEach((operator, localIndex) => {
                const operatorIndex = startIndex + localIndex;

                roster.push({
                    id: `member-${sequence++}`,
                    rawName: operator,
                    displayName: shortenDisplayName(operator),
                    callSign: createCallSign("operator", shiftCode, operatorIndex),
                    role: "operator",
                    roleLabel: ROLE_LABELS.operator,
                    shift: shiftData.shift,
                    shiftCode,
                    shiftIndex,
                    memberIndex: operatorIndex,
                    leaderIndex,
                    operatorIndexWithinLeader: localIndex,
                    isAssign: false,
                    scale: ROLE_SCALE.operator,
                    accentColor
                });
            });
        });
    });

    return roster;
}

export function createSpawnRoster(roster, mapSize = MAP_SIZE, minSpawnDist = MIN_SPAWN_DIST) {
    const placed = [];

    return roster.map((member) => {
        const spawnPoint = getDistributedSpawnPoint(placed, mapSize, minSpawnDist);
        const positioned = {
            ...member,
            x: spawnPoint.x,
            z: spawnPoint.z
        };

        placed.push(positioned);
        return positioned;
    });
}

export function summarizeRoster(roster) {
    return roster.reduce(
        (summary, member) => {
            summary.total += 1;
            summary[member.role] += 1;
            return summary;
        },
        {
            total: 0,
            manager: 0,
            supervisor: 0,
            teamLeader: 0,
            operator: 0,
            daytime: 0
        }
    );
}