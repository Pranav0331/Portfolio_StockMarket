if (typeof window !== 'undefined') {
  const canvasProto = HTMLCanvasElement.prototype as any;
  const dummyFn = () => {};

  const canvasContextMock = {
    fillRect: dummyFn,
    clearRect: dummyFn,
    getImageData: (x: any, y: any, w: any, h: any) => ({ data: new Array((w || 1) * (h || 1) * 4) }),
    putImageData: dummyFn,
    createImageData: () => [],
    setTransform: dummyFn,
    resetTransform: dummyFn,
    drawImage: dummyFn,
    save: dummyFn,
    fillText: dummyFn,
    strokeText: dummyFn,
    restore: dummyFn,
    beginPath: dummyFn,
    moveTo: dummyFn,
    lineTo: dummyFn,
    closePath: dummyFn,
    stroke: dummyFn,
    translate: dummyFn,
    scale: dummyFn,
    rotate: dummyFn,
    arc: dummyFn,
    arcTo: dummyFn,
    bezierCurveTo: dummyFn,
    quadraticCurveTo: dummyFn,
    fill: dummyFn,
    measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
    transform: dummyFn,
    rect: dummyFn,
    clip: dummyFn,
    setLineDash: dummyFn,
    getLineDash: () => [],
    createLinearGradient: () => ({ addColorStop: dummyFn }),
    createRadialGradient: () => ({ addColorStop: dummyFn }),
    createPattern: () => null
  };

  const origGetContext = canvasProto.getContext;
  canvasProto.getContext = function (type: string, ...args: any[]) {
    if (type === '2d') {
      const ctx = origGetContext ? origGetContext.apply(this, [type, ...args] as any) : null;
      if (!ctx) {
        return canvasContextMock;
      }
      for (const [key, fn] of Object.entries(canvasContextMock)) {
        if (!(key in ctx) || typeof (ctx as any)[key] !== 'function') {
          (ctx as any)[key] = fn;
        }
      }
      return ctx;
    }
    return origGetContext ? origGetContext.apply(this, [type, ...args] as any) : null;
  };
}
