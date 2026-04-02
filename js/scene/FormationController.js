import { MAP_SIZE } from "../config.js";

export class FormationController {
    constructor() {
        this.shiftCenters = new Map([
            ["Shift A", -18],
            ["Shift B", -6],
            ["Shift C", 6],
            ["Shift D", 18]
        ]);
        this.collator = new Intl.Collator("en", {
            sensitivity: "base",
            numeric: true
        });
        this.assembly = Object.freeze({
            managerX: MAP_SIZE - 5,
            supervisorX: MAP_SIZE - 11,
            teamLeaderX: MAP_SIZE - 17,
            operatorStartX: MAP_SIZE - 22,
            operatorSpacingX: 3.2,
            laneSpacingZ: 3.2,
            dayTimeOffsetZ: 3.2
        });
    }

    sortMembersAsc(members) {
        return [...members].sort((left, right) => {
            const leftName = left.rawName || left.displayName || "";
            const rightName = right.rawName || right.displayName || "";
            return this.collator.compare(leftName, rightName);
        });
    }

    getFacingRotation(fromX, fromZ, targetX, targetZ) {
        return Math.atan2(targetX - fromX, targetZ - fromZ);
    }

    buildLayout(roster) {
        const layout = new Map();
        const leaderAnchors = new Map();
        let furthestLeaderZ = Math.max(...this.shiftCenters.values());
        let queueDepthSeed = 0;
        const managerSlot = {
            x: this.assembly.managerX,
            z: 0,
            rotation: this.getFacingRotation(this.assembly.managerX, 0, this.assembly.managerX - 10, 0),
            queueDepth: 0,
            releaseDistance: 0.2
        };

        const manager = roster.find((member) => member.role === "manager");
        if (manager) {
            layout.set(manager.id, managerSlot);
        }

        for (const [shift, shiftCenterZ] of this.shiftCenters.entries()) {
            const supervisor = roster.find((member) => member.role === "supervisor" && member.shift === shift);
            if (supervisor) {
                const supervisorSlot = {
                    x: this.assembly.supervisorX,
                    z: shiftCenterZ,
                    rotation: this.getFacingRotation(
                        this.assembly.supervisorX,
                        shiftCenterZ,
                        managerSlot.x,
                        managerSlot.z
                    ),
                    queueDepth: queueDepthSeed + 1,
                    releaseDistance: 0.2
                };
                layout.set(supervisor.id, {
                    ...supervisorSlot
                });
            }

            const leaders = this.sortMembersAsc(
                roster.filter((member) => member.role === "teamLeader" && member.shift === shift)
            );
            const totalLaneWidth = Math.max(0, (leaders.length - 1) * this.assembly.laneSpacingZ);
            const firstLaneZ = shiftCenterZ - totalLaneWidth / 2;

            leaders.forEach((leader, index) => {
                const laneZ = firstLaneZ + index * this.assembly.laneSpacingZ;
                const slot = {
                    x: this.assembly.teamLeaderX,
                    z: laneZ,
                    rotation: this.getFacingRotation(
                        this.assembly.teamLeaderX,
                        laneZ,
                        managerSlot.x,
                        managerSlot.z
                    ),
                    queueDepth: queueDepthSeed + 2 + index,
                    releaseDistance: 0.2
                };
                furthestLeaderZ = Math.max(furthestLeaderZ, laneZ);
                layout.set(leader.id, slot);
                leaderAnchors.set(`${shift}:${leader.leaderIndex}`, {
                    slot
                });
            });

            const operators = this.sortMembersAsc(
                roster.filter((member) => member.role === "operator" && member.shift === shift)
            );

            const groupedOperators = new Map();
            operators.forEach((operator) => {
                const key = operator.leaderIndex ?? 0;
                if (!groupedOperators.has(key)) {
                    groupedOperators.set(key, []);
                }
                groupedOperators.get(key).push(operator);
            });

            groupedOperators.forEach((members, leaderIndex) => {
                const anchor = leaderAnchors.get(`${shift}:${leaderIndex}`) || {
                    slot: {
                        x: this.assembly.teamLeaderX,
                        z: shiftCenterZ,
                        rotation: this.getFacingRotation(
                            this.assembly.teamLeaderX,
                            shiftCenterZ,
                            managerSlot.x,
                            managerSlot.z
                        )
                    }
                };
                const sortedMembers = this.sortMembersAsc(members);

                sortedMembers.forEach((member, index) => {
                    const finalX = this.assembly.operatorStartX - index * this.assembly.operatorSpacingX;
                    layout.set(member.id, {
                        x: finalX,
                        z: anchor.slot.z,
                        rotation: this.getFacingRotation(finalX, anchor.slot.z, managerSlot.x, managerSlot.z),
                        queueDepth: queueDepthSeed + 10 + index,
                        releaseDistance: 0.2
                    });
                });
            });

            queueDepthSeed += 50;
        }

        const dayTimeMembers = this.sortMembersAsc(roster.filter((member) => member.role === "daytime"));
        const dayTimeZ = furthestLeaderZ + this.assembly.dayTimeOffsetZ;

        dayTimeMembers.forEach((member, index) => {
            const finalX = this.assembly.teamLeaderX - index * this.assembly.operatorSpacingX;
            layout.set(member.id, {
                x: finalX,
                z: dayTimeZ,
                rotation: this.getFacingRotation(finalX, dayTimeZ, managerSlot.x, managerSlot.z),
                queueDepth: queueDepthSeed + 30 + index,
                releaseDistance: 0.2
            });
        });

        return layout;
    }
}