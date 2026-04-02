export function installCanvasPolyfills() {
    const proto = globalThis.CanvasRenderingContext2D?.prototype;

    if (!proto || proto.roundRect) {
        return;
    }

    proto.roundRect = function roundRect(x, y, width, height, radius) {
        let cornerRadius = radius;
        if (width < 2 * cornerRadius) {
            cornerRadius = width / 2;
        }
        if (height < 2 * cornerRadius) {
            cornerRadius = height / 2;
        }

        this.moveTo(x + cornerRadius, y);
        this.arcTo(x + width, y, x + width, y + height, cornerRadius);
        this.arcTo(x + width, y + height, x, y + height, cornerRadius);
        this.arcTo(x, y + height, x, y, cornerRadius);
        this.arcTo(x, y, x + width, y, cornerRadius);
        this.closePath();

        return this;
    };
}