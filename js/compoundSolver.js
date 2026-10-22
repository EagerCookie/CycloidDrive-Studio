/**
 * Решатель двухвенцового дифференциального циклоидного редуктора (Compound / Differential Cycloid Drive)
 * 
 * Кинематика:
 *   - Венец 1 (Z1 зубьев) обкатывает неподвижный статор Stator 1 (Zs1 роликов).
 *     Угловая скорость вращения составного диска: w_disc = -1/Z1 * w_in.
 *   - Венец 2 (Z2 зубьев) сидит на том же эксцентрике (e) и жестко связан с венцом 1.
 *   - Выходное кольцо роликов (Zout роликов) обкатывается венцом 2 и вращается со скоростью:
 *     w_out = w_in * (Z1 * Zout - Zs1 * Z2) / (Z1 * Zout).
 *   - Передаточное число:
 *     i = (Z1 * Zout) / (Z1 * Zout - Zs1 * Z2).
 * 
 * Особенности:
 *   - Не требует ломких пальцев водила (Carrier Pins) и больших отверстий в теле диска.
 *   - Позволяет получать передаточные числа от 50:1 до 500:1 в одном компактном диске.
 *   - Поддерживает центровочные штифты (Dowel Pins) для прецизионного соединения
 *     двух раздельно напечатанных на 3D-принтере половинок диска (Stage 1 и Stage 2).
 */

import { SensingerSolver } from "./solvers/sensinger.js";
import { ZinclandSolver } from "./solvers/zincland.js";
import { EpitrochoidSolver } from "./solvers/epitrochoid.js";

