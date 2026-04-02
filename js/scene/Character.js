import * as THREE from "../lib/three.js";
import { MAP_SIZE, MOVEMENT_MODE } from "../config.js";

const BASE_COLORS = Object.freeze({
    skin: 0xffdbac,
    skinDark: 0xe8beac,
    shirt: 0x00aaff,
    pants: 0x333333,
    shoes: 0x222222,
    hair: 0x4b3621,
    reflective: 0xffffff,
    button: 0xeeeeee,
    eyeWhite: 0xffffff,
    eyeBlack: 0x222222,
    mouth: 0x9e5b4a,
    irpcRed: 0xed1c24
});

const LEG_X_OFFSET = 0.24;
const ARM_X_OFFSET = 0.66;
const GROUND_CLEARANCE = 0.14;
const IDLE_BOB_AMPLITUDE = 0.018;

class BodyPart extends THREE.Group {
    constructor(width, height, depth, color, x, y, z, resources) {
        super();
        const geometry = resources.geometries.getBox(width, height, depth);
        const material = resources.materials.getLambert(color);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = -height / 2;
        this.add(this.mesh);
        this.position.set(x, y, z);
        this.height = height;
        this.resources = resources;
    }

    addShoe(color) {
        const geometry = this.resources.geometries.getBox(0.42, 0.2, 0.55);
        const material = this.resources.materials.getLambert(color);
        const shoe = new THREE.Mesh(geometry, material);
        shoe.position.y = -this.height;
        shoe.position.z = 0.05;
        this.add(shoe);
    }
}

export class MinecraftCharacter {
    constructor(config, resources) {
        this.resources = resources;
        this.group = new THREE.Group();
        this.targetPos = new THREE.Vector2();
        this.repulsion = new THREE.Vector2();
        this.formationSlot = null;
        this.holdRotation = 0;
        this.movementMode = MOVEMENT_MODE.ROAM;
        this.currentRotation = Math.random() * Math.PI * 2;
        this.currentSpeed = 0;
        this.baseSpeed = 0.05;
        this.animTime = 0;
        this.profile = null;
        this.nameTag = null;
        this.announcementTag = null;
        this.isUnavailable = false;

        this.applyProfile(config);
        this.buildMesh();
        this.setRoamMode(true);
    }

    applyProfile(config) {
        this.profile = { ...config };
        this.id = config.id;
        this.displayName = config.displayName;
        this.rawName = config.rawName;
        this.role = config.role;
        this.shift = config.shift;
        this.scaleValue = config.scale || 1;
        this.baseSpeed = (0.04 + Math.random() * 0.02) * this.scaleValue;
        this.currentSpeed = this.baseSpeed;
        this.group.position.set(config.x, GROUND_CLEARANCE * this.scaleValue, config.z);
        this.group.scale.set(this.scaleValue, this.scaleValue, this.scaleValue);
        this.currentRotation = Math.random() * Math.PI * 2;
        this.group.rotation.y = this.currentRotation;
        this.group.visible = true;
        this.isUnavailable = false;
    }

