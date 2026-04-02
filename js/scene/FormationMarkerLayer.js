import * as THREE from "../lib/three.js";

export class FormationMarkerLayer {
    constructor(scene, resources) {
        this.scene = scene;
        this.resources = resources;
        this.group = new THREE.Group();
        this.group.visible = false;
        this.scene.add(this.group);
    }

    clear() {
        const children = [...this.group.children];
        children.forEach((child) => {
            this.group.remove(child);
            if (child.material) {
                child.material.dispose();
            }
        });
    }

    show(layout, roster, unavailableMemberId = null) {
        this.clear();
        const rosterById = new Map(roster.map((member) => [member.id, member]));

        layout.forEach((slot, memberId) => {
            const member = rosterById.get(memberId);
            const isUnavailable = memberId === unavailableMemberId;
            const radius = member?.role === "manager" ? 0.62 : member?.role === "supervisor" ? 0.5 : 0.42;
            const fill = new THREE.Mesh(
                this.resources.geometries.getCircle(radius, 20),
                new THREE.MeshBasicMaterial({
                    color: isUnavailable ? 0xb63b2b : member?.accentColor ?? 0xffffff,
                    transparent: true,
                    opacity: isUnavailable ? 0.26 : 0.18,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            fill.rotation.x = -Math.PI / 2;
            fill.position.set(slot.x, 0.04, slot.z);
            fill.renderOrder = 10;
            this.group.add(fill);

            const center = new THREE.Mesh(
                this.resources.geometries.getCircle(0.12, 12),
                new THREE.MeshBasicMaterial({
                    color: isUnavailable ? 0xffe3a1 : 0xf7fbff,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            center.rotation.x = -Math.PI / 2;
            center.position.set(slot.x, 0.05, slot.z);
            center.renderOrder = 11;
            this.group.add(center);

            if (!isUnavailable) {
                return;
            }

            const crossMaterialA = new THREE.MeshBasicMaterial({
                color: 0xfff2cc,
                transparent: true,
                opacity: 0.96,
                depthWrite: false
            });
            const crossMaterialB = crossMaterialA.clone();
            const crossSize = radius * 2.05;

            const crossBarA = new THREE.Mesh(
                this.resources.geometries.getBox(crossSize, 0.05, 0.14),
                crossMaterialA
            );
            crossBarA.position.set(slot.x, 0.07, slot.z);
            crossBarA.rotation.y = Math.PI / 4;
            crossBarA.renderOrder = 12;
            this.group.add(crossBarA);

            const crossBarB = new THREE.Mesh(
                this.resources.geometries.getBox(crossSize, 0.05, 0.14),
                crossMaterialB
            );
            crossBarB.position.set(slot.x, 0.07, slot.z);
            crossBarB.rotation.y = -Math.PI / 4;
            crossBarB.renderOrder = 12;
            this.group.add(crossBarB);
        });

        this.group.visible = true;
    }

    hide() {
        this.group.visible = false;
    }

    dispose() {
        this.clear();
        this.group.removeFromParent();
    }
}