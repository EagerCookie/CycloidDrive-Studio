/**
 * Классический аналитический решатель на базе эпитрохоиды с эквидистантным смещением.
 * Описывает траекторию центра ролика и отступ по нормали на радиус ролика Rr.
 */

export class EpitrochoidSolver {
  static solve(params) {
    const { R, Rr, Z1, E, clearance = 0, camBore = 22, steps = 1200 } = params;
    const Z2 = Z1 + 1; // Число цевок/роликов
    const effectiveRr = Rr + clearance;

    // Параметры эпитрохоиды:
    // r1 - радиус центроиды диска = R * Z1 / Z2
    // r2 - радиус центроиды статора = R / Z2
    // e - эксцентриситет
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const phi = (2 * Math.PI * i) / steps;

      // Угол наклона касательной/нормали
      const psi = Math.atan2(
        Math.sin(Z1 * phi),
        Math.cos(Z1 * phi) - R / (E * Z2)
      );

      // Координаты эквидистанты
      const x = R * Math.cos(phi) + effectiveRr * Math.cos(phi + psi) - E * Math.cos(Z2 * phi);
      const y = R * Math.sin(phi) + effectiveRr * Math.sin(phi + psi) - E * Math.sin(Z2 * phi);

      points.push({ x, y });
    }

    const rollers = [];
    for (let j = 0; j < Z2; j++) {
      const angle = (2 * Math.PI * j) / Z2;
      rollers.push({
        x: R * Math.cos(angle),
        y: R * Math.sin(angle),
        radius: Rr
      });
    }

    const k1 = (E * Z2) / R;

    return {
      name: "Epitrochoid",
      points,
      rollers,
      pinCount: Z2,
      discTeeth: Z1,
      ratio: Z1,
      R,
      Rr,
      E,
      camBore,
      diagnostics: {
        k1,
        Rmin: R * 0.6,
        Rrmax: R * Math.sin(Math.PI / Z2),
        Emax: R / Z2,
        hasUndercutting: k1 >= 1.0,
        statusText: k1 < 1.0 ? "Геометрия корректна" : "Внимание: поднутрение профиля",
        statusDesc: `Классическая эпитрохоида. K₁ = ${k1.toFixed(3)}.`
      }
    };
  }
}