    buildMesh() {
        const colors = {
            ...BASE_COLORS,
            pocketDark: this.profile.accentColor || 0x0088cc
        };

        this.headGroup = new THREE.Group();

        const head = new THREE.Mesh(
            this.resources.geometries.getBox(0.8, 0.8, 0.8),
            this.resources.materials.getLambert(colors.skin)
        );
        this.headGroup.add(head);

        const hair = new THREE.Mesh(
            this.resources.geometries.getBox(0.82, 0.3, 0.82),
            this.resources.materials.getLambert(colors.hair)
        );
        hair.position.y = 0.3;
        this.headGroup.add(hair);

        const eyeGeometry = this.resources.geometries.getBox(0.12, 0.12, 0.02);
        const eyeWhite = this.resources.materials.getBasic(colors.eyeWhite);
        const eyeBlack = this.resources.materials.getBasic(colors.eyeBlack);

        const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhite);
        leftEyeWhite.position.set(-0.2, 0.05, 0.401);
        const leftEyeBlack = new THREE.Mesh(this.resources.geometries.getBox(0.06, 0.06, 0.021), eyeBlack);
        leftEyeBlack.position.set(-0.18, 0.05, 0.402);
        const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhite);
        rightEyeWhite.position.set(0.2, 0.05, 0.401);
        const rightEyeBlack = new THREE.Mesh(this.resources.geometries.getBox(0.06, 0.06, 0.021), eyeBlack);
        rightEyeBlack.position.set(0.18, 0.05, 0.402);
        this.headGroup.add(leftEyeWhite, leftEyeBlack, rightEyeWhite, rightEyeBlack);

        const nose = new THREE.Mesh(
            this.resources.geometries.getBox(0.12, 0.12, 0.05),
            this.resources.materials.getLambert(colors.skinDark)
        );
        nose.position.set(0, -0.05, 0.41);
        this.headGroup.add(nose);

        const mouth = new THREE.Mesh(
            this.resources.geometries.getBox(0.25, 0.06, 0.01),
            this.resources.materials.getBasic(colors.mouth)
        );
        mouth.position.set(0, -0.2, 0.401);
        this.headGroup.add(mouth);

        this.headGroup.position.y = 2.4;
        this.group.add(this.headGroup);

        const body = new THREE.Mesh(
            this.resources.geometries.getBox(0.8, 1.2, 0.4),
            this.resources.materials.getLambert(colors.shirt)
        );
        body.position.y = 1.4;
        this.group.add(body);

        const reflectiveStrip = new THREE.Mesh(
            this.resources.geometries.getBox(0.81, 0.15, 0.01),
            this.resources.materials.getStandard(colors.reflective, colors.reflective, 0.8)
        );
        reflectiveStrip.position.set(0, 1.62, -0.205);
        this.group.add(reflectiveStrip);

        const logoBack = this.resources.textures.getLogoTexture("IRPC", "white", true);
        const backLogoMesh = new THREE.Mesh(
            this.resources.geometries.getPlane(0.4, 0.2),
            this.resources.materials.getBasic(0xffffff, logoBack, true)
        );
        backLogoMesh.position.set(0, 1.78, -0.21);
        this.group.add(backLogoMesh);

        const pocket = new THREE.Mesh(
            this.resources.geometries.getPlane(0.18, 0.22),
            this.resources.materials.getLambert(colors.pocketDark)
        );
        pocket.position.set(-0.2, 1.6, 0.205);
        this.group.add(pocket);

        for (let index = 0; index < 3; index += 1) {
            const button = new THREE.Mesh(
                this.resources.geometries.getCircle(0.025, 8),
                this.resources.materials.getLambert(colors.button)
            );
            button.position.set(0, 1.7 - index * 0.25, 0.205);
            this.group.add(button);
        }

        const logoFront = this.resources.textures.getLogoTexture("IRPC", "#ed1c24", false);
        const frontLogoMesh = new THREE.Mesh(
            this.resources.geometries.getPlane(0.18, 0.09),
            this.resources.materials.getBasic(0xffffff, logoFront, true)
        );
        frontLogoMesh.position.set(0.22, 1.65, 0.21);
        this.group.add(frontLogoMesh);

        const nameTexture = this.resources.textures.getNameTexture(this.displayName);
        const nameMaterial = this.resources.materials.createSprite(nameTexture);
        this.nameTag = new THREE.Sprite(nameMaterial);
        this.nameTag.scale.set(3.4, 0.9, 1);
        this.nameTag.position.set(0, 4.0, 0);
        this.nameTag.renderOrder = 999;
        this.group.add(this.nameTag);

        this.leftArm = new BodyPart(0.4, 1.2, 0.4, colors.shirt, -ARM_X_OFFSET, 2.0, 0, this.resources);
        this.rightArm = new BodyPart(0.4, 1.2, 0.4, colors.shirt, ARM_X_OFFSET, 2.0, 0, this.resources);
        this.leftLeg = new BodyPart(0.4, 0.8, 0.4, colors.pants, -LEG_X_OFFSET, 0.8, 0, this.resources);
        this.rightLeg = new BodyPart(0.4, 0.8, 0.4, colors.pants, LEG_X_OFFSET, 0.8, 0, this.resources);
        this.leftLeg.addShoe(colors.shoes);
        this.rightLeg.addShoe(colors.shoes);
        this.group.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);
    }

    getDistanceToPoint(x, z) {
        const dx = x - this.group.position.x;
        const dz = z - this.group.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    setUnavailable(value) {
        this.isUnavailable = value;
        this.currentSpeed = 0;
        this.group.visible = !value;
    }

    setAnnouncement(text) {
        if (!text) {
            this.clearAnnouncement();
            return;
        }

        const announcementTexture = this.resources.textures.getAnnouncementTexture(text);
        const announcementMaterial = this.resources.materials.createSprite(announcementTexture);

        if (!this.announcementTag) {
            this.announcementTag = new THREE.Sprite(announcementMaterial);
            this.announcementTag.position.set(0, 5.3, 0);
            this.announcementTag.renderOrder = 1000;
            this.group.add(this.announcementTag);
        } else {
            this.announcementTag.material?.dispose();
            this.announcementTag.material = announcementMaterial;
        }

        this.announcementTag.scale.set(Math.min(9.6, Math.max(6.4, text.length * 0.27)), 1.28, 1);
        this.announcementTag.visible = true;
    }

    clearAnnouncement() {
        if (!this.announcementTag) {
            return;
        }

        this.announcementTag.visible = false;
        this.announcementTag.material?.dispose();
        this.announcementTag.material = null;
    }

    setRoamMode(forceNewTarget = false) {
        this.movementMode = MOVEMENT_MODE.ROAM;
        this.formationSlot = null;
        this.holdRotation = this.currentRotation;
        if (forceNewTarget) {
            this.setNewRoamTarget(true);
        }
    }

    setFormationTarget(slot) {
        this.movementMode = MOVEMENT_MODE.ASSEMBLE;
        this.formationSlot = { ...slot };
        this.targetPos.set(slot.x, slot.z);
        this.holdRotation = slot.rotation ?? 0;
    }

    setNewRoamTarget(forceEdge = false) {
        if (forceEdge || Math.random() < 0.75) {
            const side = Math.floor(Math.random() * 4);
            const offset = (Math.random() - 0.5) * MAP_SIZE * 1.6;
            const edgePos = MAP_SIZE * 0.9;

            switch (side) {
                case 0:
                    this.targetPos.set(edgePos, offset);
                    break;
                case 1:
                    this.targetPos.set(-edgePos, offset);
                    break;
                case 2:
                    this.targetPos.set(offset, edgePos);
                    break;
                default:
                    this.targetPos.set(offset, -edgePos);
                    break;
            }
            return;
        }

        this.targetPos.set(
            (Math.random() - 0.5) * MAP_SIZE * 1.5,
            (Math.random() - 0.5) * MAP_SIZE * 1.5
        );
    }

    distanceToTarget() {
        const dx = this.targetPos.x - this.group.position.x;
        const dz = this.targetPos.y - this.group.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    distanceToAssignedSlot() {
        if (!this.formationSlot) {
            return this.distanceToTarget();
        }

        const dx = this.formationSlot.x - this.group.position.x;
        const dz = this.formationSlot.z - this.group.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    getUpdateOrder() {
        return this.formationSlot?.queueDepth ?? 0;
    }

    hasReachedAssignedSlot() {
        if (!this.formationSlot) {
            return false;
        }

        const releaseDistance = this.formationSlot.releaseDistance ?? 0.9;
        return this.distanceToAssignedSlot() <= releaseDistance;
    }

    resolveAssembleTarget(charactersById) {
        if (!this.formationSlot) {
            return {
                x: this.targetPos.x,
                z: this.targetPos.y,
                rotation: this.holdRotation,
                stopRadius: 0.45
            };
        }

        const slot = this.formationSlot;
        return {
            x: slot.x,
            z: slot.z,
            rotation: slot.rotation ?? 0,
            stopRadius: 0.22
        };
    }

    isInFormation() {
        if (this.isUnavailable) {
            return true;
        }

        return this.movementMode === MOVEMENT_MODE.ASSEMBLE && this.distanceToAssignedSlot() < 0.45 && this.currentSpeed < 0.02;
    }

    update(neighbors, deltaTime, charactersById = null) {
        if (this.isUnavailable) {
            return;
        }

        const activeTarget = this.movementMode === MOVEMENT_MODE.ASSEMBLE
            ? this.resolveAssembleTarget(charactersById)
            : {
                x: this.targetPos.x,
                z: this.targetPos.y,
                rotation: this.holdRotation,
                stopRadius: 0.45
            };

        const dx = activeTarget.x - this.group.position.x;
        const dz = activeTarget.z - this.group.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (
            this.movementMode === MOVEMENT_MODE.ROAM &&
            (distance < 3 || Math.abs(this.group.position.x) > MAP_SIZE + 5 || Math.abs(this.group.position.z) > MAP_SIZE + 5)
        ) {
            this.setNewRoamTarget();
        }

        const isAssembling = this.movementMode === MOVEMENT_MODE.ASSEMBLE;
        const avoidanceRadius = isAssembling ? 0 : 6.5 * this.scaleValue;
        const personalSpace = isAssembling ? 0 : 2.4 * this.scaleValue;
        const repulsionStrength = isAssembling ? 0 : 12;
        let repelX = 0;
        let repelZ = 0;

        if (!isAssembling) {
            for (const other of neighbors) {
                if (other === this || other.isUnavailable) {
                    continue;
                }

                const diffX = this.group.position.x - other.group.position.x;
                const diffZ = this.group.position.z - other.group.position.z;
                const distanceToOther = Math.sqrt(diffX * diffX + diffZ * diffZ);

                if (distanceToOther <= 0.0001 || distanceToOther >= avoidanceRadius) {
                    continue;
                }

                const force = ((avoidanceRadius - distanceToOther) / avoidanceRadius) ** 2;
                repelX += (diffX / distanceToOther) * force;
                repelZ += (diffZ / distanceToOther) * force;

                if (distanceToOther < personalSpace) {
                    const pushForce = 0.08 * (personalSpace - distanceToOther);
                    this.group.position.x += (diffX / distanceToOther) * pushForce;
                    this.group.position.z += (diffZ / distanceToOther) * pushForce;
                }
            }
        }

        this.repulsion.x += (repelX - this.repulsion.x) * 0.1;
        this.repulsion.y += (repelZ - this.repulsion.y) * 0.1;

        const finalDx = dx + this.repulsion.x * repulsionStrength;
        const finalDz = dz + this.repulsion.y * repulsionStrength;
        const shouldHoldFormationRotation = isAssembling && distance <= Math.max(activeTarget.stopRadius, 0.28);
        const targetRotation = shouldHoldFormationRotation
            ? activeTarget.rotation
            : distance > 0.08
                ? Math.atan2(finalDx, finalDz)
                : activeTarget.rotation;

        let angleDiff = targetRotation - this.currentRotation;
        while (angleDiff > Math.PI) {
            angleDiff -= Math.PI * 2;
        }
        while (angleDiff < -Math.PI) {
            angleDiff += Math.PI * 2;
        }

        const desiredSpeed = this.movementMode === MOVEMENT_MODE.ASSEMBLE && distance < activeTarget.stopRadius
            ? 0
            : this.baseSpeed;
        this.currentSpeed += (desiredSpeed - this.currentSpeed) * (isAssembling ? 0.24 : 0.18);
        this.currentRotation += angleDiff * (isAssembling ? 0.14 : 0.08);
        this.group.rotation.y = this.currentRotation;

        if (this.currentSpeed > 0.002) {
            this.group.position.x += Math.sin(this.currentRotation) * this.currentSpeed;
            this.group.position.z += Math.cos(this.currentRotation) * this.currentSpeed;
        }

        const moving = this.currentSpeed > 0.01;
        if (moving) {
            this.animTime += deltaTime * 12 * (this.currentSpeed / Math.max(this.baseSpeed, 0.0001));
            const swing = Math.sin(this.animTime) * 0.7;
            this.leftArm.rotation.x = swing;
            this.rightArm.rotation.x = -swing;
            this.leftLeg.rotation.x = -swing;
            this.rightLeg.rotation.x = swing;
            this.group.position.y = (GROUND_CLEARANCE * this.scaleValue) + Math.abs(Math.cos(this.animTime)) * 0.1 * this.scaleValue;
            return;
        }

        this.animTime += deltaTime * 2;
        this.leftArm.rotation.x += (0 - this.leftArm.rotation.x) * 0.15;
        this.rightArm.rotation.x += (0 - this.rightArm.rotation.x) * 0.15;
        this.leftLeg.rotation.x += (0 - this.leftLeg.rotation.x) * 0.15;
        this.rightLeg.rotation.x += (0 - this.rightLeg.rotation.x) * 0.15;
        this.group.position.y = (GROUND_CLEARANCE * this.scaleValue) + Math.sin(this.animTime) * IDLE_BOB_AMPLITUDE * this.scaleValue;
    }

    dispose() {
        if (this.nameTag?.material) {
            this.nameTag.material.dispose();
        }
        if (this.announcementTag?.material) {
            this.announcementTag.material.dispose();
        }
        this.group.removeFromParent();
    }
}