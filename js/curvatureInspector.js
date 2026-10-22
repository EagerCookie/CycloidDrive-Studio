/**
 * Модуль контроля радиуса кривизны циклоидного профиля (Curvature Inspector).
 * Анализирует локальную кривизну kappa(t) и радиус rho(t) для предотвращения искажения
 * геометрии при 3D-печати (сопло не помещается во впадину) и фрезеровке на ЧПУ (концевая фреза).
 */

export class CurvatureInspector {
  /**
   * Пресеты диаметров стандартных инструментов
   */
  static getPresets() {
    return {
      // Сопла 3D-принтеров
      "nozzle-0.2": { name: "Сопло 3D-принтера 0.2 мм (r = 0.10 мм)", d: 0.2, type: "nozzle" },
      "nozzle-0.4": { name: "Сопло 3D-принтера 0.4 мм (r = 0.20 мм, Стандарт)", d: 0.4, type: "nozzle" },
      "nozzle-0.6": { name: "Сопло 3D-принтера 0.6 мм (r = 0.30 мм)", d: 0.6, type: "nozzle" },
      "nozzle-0.8": { name: "Сопло 3D-принтера 0.8 мм (r = 0.40 мм)", d: 0.8, type: "nozzle" },
      "nozzle-1.0": { name: "Сопло 3D-принтера 1.0 мм (r = 0.50 мм)", d: 1.0, type: "nozzle" },

      // Концевые фрезы ЧПУ
      "mill-1.0":   { name: "Фреза ЧПУ Ø 1.0 мм (r = 0.50 мм)", d: 1.0, type: "mill" },
      "mill-1.5":   { name: "Фреза ЧПУ Ø 1.5 мм (r = 0.75 мм)", d: 1.5, type: "mill" },
      "mill-2.0":   { name: "Фреза ЧПУ Ø 2.0 мм (r = 1.00 мм)", d: 2.0, type: "mill" },
      "mill-3.175": { name: "Фреза ЧПУ Ø 3.175 мм / 1/8\" (r = 1.59 мм)", d: 3.175, type: "mill" },
      "mill-4.0":   { name: "Фреза ЧПУ Ø 4.0 мм (r = 2.00 мм)", d: 4.0, type: "mill" },
      "mill-6.0":   { name: "Фреза ЧПУ Ø 6.0 мм (r = 3.00 мм)", d: 6.0, type: "mill" },

      // Пользовательский инструмент
      "custom": null
    };
  }

