/**
 * Решатель циклоидного профиля по методике Jonathon W. Sensinger (2010):
 * "Unified approach to Cycloid Drive Profile, Stress and Efficiency optimization"
 * Полный порт и математическое расширение SensingerCycloidSolver.cs
 */

export class SensingerSolver {
  /**
   * Рассчитать профиль и диагностику
   * @param {Object} params
   * @param {number} params.R - Радиус расположения роликов статора (мм)
   * @param {number} params.Rr - Радиус ролика статора (мм)
   * @param {number} params.Z1 - Число зубьев циклоидного диска
   * @param {number} params.E - Эксцентриситет (мм)
   * @param {number} params.clearance - Зазор профиля (эквидистанта)
   * @param {number} params.camBore - Диаметр центрального отверстия
   * @param {number} params.steps - Количество точек дискретизации
   */
  static solve(params) {
    const { R, Rr, Z1, E, clearance = 0, camBore = 22, steps = 1200 } = params;
    const Z2 = Z1 + 1; // Число роликов статора

    // 1. Проверка геометрических ограничений (Sensinger Constraints)
    // R_min: Минимальный радиус венца во избежание сингулярности
    const Rmin = Math.sqrt(
      (Math.pow(Rr, 2) * Math.pow(Z1 + 2, 3)) / (27 * Z1) +
      Math.pow(E, 2) * Math.pow(Z1 + 1, 2)
    );

    // Rr_max: Максимальный радиус ролика (чтобы ролики не пересекались и не было поднутрения)
    const Rrmax1 = R * Math.sin(Math.PI / Z2);
    const radInner = 27 * Z1 * (Math.pow(R, 2) - Math.pow(E, 2) * Math.pow(Z2, 2));
    const Rrmax2 = radInner > 0 ? Math.sqrt(radInner / Math.pow(Z1 + 2, 3)) : 0;
    const Rrmax = Math.min(Rrmax1, Rrmax2);

    // E_max: Максимально допустимый эксцентриситет
    const eRadInner = 27 * Math.pow(R, 2) * Z1 - Math.pow(Rr, 2) * Math.pow(Z1 + 2, 3);
    const Emax = eRadInner > 0 ? Math.sqrt(eRadInner / (27 * Z1 * Math.pow(Z2, 2))) : 0;

    // Коэффициент эксцентриситета K1 = (E * Z2) / R
    // Если K1 >= 1.0, возникает резкое поднутрение профиля (cusp / self-intersection)
    const k1 = (E * Z2) / R;
    const hasUndercutting = k1 >= 1.0 || R < Rmin || Rr > Rrmax || E > Emax;

    // 2. Построение контура циклоидного диска
    // Учитываем зазор (clearance), сдвигая эффективный радиус ролика Rr_eff = Rr + clearance
    const effectiveRr = Rr + clearance;
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const theta = (2 * Math.PI * i) / steps;

      // Угол контакта лепестка циклоиды и ролика:
      // Yr = atan2(sin(Z1 * theta), cos(Z1 * theta) - R / (E * (Z1 + 1)))
      const denom = Math.cos(Z1 * theta) - R / (E * Z2);
      const numer = Math.sin(Z1 * theta);
      const Yr = Math.atan2(numer, denom);

      const x = R * Math.cos(theta) + effectiveRr * Math.cos(theta + Yr) - E * Math.cos(Z2 * theta);
      const y = R * Math.sin(theta) + effectiveRr * Math.sin(theta + Yr) - E * Math.sin(Z2 * theta);

      points.push({ x, y });
    }

    // 3. Координаты роликов статора (в неподвижной СК статора)
    const rollers = [];
    for (let j = 0; j < Z2; j++) {
      const angle = (2 * Math.PI * j) / Z2;
      rollers.push({
        x: R * Math.cos(angle),
        y: R * Math.sin(angle),
        radius: Rr
      });
    }

    // 4. Габариты и радиусы диска
    let maxDist = 0;
    let minDist = Infinity;
    for (const pt of points) {
      const dist = Math.hypot(pt.x, pt.y);
      if (dist > maxDist) maxDist = dist;
      if (dist < minDist) minDist = dist;
    }

    return {
      name: "Sensinger",
      points,
      rollers,
      pinCount: Z2,
      discTeeth: Z1,
      ratio: Z1,
      R,
      Rr,
      E,
      camBore,
      outerRadius: maxDist,
      rootRadius: minDist,
      diagnostics: {
        k1,
        Rmin,
        Rrmax,
        Emax,
        hasUndercutting,
        statusText: hasUndercutting ? "Обнаружено поднутрение / нарушение ограничений" : "Геометрия корректна",
        statusDesc: hasUndercutting
          ? `K₁ = ${k1.toFixed(3)} (должно быть < 1.0). Уменьшите E или увеличьте R.`
          : `Профиль гладкий, зацепление без подклинивания. K₁ = ${k1.toFixed(3)}.`
      }
    };
  }
}
