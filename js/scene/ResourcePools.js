import * as THREE from "../lib/three.js";

export class TexturePool {
    constructor() {
        this.cache = new Map();
        this.hitCount = 0;
        this.missCount = 0;
    }

    getNameTexture(text) {
        const key = `name:${text}`;
        if (this.cache.has(key)) {
            this.hitCount += 1;
            return this.cache.get(key);
        }

        this.missCount += 1;
        const nameCanvas = document.createElement("canvas");
        const nameContext = nameCanvas.getContext("2d");
        nameCanvas.width = 640;
        nameCanvas.height = 128;

        nameContext.clearRect(0, 0, nameCanvas.width, nameCanvas.height);
        nameContext.fillStyle = "rgba(3, 10, 18, 0.88)";
        nameContext.beginPath();
        nameContext.roundRect(10, 10, nameCanvas.width - 20, nameCanvas.height - 20, 18);
        nameContext.fill();

        nameContext.font = "700 72px Arial";
        nameContext.fillStyle = "#ffffff";
        nameContext.textAlign = "center";
        nameContext.textBaseline = "middle";
        nameContext.fillText(text, nameCanvas.width / 2, nameCanvas.height / 2);

        const texture = new THREE.CanvasTexture(nameCanvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        this.cache.set(key, texture);
        return texture;
    }

    getAnnouncementTexture(text) {
        const key = `announcement:${text}`;
        if (this.cache.has(key)) {
            this.hitCount += 1;
            return this.cache.get(key);
        }

        this.missCount += 1;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = 1024;
        canvas.height = 180;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgba(11, 23, 34, 0.94)";
        context.beginPath();
        context.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 28);
        context.fill();

        context.strokeStyle = "rgba(243, 198, 77, 0.94)";
        context.lineWidth = 8;
        context.stroke();

        context.fillStyle = "#fdf7e3";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = text.length > 24 ? "700 54px Arial" : "700 62px Arial";
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        this.cache.set(key, texture);
        return texture;
    }

    getLogoTexture(text, color = "white", isBack = false) {
        const key = `logo:${text}:${color}:${isBack}`;
        if (this.cache.has(key)) {
            this.hitCount += 1;
            return this.cache.get(key);
        }

        this.missCount += 1;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = 256;
        canvas.height = 128;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = "700 90px Arial";
        context.fillStyle = color;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.shadowColor = "rgba(0, 0, 0, 0.8)";
        context.shadowBlur = 4;
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        if (isBack) {
            texture.repeat.x = -1;
            texture.center.set(0.5, 0.5);
        }
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        this.cache.set(key, texture);
        return texture;
    }

    getStats() {
        return {
            cacheSize: this.cache.size,
            hits: this.hitCount,
            misses: this.missCount
        };
    }

    disposeAll() {
        this.cache.forEach((texture) => texture.dispose());
        this.cache.clear();
    }
}

export class GeometryCache {
    constructor() {
        this.cache = new Map();
    }

    getBox(width, height, depth) {
        const key = `box:${width}:${height}:${depth}`;
        if (!this.cache.has(key)) {
            this.cache.set(key, new THREE.BoxGeometry(width, height, depth));
        }
        return this.cache.get(key);
    }

    getPlane(width, height) {
        const key = `plane:${width}:${height}`;
        if (!this.cache.has(key)) {
            this.cache.set(key, new THREE.PlaneGeometry(width, height));
        }
        return this.cache.get(key);
    }

    getCircle(radius, segments) {
        const key = `circle:${radius}:${segments}`;
        if (!this.cache.has(key)) {
            this.cache.set(key, new THREE.CircleGeometry(radius, segments));
        }
        return this.cache.get(key);
    }

    disposeAll() {
        this.cache.forEach((geometry) => geometry.dispose());
        this.cache.clear();
    }
}

export class MaterialCache {
    constructor() {
        this.cache = new Map();
    }

    getLambert(color) {
        const key = `lambert:${color}`;
        if (!this.cache.has(key)) {
            this.cache.set(key, new THREE.MeshLambertMaterial({ color }));
        }
        return this.cache.get(key);
    }

    getBasic(color, map = null, transparent = false) {
        const mapKey = map ? map.uuid : "nomap";
        const key = `basic:${color}:${transparent}:${mapKey}`;
        if (!this.cache.has(key)) {
            this.cache.set(
                key,
                new THREE.MeshBasicMaterial({
                    color,
                    map,
                    transparent,
                    side: THREE.DoubleSide
                })
            );
        }
        return this.cache.get(key);
    }

    getStandard(color, emissive = null, emissiveIntensity = 0) {
        const key = `standard:${color}:${emissive ?? 0}:${emissiveIntensity}`;
        if (!this.cache.has(key)) {
            this.cache.set(
                key,
                new THREE.MeshStandardMaterial({
                    color,
                    emissive: emissive || 0x000000,
                    emissiveIntensity
                })
            );
        }
        return this.cache.get(key);
    }

    createSprite(map) {
        return new THREE.SpriteMaterial({
            map,
            transparent: true,
            depthTest: true
        });
    }

    disposeAll() {
        this.cache.forEach((material) => material.dispose());
        this.cache.clear();
    }
}

export class ResourceRegistry {
    constructor() {
        this.textures = new TexturePool();
        this.geometries = new GeometryCache();
        this.materials = new MaterialCache();
    }

    disposeAll() {
        this.textures.disposeAll();
        this.materials.disposeAll();
        this.geometries.disposeAll();
    }
}