export class CompoundCycloidSolver {
  /**
   * Рассчитать параметры и геометрию двухвенцового редуктора
   * @param {Object} params
   * @param {string} params.solver - "sensinger" | "zincland" | "epitrochoid"
   * @param {number} params.Z1 - Зубьев на венце 1 (статорном)
   * @param {number} params.Zs1 - Роликов на неподвижном статоре 1 (Z1 + 1)
   * @param {number} params.R1 - Радиус статора 1 (мм)
   * @param {number} params.Rr1 - Радиус ролика статора 1 (мм)
   * @param {number} params.clearance1 - Зазор венца 1 (мм)
   * @param {number} params.Z2 - Зубьев на венце 2 (выходном)
   * @param {number} params.Zout - Роликов на выходном кольце (Z2 + 1)
   * @param {number} params.R2 - Радиус кольца выхода (мм)
   * @param {number} params.Rr2 - Радиус ролика выхода (мм)
   * @param {number} params.clearance2 - Зазор венца 2 (мм)
   * @param {number} params.E - Общий эксцентриситет (мм)
   * @param {number} params.camBore - Диаметр отверстия под подшипник эксцентрика (мм)
   * @param {boolean} params.useDowelPins - Использовать штифты сопряжения дисков
   * @param {number} params.dowelD - Диаметр отверстий под штифты (мм)
   * @param {number} params.dowelR - Радиус расположения штифтов (мм)
   * @param {number} params.dowelN - Количество штифтов
   * @param {number} params.steps - Количество точек дискретизации
   */
  static solve(params) {
    const {
      solver = "sensinger",
      Z1 = 11,
      Zs1 = Z1 + 1,
      R1 = 35.0,
      Rr1 = 3.0,
      clearance1 = 0.05,

      Z2 = 10,
      Zout = Z2 + 1,
      R2 = 28.0,
      Rr2 = 2.5,
      clearance2 = 0.05,

      E = 1.2,
      camBore = 21.0,

      useDowelPins = true,
      dowelD = 3.0,
      dowelR = 16.0,
      dowelN = 4,

      steps = 1200
    } = params;

    // Выбор класса решателя
    let SolverClass = SensingerSolver;
    if (solver === "zincland") SolverClass = ZinclandSolver;
    else if (solver === "epitrochoid") SolverClass = EpitrochoidSolver;

    // 1. Построение профиля Венца 1
    const stage1 = SolverClass.solve({
      R: R1,
      Rr: Rr1,
      Z1: Z1,
      E: E,
      clearance: clearance1,
      camBore: camBore,
      steps: steps
    });

    // 2. Построение профиля Венца 2 (при строго том же E!)
    const stage2 = SolverClass.solve({
      R: R2,
      Rr: Rr2,
      Z1: Z2,
      E: E,
      clearance: clearance2,
      camBore: camBore,
      steps: steps
    });

    // 3. Ролики неподвижного статора 1
    const stator1Rollers = [];
    for (let j = 0; j < Zs1; j++) {
      const angle = (2 * Math.PI * j) / Zs1;
      stator1Rollers.push({
        x: R1 * Math.cos(angle),
        y: R1 * Math.sin(angle),
        radius: Rr1
      });
    }

    // 4. Ролики подвижного выходного кольца (в базовой ориентации при theta_out = 0)
    const outputRingRollers = [];
    for (let k = 0; k < Zout; k++) {
      const angle = (2 * Math.PI * k) / Zout;
      outputRingRollers.push({
        x: R2 * Math.cos(angle),
        y: R2 * Math.sin(angle),
        radius: Rr2
      });
    }

    // 5. Отверстия под штифты центровки и сопряжения дисков (Dowel Pins)
    const dowelHoles = [];
    if (useDowelPins && dowelN > 0) {
      for (let p = 0; p < dowelN; p++) {
        const angle = (2 * Math.PI * p) / dowelN;
        dowelHoles.push({
          x: dowelR * Math.cos(angle),
          y: dowelR * Math.sin(angle),
          radius: dowelD / 2
        });
      }
    }

    // 6. Кинематический расчёт
    const delta = Z1 * Zout - Zs1 * Z2;
    const ratio = delta !== 0 ? (Z1 * Zout) / delta : Infinity;
    const isSameDirection = ratio > 0;
    const ratioAbs = Math.abs(ratio);

    // 7. Анализ геометрии и стенок для 3D-печати
    const tWall1 = stage1.rootRadius - camBore / 2;
    const tWall2 = stage2.rootRadius - camBore / 2;
    const minToothRoot = Math.min(stage1.rootRadius, stage2.rootRadius);

    let dowelInnerMargin = 0;
    let dowelOuterMargin = 0;
    let dowelStatus = "ok";
    let dowelDesc = "";

    if (useDowelPins) {
      dowelInnerMargin = (dowelR - dowelD / 2) - camBore / 2;
      dowelOuterMargin = minToothRoot - (dowelR + dowelD / 2);

      if (dowelInnerMargin < 1.0) {
        dowelStatus = "error";
        dowelDesc = `Штифты слишком близко к центральному отверстию (зазор ${dowelInnerMargin.toFixed(2)} мм < 1.0 мм). Увеличьте радиус расположения штифтов.`;
      } else if (dowelOuterMargin < 1.2) {
        dowelStatus = "error";
        dowelDesc = `Штифты выходят во впадины зубьев (зазор ${dowelOuterMargin.toFixed(2)} мм < 1.2 мм). Уменьшите радиус расположения штифтов.`;
      } else {
        dowelStatus = "ok";
        dowelDesc = `Штифты центровки безопасно размещены (зазоры: внутри ${dowelInnerMargin.toFixed(2)} мм, снаружи ${dowelOuterMargin.toFixed(2)} мм).`;
      }
    }

    const minWall = Math.min(tWall1, tWall2);
    const wallStatus = minWall >= 1.5 ? "ok" : (minWall >= 1.0 ? "warning" : "error");

    return {
      name: "Compound Cycloid",
      isCompound: true,
      solver,
      Z1,
      Zs1,
      R1,
      Rr1,
      clearance1,
      Z2,
      Zout,
      R2,
      Rr2,
      clearance2,
      E,
      camBore,
      stage1,
      stage2,
      stator1Rollers,
      outputRingRollers,
      dowelPins: dowelHoles,
      useDowelPins,
      dowelD,
      dowelR,
      dowelN,
      ratio,
      kinematics: {
        ratio,
        ratioAbs,
        delta,
        isSameDirection,
        isSingular: delta === 0,
        formulaStr: `i = (${Z1} × ${Zout}) / (${Z1}×${Zout} − ${Zs1}×${Z2}) = ${Number.isFinite(ratio) ? (ratio > 0 ? "+" : "") + ratio.toFixed(2) : "∞"}`
      },
      diagnostics: {
        tWall1,
        tWall2,
        minWall,
        wallStatus,
        dowelInnerMargin,
        dowelOuterMargin,
        dowelStatus,
        dowelDesc,
        hasUndercutting: stage1.diagnostics.hasUndercutting || stage2.diagnostics.hasUndercutting,
        statusText: (stage1.diagnostics.hasUndercutting || stage2.diagnostics.hasUndercutting)
          ? "Обнаружено поднутрение профиля одного из венцов"
          : (delta === 0 ? "Сингулярность: нулевая разность зубьев (i = ∞)" : "Геометрия Compound корректна"),
        statusDesc: `Передаточное отношение ${ratio > 0 ? "+" : ""}${Number.isFinite(ratio) ? ratio.toFixed(1) : "∞"}:1. Направление: ${isSameDirection ? "Соосное с мотором" : "Реверсивное"}.`
      }
    };
  }
}