  /**
   * Анализ радиуса кривизны контура диска
   * @param {Array<{x: number, y: number}>} points Точки контура диска
   * @param {number} toolDiameter Диаметр инструмента (сопла или фрезы) в мм
   * @returns {Object} Результаты инженерного анализа кривизны
   */
  static analyze(points, toolDiameter = 0.4) {
    if (!points || points.length < 3) {
      return {
        pointData: [],
        minRhoConcave: 0,
        minRhoConvex: 0,
        minRhoOverall: 0,
        maxSafeToolDiameter: 0,
        criticalPoints: [],
        status: "ok",
        title: "Недостаточно данных",
        desc: "Профиль не содержит точек для анализа.",
        toolRadius: toolDiameter / 2,
        toolDiameter,
        sharpestTrough: null,
        recommendations: { nozzle: "0.4 мм", endmill: "2.0 мм" }
      };
    }

    const toolRadius = Math.max(0.01, toolDiameter / 2);
    // Проверяем замкнутость: если последняя точка совпадает с первой
    const isClosed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6;
    const N = isClosed ? points.length - 1 : points.length;

    let minRhoConcave = Infinity;
    let minRhoConvex = Infinity;
    let minRhoOverall = Infinity;

    let sharpestTrough = null;
    const criticalPoints = [];
    const pointData = new Array(N);

    // Центральные разности для гладкого вычисления производных
    for (let i = 0; i < N; i++) {
      const prev = points[(i - 1 + N) % N];
      const curr = points[i];
      const next = points[(i + 1) % N];

      const dx = (next.x - prev.x) / 2;
      const dy = (next.y - prev.y) / 2;
      const d2x = next.x - 2 * curr.x + prev.x;
      const d2y = next.y - 2 * curr.y + prev.y;

      const cross = dx * d2y - dy * d2x;
      const speed = Math.hypot(dx, dy);

      let kappa = 0;
      let rho = 10000; // по умолчанию очень большой радиус (прямой участок)

      if (speed > 1e-9) {
        kappa = cross / Math.pow(speed, 3);
        const absKappa = Math.abs(kappa);
        if (absKappa > 1e-12) {
          rho = 1 / absKappa;
        }
      }

      // При обходе против часовой стрелки:
      // cross < 0 -> поворот направо -> вогнутый участок (впадина / root)
      // cross >= 0 -> поворот налево -> выпуклый участок (вершина / crest)
      const isConcave = cross < 0;

      // Нормаль и центр соприкасающейся окружности (osculating circle)
      let cx = curr.x;
      let cy = curr.y;
      if (speed > 1e-9 && Math.abs(kappa) > 1e-12) {
        cx = curr.x + (-dy / speed) / kappa;
        cy = curr.y + (dx / speed) / kappa;
      }

      // Центр инструмента, приложенного к точке касания с внешней стороны диска
      // Для вогнутой впадины центр инструмента смещается в сторону кривизны (наружу впадины)
      let toolCx = curr.x;
      let toolCy = curr.y;
      if (speed > 1e-9) {
        // Единичная наружная нормаль к профилю диска
        const nx = dy / speed;
        const ny = -dx / speed;
        toolCx = curr.x + nx * toolRadius;
        toolCy = curr.y + ny * toolRadius;
      }

      const pInfo = {
        x: curr.x,
        y: curr.y,
        rho,
        kappa,
        isConcave,
        cx,
        cy,
        toolCx,
        toolCy,
        danger: 0 // 0: безопасно, 1: критично
      };

      if (isConcave) {
        if (rho < minRhoConcave) {
          minRhoConcave = rho;
          sharpestTrough = pInfo;
        }

        // Оценка опасности для вогнутых участков:
        if (rho < toolRadius) {
          pInfo.danger = 1.0; // инструмент физически толще впадины
          criticalPoints.push(pInfo);
        } else if (rho < toolRadius * 1.3) {
          pInfo.danger = 0.5 + 0.5 * (1.3 * toolRadius - rho) / (0.3 * toolRadius); // на грани
        } else if (rho < toolRadius * 2.0) {
          pInfo.danger = 0.25;
        } else {
          pInfo.danger = 0;
        }
      } else {
        if (rho < minRhoConvex) {
          minRhoConvex = rho;
        }
        pInfo.danger = 0;
      }

      if (rho < minRhoOverall) {
        minRhoOverall = rho;
      }

      pointData[i] = pInfo;
    }

    if (minRhoConcave === Infinity) minRhoConcave = minRhoOverall;
    if (minRhoConvex === Infinity) minRhoConvex = minRhoOverall;

    const maxSafeToolDiameter = 2 * minRhoConcave;
    const safetyFactor = minRhoConcave / toolRadius;

    // Формирование инженерного заключения и рекомендаций
    let status = "ok";
    let title = "";
    let desc = "";

    if (safetyFactor < 1.0) {
      status = "critical";
      title = `Критично: Инструмент Ø${toolDiameter.toFixed(2)} мм не помещается во впадины!`;
      desc = `Минимальный радиус впадины ρ_min = ${minRhoConcave.toFixed(2)} мм острее радиуса инструмента (r = ${toolRadius.toFixed(2)} мм). При 3D-печати сопло срежет дно впадин диска, а фреза ЧПУ сделает зарез. Уменьшите инструмент до Ø ≤ ${maxSafeToolDiameter.toFixed(2)} мм или включите Root Relief.`;
    } else if (safetyFactor < 1.3) {
      status = "warning";
      title = `Внимание: Зазор инструмента на пределе (запас ${(safetyFactor * 100 - 100).toFixed(0)}%)`;
      desc = `Радиус впадины (${minRhoConcave.toFixed(2)} мм) очень близок к радиусу инструмента (${toolRadius.toFixed(2)} мм). Рекомендуется использовать инструмент меньшего диаметра (до Ø ${maxSafeToolDiameter.toFixed(1)} мм) для сохранения идеальной формы профиля.`;
    } else {
      status = "ok";
      title = `Геометрия оптимальна: Инструмент Ø${toolDiameter.toFixed(2)} мм проходит свободно`;
      desc = `Минимальный радиус впадин диска ρ_min = ${minRhoConcave.toFixed(2)} мм превышает радиус инструмента в ${safetyFactor.toFixed(1)} раза. Профиль будет воспроизведён с высокой точностью без искажения боковых фланцев.`;
    }

    // Рекомендации для 3D-сопел и фрез ЧПУ
    let recNozzle = "0.4 мм";
    if (maxSafeToolDiameter < 0.25) recNozzle = "0.2 мм";
    else if (maxSafeToolDiameter < 0.45) recNozzle = "0.4 мм";
    else if (maxSafeToolDiameter < 0.65) recNozzle = "0.6 мм";
    else if (maxSafeToolDiameter < 0.85) recNozzle = "0.8 мм";
    else recNozzle = "1.0 мм (или любое стандартное)";

    let recEndmill = "1.0 мм";
    if (maxSafeToolDiameter < 1.2) recEndmill = "1.0 мм";
    else if (maxSafeToolDiameter < 1.8) recEndmill = "1.5 мм";
    else if (maxSafeToolDiameter < 2.5) recEndmill = "2.0 мм";
    else if (maxSafeToolDiameter < 3.5) recEndmill = "3.175 мм (1/8\")";
    else if (maxSafeToolDiameter < 4.5) recEndmill = "4.0 мм";
    else recEndmill = "6.0 мм";

    return {
      pointData,
      minRhoConcave,
      minRhoConvex,
      minRhoOverall,
      maxSafeToolDiameter,
      criticalPoints,
      safetyFactor,
      status,
      title,
      desc,
      toolRadius,
      toolDiameter,
      sharpestTrough,
      recommendations: {
        nozzle: recNozzle,
        endmill: recEndmill
      }
    };
  }
}
