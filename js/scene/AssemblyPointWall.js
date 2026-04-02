import * as THREE from "../lib/three.js";
import { MAP_SIZE } from "../config.js";

export class AssemblyPointWall {
    constructor(scene, resources) {
        this.scene = scene;
        this.resources = resources;
        this.group = new THREE.Group();
        this.textTexture = null;
        this.textMaterial = null;
        this.irpcTexture = null;
        this.irpcMaterial = null;
        this.backPanelMaterial = null;
        this.rearFrameMaterial = null;

        this.build();
        this.scene.add(this.group);
    }

    build() {
        const panelWidth = 16;
        const panelHeight = 5.5;
        const panelDepth = 0.45;
        const signX = MAP_SIZE + 6;
        const signZ = -18;
        const backLogoOffset = panelDepth / 2 + 0.14;

        const backPanel = new THREE.Mesh(
            this.resources.geometries.getBox(panelWidth, panelHeight, panelDepth),
            new THREE.MeshLambertMaterial({ color: 0x15384b })
        );
        backPanel.position.set(0, 0, 0);
        this.backPanelMaterial = backPanel.material;
        this.group.add(backPanel);

        const accentBar = new THREE.Mesh(
            this.resources.geometries.getBox(panelWidth + 0.2, 0.22, panelDepth + 0.04),
            this.resources.materials.getLambert(0xd94732)
        );
        accentBar.position.set(0, panelHeight / 2 - 0.45, 0.01);
        this.group.add(accentBar);

        this.textTexture = this.createTextTexture();
        this.textMaterial = new THREE.MeshBasicMaterial({
            map: this.textTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        const textPlane = new THREE.Mesh(
            this.resources.geometries.getPlane(14.2, 4.1),
            this.textMaterial
        );
        textPlane.position.set(0, 0, panelDepth / 2 + 0.02);
        this.group.add(textPlane);

        const logoAspect = 500 / 277;
        const logoHeight = panelHeight * 0.88;
        const logoWidth = logoHeight * logoAspect;
        const irpcTextureUrl = new URL("../../img/irpc.png", import.meta.url).href;
        this.irpcTexture = new THREE.TextureLoader().load(irpcTextureUrl);
        this.irpcTexture.encoding = THREE.sRGBEncoding;
        this.irpcTexture.minFilter = THREE.LinearFilter;
        this.irpcTexture.generateMipmaps = false;
        this.irpcMaterial = new THREE.MeshBasicMaterial({
            map: this.irpcTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        const irpcPlane = new THREE.Mesh(
            this.resources.geometries.getPlane(logoWidth, logoHeight),
            this.irpcMaterial
        );
        irpcPlane.position.set(0, 0, -backLogoOffset);
        irpcPlane.rotation.y = Math.PI;
        this.group.add(irpcPlane);

        this.rearFrameMaterial = new THREE.MeshLambertMaterial({ color: 0x8fa3af });

        const frame = new THREE.Mesh(
            this.resources.geometries.getBox(panelWidth + 0.04, panelHeight + 0.03, 0.045),
            this.rearFrameMaterial
        );
        frame.position.set(0, 0, -(panelDepth / 2 + 0.05));
        this.group.add(frame);

        this.group.position.set(signX, panelHeight / 2 + 0.15, signZ);
        this.group.rotation.y = -Math.PI / 2;
    }

    setBackLogoBoardColor(color) {
        this.rearFrameMaterial?.color.set(color);
    }

    createTextTexture() {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = 1024;
        canvas.height = 512;

        context.clearRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = "rgba(7, 20, 30, 0.82)";
        context.beginPath();
        context.roundRect(24, 24, canvas.width - 48, canvas.height - 48, 30);
        context.fill();

        context.strokeStyle = "rgba(223, 236, 244, 0.92)";
        context.lineWidth = 10;
        context.stroke();

        context.fillStyle = "#f6fbff";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = '700 138px "Arial"';
        context.fillText("ASSEMBLY", canvas.width / 2, 185);
        context.fillText("POINT", canvas.width / 2, 332);

        context.fillStyle = "rgba(217, 71, 50, 0.96)";
        context.fillRect(82, 390, canvas.width - 164, 18);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        return texture;
    }

    dispose() {
        this.textTexture?.dispose();
        this.textMaterial?.dispose();
        this.irpcTexture?.dispose();
        this.irpcMaterial?.dispose();
        this.backPanelMaterial?.dispose();
        this.rearFrameMaterial?.dispose();
        this.group.removeFromParent();
    }
}