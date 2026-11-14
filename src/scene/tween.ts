import type { Scene } from "@babylonjs/core";

export type Ease = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number) =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** Kecepatan global animasi (1 = normal, 2 = 2x lebih cepat). */
export const Speed = { factor: 1 };

/** Tween berbasis Promise yang berjalan di render loop scene. */
export function tween(scene: Scene, durationSec: number, onUpdate: (t: number) => void, ease: Ease = Ease.linear) {
  const duration = Math.max(0.001, durationSec / Speed.factor);
  return new Promise<void>((resolve) => {
    let elapsed = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      elapsed += scene.getEngine().getDeltaTime() / 1000;
      const t = Math.min(1, elapsed / duration);
      onUpdate(ease(t));
      if (t >= 1) {
        scene.onBeforeRenderObservable.remove(obs);
        resolve();
      }
    });
  });
}

export function wait(scene: Scene, sec: number) {
  return tween(scene, sec, () => {});
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
