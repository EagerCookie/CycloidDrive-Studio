/**
 * Модуль модификации циклоидного профиля под 3D-печать и фрезеровку (Tip Relief & Root Relief).
 * 
 * 1. Tip Relief (Притупление / срез вершин):
 *    Устраняет наплывы пластика на кончиках зубьев, возникающие из-за углового перелива сопла принтера.
 *    - 'truncate': строгое цилиндрическое усечение по радиусу R_cut = R_max - h_tip (стандарт Nabtesco / Spinea).
 *    - 'smooth': гладкое сопряжение полиномом Эрмита (Smoothstep C1) в верхней зоне зуба.
 * 
 * 2. Root Relief (Углубление впадин / Bottom Clearance):
 *    Создает гарантированный радиальный зазор во впадинах, исключая заклинивание при утыкании роликов в дно.
 *    Плавное углубление с гладкостью C1 на базе Smoothstep в придонной зоне зуба.
 */

export class ProfileRelief {
  /**
   * Применить модификации к замкнутому контуру циклоидного диска
   * @param {Array<{x: number, y: number}>} points Исходные точки контура диска
   * @param {Object} options Параметры модификации
   * @param {boolean} options.enabled Включена ли модификация
   * @param {number} options.tipRelief Срез вершины h_tip (мм)
   * @param {number} options.rootRelief Зазор впадины h_root (мм)
   * @param {string} options.tipMode 'truncate' | 'smooth'
   * @param {number} options.tipZone Доля зуба для плавного притупления (0.15 - 0.40)
   * @param {number} options.rootZone Доля зуба для углубления впадины (0.15 - 0.40)
   * @returns {{ points: Array<{x: number, y: number}>, stats: Object }}
   */
  static apply(points, options = {}) {
    if (!points || points.length === 0) {
      return {
        points: [],
        stats: { rMaxOrig: 0, rMinOrig: 0, rMaxRelieved: 0, rMinRelieved: 0, toothHeight: 0 }
      };
    }

    const {
      enabled = true,
      tipRelief = 0.20,
      rootRelief = 0.10,
      tipMode = "truncate",
      tipZone = 0.25,
      rootZone = 0.25
    } = options;

    // Вычисляем исходные экстремумы радиусов
    let rMaxOrig = -Infinity;
    let rMinOrig = Infinity;

    for (let i = 0; i < points.length; i++) {
      const r = Math.hypot(points[i].x, points[i].y);
      if (r > rMaxOrig) rMaxOrig = r;
      if (r < rMinOrig) rMinOrig = r;
    }

    const toothHeightOrig = rMaxOrig - rMinOrig;

    // Если модификация выключена или параметры равны 0
    if (!enabled || (tipRelief <= 0 && rootRelief <= 0) || toothHeightOrig <= 1e-6) {
      return {
        points: points.map(p => ({ x: p.x, y: p.y })),
        stats: {
          rMaxOrig,
          rMinOrig,
          rMaxRelieved: rMaxOrig,
          rMinRelieved: rMinOrig,
          toothHeight: toothHeightOrig
        }
      };
    }

    const effectiveTipRelief = Math.min(tipRelief, toothHeightOrig * 0.45);
    const effectiveRootRelief = Math.min(rootRelief, toothHeightOrig * 0.45);
    const Rcut = rMaxOrig - effectiveTipRelief;

    let rMaxRelieved = -Infinity;
    let rMinRelieved = Infinity;

    const modifiedPoints = points.map(p => {
      const r = Math.hypot(p.x, p.y);
      if (r < 1e-9) return { x: p.x, y: p.y };

      // Нормализованная высота зуба: 0 (дно впадины) .. 1 (вершина зуба)
      const t = Math.max(0, Math.min(1, (r - rMinOrig) / toothHeightOrig));
      let newR = r;

      // 1. Притупление вершины (Tip Relief)
      if (effectiveTipRelief > 0) {
        if (tipMode === "truncate") {
          // Строгий цилиндрический срез вершины
          if (newR > Rcut) {
            newR = Rcut;
          }
        } else {
          // Плавное сопряжение (Smoothstep C1) в верхней зоне
          const tStart = 1.0 - tipZone;
          if (t > tStart) {
            const u = (t - tStart) / tipZone;
            const ease = u * u * (3 - 2 * u); // Smoothstep Hermite
            newR -= effectiveTipRelief * ease;
          }
        }
      }

      // 2. Углубление впадины (Root Relief / Bottom Clearance)
      if (effectiveRootRelief > 0) {
        if (t < rootZone) {
          const u = 1.0 - t / rootZone;
          const ease = u * u * (3 - 2 * u); // Smoothstep Hermite
          newR -= effectiveRootRelief * ease;
        }
      }

      // Безопасный радиус (не меньше нуля)
      newR = Math.max(0.1, newR);
      if (newR > rMaxRelieved) rMaxRelieved = newR;
      if (newR < rMinRelieved) rMinRelieved = newR;

      const scale = newR / r;
      return {
        x: p.x * scale,
        y: p.y * scale
      };
    });

    return {
      points: modifiedPoints,
      stats: {
        rMaxOrig,
        rMinOrig,
        rMaxRelieved,
        rMinRelieved,
        toothHeight: rMaxRelieved - rMinRelieved,
        effectiveTipRelief,
        effectiveRootRelief
      }
    };
  }
}
