import { Color4, DynamicTexture, ParticleSystem, Vector3, type Scene } from "@babylonjs/core";

/** Efek partikel: koin berhamburan, confetti, debu mendarat. */
export class Effects {
  private coinTex: DynamicTexture;
  private dotTex: DynamicTexture;

  constructor(private scene: Scene) {
    this.coinTex = this.circleTexture("coinTex", "#ffd23f", "#c98a00");
    this.dotTex = this.circleTexture("dotTex", "#ffffff", "#ffffff");
  }

  private circleTexture(name: string, fill: string, stroke: string) {
    const t = new DynamicTexture(name, { width: 64, height: 64 }, this.scene, false);
    t.hasAlpha = true;
    const ctx = t.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 64, 64);
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    t.update();
    return t;
  }

  private burst(opts: {
    at: Vector3;
    texture: DynamicTexture;
    count: number;
    colors: [Color4, Color4];
    size: [number, number];
    power: [number, number];
    gravity: number;
    life: [number, number];
    spread?: number;
  }) {
    const ps = new ParticleSystem("burst", opts.count, this.scene);
    ps.particleTexture = opts.texture;
    ps.emitter = opts.at.clone();
    const sp = opts.spread ?? 0.3;
    ps.minEmitBox = new Vector3(-sp, 0, -sp);
    ps.maxEmitBox = new Vector3(sp, 0, sp);
    ps.color1 = opts.colors[0];
    ps.color2 = opts.colors[1];
    ps.colorDead = new Color4(opts.colors[1].r, opts.colors[1].g, opts.colors[1].b, 0);
    ps.minSize = opts.size[0];
    ps.maxSize = opts.size[1];
    ps.minLifeTime = opts.life[0];
    ps.maxLifeTime = opts.life[1];
    ps.minEmitPower = opts.power[0];
    ps.maxEmitPower = opts.power[1];
    ps.direction1 = new Vector3(-1, 3, -1);
    ps.direction2 = new Vector3(1, 4, 1);
    ps.gravity = new Vector3(0, opts.gravity, 0);
    ps.minAngularSpeed = -4;
    ps.maxAngularSpeed = 4;
    ps.manualEmitCount = opts.count;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.disposeOnStop = true;
    ps.targetStopDuration = opts.life[1] + 0.2;
    ps.start();
  }

  coins(at: Vector3, count = 24) {
    this.burst({
      at,
      texture: this.coinTex,
      count,
      colors: [new Color4(1, 1, 1, 1), new Color4(1, 0.95, 0.7, 1)],
      size: [0.25, 0.45],
      power: [1.5, 2.5],
      gravity: -14,
      life: [0.6, 1],
    });
  }

  dust(at: Vector3) {
    this.burst({
      at,
      texture: this.dotTex,
      count: 10,
      colors: [new Color4(1, 1, 1, 0.8), new Color4(0.95, 0.9, 0.8, 0.6)],
      size: [0.15, 0.3],
      power: [0.4, 0.8],
      gravity: 0,
      life: [0.3, 0.5],
      spread: 0.4,
    });
  }

  confetti(at: Vector3) {
    const palette = ["#ff6b9a", "#5bb8ff", "#ffd23f", "#5fd35f", "#b57aff"];
    for (const hex of palette) {
      const c = Color4.FromHexString(`${hex}ff`);
      this.burst({
        at,
        texture: this.dotTex,
        count: 40,
        colors: [c, c],
        size: [0.2, 0.35],
        power: [3, 6],
        gravity: -6,
        life: [1.5, 2.5],
        spread: 2,
      });
    }
  }
}
