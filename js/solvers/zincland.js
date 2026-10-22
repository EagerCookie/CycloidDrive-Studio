/**
 * Решатель циклоидного зацепления Zincland (Alex Lait, 2009)
 * Прямой порт алгоритма из ZinclandCycloidSolver.cs
 */

export class ZinclandSolver {
  static solve(params) {
    const { R, Rr, Z1, E, clearance = 0, camBore = 22, steps = 1200 } = params;

    const n = Z1;
    const b = R;
    const p = b / n;
    const d = (Rr + clearance) * 2;
    const e = E;
    const s = steps;
    const ang = 50; // предельный угол давления
    const c = 0;

    const calcCyp = (a) => {
      const numer = Math.sin(n * a);
      const denom = Math.cos(n * a) + (n * p) / (e * (n + 1));
      return Math.atan2(numer, denom);
    };

    const calcX = (a) => {
      return (n * p) * Math.cos(a) + e * Math.cos((n + 1) * a) - (d / 2) * Math.cos(calcCyp(a) + a);
    };

    const calcY = (a) => {
      return (n * p) * Math.sin(a) + e * Math.sin((n + 1) * a) - (d / 2) * Math.sin(calcCyp(a) + a);
    };

    const calcPressureAngle = (a) => {
      const ex = Math.SQRT2;
      const r3 = p * n;
      const rg = r3 / ex;
      const pp = rg * Math.sqrt(2 + 1 - 2 * ex * Math.cos(a)) - d / 2;
      return Math.asin((r3 * Math.cos(a) - rg) / (pp + d / 2)) * (180 / Math.PI);
    };

    const calcPressureLimit = (a) => {
      const ex = Math.SQRT2;
      const r3 = p * n;
      const rg = r3 / ex;
      const q = Math.sqrt(r3 * r3 + rg * rg - 2 * r3 * rg * Math.cos(a));
      const x = rg - e + ((q - d / 2) * (r3 * Math.cos(a) - rg)) / q;
      const y = ((q - d / 2) * r3 * Math.sin(a)) / q;
      return Math.sqrt(x * x + y * y);
    };

    let minAngle = -1.0;
    let maxAngle = -1.0;
    for (let i = 0; i < 180; ++i) {
      const pa = calcPressureAngle((i * Math.PI) / 180);
      if (pa < ang && minAngle < 0) minAngle = i;
      if (pa < -ang && maxAngle < 0) maxAngle = i - 1;
    }

    const minRadius = minAngle >= 0 ? calcPressureLimit((minAngle * Math.PI) / 180) : 0;
    const maxRadius = maxAngle >= 0 ? calcPressureLimit((maxAngle * Math.PI) / 180) : Infinity;

    const points = [];
    const qStep = (2 * Math.PI) / s;
    for (let j = 0; j <= s; ++j) {
      const a = qStep * j;
      let x = calcX(a);
      let y = calcY(a);

      // В оригинале: x -= e для смещения центра
      // Центрируем диск в (0,0) для симметрии
      points.push({ x: x - e, y: y });
    }

    const rollers = [];
    const Z2 = n + 1;
    for (let k = 0; k < Z2; ++k) {
      const angle = (2 * Math.PI / Z2) * k;
      rollers.push({
        x: p * n * Math.cos(angle),
        y: p * n * Math.sin(angle),
        radius: d / 2
      });
    }

    const k1 = (e * Z2) / (p * n);

    return {
      name: "Zincland",
      points,
      rollers,
      pinCount: Z2,
      discTeeth: n,
      ratio: n,
      R,
      Rr: d / 2,
      E,
      camBore,
      minPressureRadius: minRadius,
      maxPressureRadius: maxRadius,
      diagnostics: {
        k1,
        Rmin: minRadius,
        Rrmax: (p * n * Math.sin(Math.PI / Z2)),
        Emax: p * n / Z2,
        hasUndercutting: k1 >= 1.0,
        statusText: k1 < 1.0 ? "Геометрия корректна" : "Предупреждение: K₁ >= 1.0",
        statusDesc: `Метод Zincland Classic. Угол давления ограничен: 50°.`
      }
    };
  }
}
