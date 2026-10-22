/**
 * Модуль рендеринга на Canvas с поддержкой Pan/Zoom, HiDPI и кинематической симуляции
 */

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Параметры камеры и видового экрана
    this.scale = 7.0; // пикселей на миллиметр
    this.panX = 0;
    this.panY = 0;

    // Состояние мыши для перетаскивания
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Видимость слоев
    this.layers = {
      cam1: true,
      cam2: true,
      eccentric: true,
      rollers: true,
      carrier: true,
      pitch: false,
      curvature: false,
      outputRing: true,
      dowels: true
    };

    this.setupEvents();
    this.resize();
  }

  setupEvents() {
    window.addEventListener("resize", () => this.resize());

    // Перетаскивание холста (Pan)
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (this.onViewChange) this.onViewChange();
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    // Масштабирование колесиком мыши (Zoom к курсору)
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - this.canvas.width / 2 - this.panX;
      const mouseY = e.clientY - rect.top - this.canvas.height / 2 - this.panY;

      this.panX -= mouseX * (zoomFactor - 1);
      this.panY -= mouseY * (zoomFactor - 1);
      this.scale *= zoomFactor;

      // Ограничение масштаба
      if (this.scale < 1.0) this.scale = 1.0;
      if (this.scale > 60.0) this.scale = 60.0;

      if (this.onViewChange) this.onViewChange();
    }, { passive: false });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
    if (this.onViewChange) this.onViewChange();
  }

  resetView() {
    this.scale = 7.0;
    this.panX = 0;
    this.panY = 0;
    if (this.onViewChange) this.onViewChange();
  }

  zoom(factor) {
    this.scale *= factor;
    if (this.scale < 1.0) this.scale = 1.0;
    if (this.scale > 60.0) this.scale = 60.0;
    if (this.onViewChange) this.onViewChange();
  }

  render(scene) {
    const {
      solution,
      carrier,
      eccentric,
      dualDisc,
      crankAngleDeg,
      curvatureAnalysis,
      stressAnalysis
    } = scene;

    const ctx = this.ctx;
    const width = this.displayWidth;
    const height = this.displayHeight;

    // Очистка холста
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Переход в мировую систему координат: центр холста + pan
    ctx.translate(width / 2 + this.panX, height / 2 + this.panY);
    ctx.scale(this.scale, -this.scale); // Инвертируем Y для стандартной правой СК

    // 1. Отрисовка координатной сетки
    this.drawGrid(ctx);

    // Если активен двухвенцовый режим Compound
    if (scene.isCompound && scene.compoundSolution) {
      this.drawCompoundScene(scene);
      ctx.restore();
      return;
    }

    if (!solution || !solution.points || solution.points.length === 0) {
      ctx.restore();
      return;
    }

    const crankRad = (crankAngleDeg * Math.PI) / 180;
    const discAngleRad = -crankRad / solution.discTeeth;
    const E = solution.E;

    // Вспомогательные окружности (Pitch circles / оси)
    if (this.layers.pitch) {
      this.drawPitchCircles(ctx, solution, carrier);
    }

    // 2. Ролики статора (неподвижные) с динамической визуализацией распределения нагрузки
    if (this.layers.rollers && solution.rollers) {
      this.drawStatorRollers(ctx, solution.rollers, stressAnalysis, crankRad, solution);
    }

    // 3. Диск 2 (со сдвигом 180°), если включен
    if (dualDisc && this.layers.cam2) {
      const crank2Rad = crankRad + Math.PI;
      const disc2AngleRad = -crank2Rad / solution.discTeeth;
      const cx2 = E * Math.cos(crank2Rad);
      const cy2 = E * Math.sin(crank2Rad);

      const holeAngleOffset = Math.PI / solution.discTeeth;

      this.drawDisc(ctx, solution, carrier, cx2, cy2, disc2AngleRad, {
        stroke: "#ff007f",
        fill: "rgba(255, 0, 127, 0.12)",
        boreStroke: "#ff77a9",
        holeStroke: "#ff77a9",
        lineWidth: 1.6 / this.scale
      }, holeAngleOffset);
    }

    // 4. Диск 1 (основной рабочий профиль)
    if (this.layers.cam1 || this.layers.curvature) {
      const cx1 = E * Math.cos(crankRad);
      const cy1 = E * Math.sin(crankRad);

      if (this.layers.cam1) {
        this.drawDisc(ctx, solution, carrier, cx1, cy1, discAngleRad, {
          stroke: "#00f2fe",
          fill: "rgba(0, 242, 254, 0.18)",
          boreStroke: "#ec4899",
          holeStroke: "#f59e0b",
          lineWidth: 2.0 / this.scale
        });

        // Линия и точка эксцентрика
        this.drawEccentricMarker(ctx, cx1, cy1);
      }

      // Визуализация тепловой карты кривизны и сопла/фрезы
      if (this.layers.curvature && curvatureAnalysis) {
        this.drawCurvatureOverlay(ctx, solution, cx1, cy1, discAngleRad, curvatureAnalysis);
      }
    }

    // 5. Узел эксцентрика и вала двигателя
    if (this.layers.eccentric && eccentric) {
      this.drawEccentricAssembly(ctx, solution, eccentric, crankRad, dualDisc);
    }

    // 6. Выходной механизм (пальцы каретки/водила)
    if (this.layers.carrier && carrier) {
      this.drawCarrierPins(ctx, carrier, discAngleRad);
    }

    // 7. Центры и маркеры
    this.drawCenterMarker(ctx);

    ctx.restore();
  }

  /**
   * Отрисовка двухвенцового дифференциального редуктора (Compound Cycloid)
   */
  drawCompoundScene(scene) {
    const { compoundSolution, crankAngleDeg, eccentric } = scene;
    const sol = compoundSolution;
    const ctx = this.ctx;

    const crankRad = (crankAngleDeg * Math.PI) / 180;
    const discAngleRad = -crankRad / sol.Z1;
    const ratio = sol.kinematics.ratio;
    const outAngleRad = Number.isFinite(ratio) && ratio !== 0 ? crankRad / ratio : 0;
    const E = sol.E;
    const cx = E * Math.cos(crankRad);
    const cy = E * Math.sin(crankRad);

    // 1. Неподвижный статор 1 (Stator 1)
    if (this.layers.rollers && sol.stator1Rollers) {
      this.drawStator1Ring(ctx, sol);
    }

    // 2. Подвижное кольцо выхода (Output Ring)
    if (this.layers.outputRing && sol.outputRingRollers) {
      this.drawOutputRing(ctx, sol, outAngleRad);
    }

    // 3. Венец 1 (Статорный ярус Z1)
    if (this.layers.cam1 && sol.stage1 && sol.stage1.points) {
      this.drawCompoundLobe(ctx, sol.stage1.points, cx, cy, discAngleRad, {
        stroke: "#00f2fe",
        fill: "rgba(0, 242, 254, 0.16)",
        lineWidth: 2.2 / this.scale
      });
    }

    // 4. Венец 2 (Выходной ярус Z2)
    if (this.layers.cam2 && sol.stage2 && sol.stage2.points) {
      this.drawCompoundLobe(ctx, sol.stage2.points, cx, cy, discAngleRad, {
        stroke: "#c084fc",
        fill: "rgba(192, 132, 252, 0.22)",
        lineWidth: 2.2 / this.scale
      });
    }

    // 5. Отверстия под штифты центровки (Dowel Pins)
    if (this.layers.dowels && sol.useDowelPins && sol.dowelPins) {
      this.drawDowelPins(ctx, sol.dowelPins, cx, cy, discAngleRad);
    }

    // 6. Центральное отверстие под подшипник эксцентрика
    this.drawCentralBore(ctx, cx, cy, sol.camBore);

    // 7. Эксцентрик и вал
    if (this.layers.eccentric && eccentric) {
      this.drawEccentricAssembly(ctx, { camBore: sol.camBore, E: sol.E }, eccentric, crankRad, false);
    }

    // 8. Маркер эксцентрика и центра
    this.drawEccentricMarker(ctx, cx, cy);
    this.drawCenterMarker(ctx);
  }

  drawStator1Ring(ctx, sol) {
    ctx.save();
    const R1 = sol.R1;
    const Rr1 = sol.Rr1;
    const housingOuterR = R1 + Rr1 + 6.0;

    // Внешнее кольцо корпуса статора
    ctx.strokeStyle = "rgba(56, 239, 125, 0.35)";
    ctx.lineWidth = 1.8 / this.scale;
    ctx.setLineDash([4 / this.scale, 3 / this.scale]);
    ctx.beginPath();
    ctx.arc(0, 0, housingOuterR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ролики статора 1
    for (let j = 0; j < sol.stator1Rollers.length; j++) {
      const r = sol.stator1Rollers[j];
      ctx.fillStyle = "rgba(56, 239, 125, 0.22)";
      ctx.strokeStyle = "#38ef7d";
      ctx.lineWidth = 1.5 / this.scale;

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38ef7d";
      ctx.beginPath();
      ctx.arc(r.x, r.y, 0.7 / this.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawOutputRing(ctx, sol, outAngleRad) {
    ctx.save();
    const R2 = sol.R2;
    const Rr2 = sol.Rr2;
    const ringOuterR = R2 + Rr2 + 4.5;

    // Вращающееся тело выходного кольца
    ctx.save();
    ctx.rotate(outAngleRad);

    // Внешняя граница кольца выхода
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
    ctx.lineWidth = 1.8 / this.scale;
    ctx.beginPath();
    ctx.arc(0, 0, ringOuterR, 0, Math.PI * 2);
    ctx.stroke();

    // 4 радиальные контрольные метки (спицы) для наглядности вращения выхода
    ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
    ctx.lineWidth = 2.0 / this.scale;
    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      const x1 = (ringOuterR - 1.5) * Math.cos(angle);
      const y1 = (ringOuterR - 1.5) * Math.sin(angle);
      const x2 = (ringOuterR + 3.0) * Math.cos(angle);
      const y2 = (ringOuterR + 3.0) * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Ролики кольца выхода (повернуты на outAngleRad)
    for (let k = 0; k < sol.outputRingRollers.length; k++) {
      const baseR = sol.outputRingRollers[k];
      const baseAngle = Math.atan2(baseR.y, baseR.x);
      const currAngle = baseAngle + outAngleRad;
      const rx = R2 * Math.cos(currAngle);
      const ry = R2 * Math.sin(currAngle);

      ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.6 / this.scale;

      ctx.beginPath();
      ctx.arc(rx, ry, baseR.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(rx, ry, 0.7 / this.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCompoundLobe(ctx, points, cx, cy, discAngleRad, style) {
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(discAngleRad);

    ctx.strokeStyle = style.stroke;
    ctx.fillStyle = style.fill;
    ctx.lineWidth = style.lineWidth;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawDowelPins(ctx, pins, cx, cy, discAngleRad) {
    if (!pins || pins.length === 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(discAngleRad);

    for (const p of pins) {
      ctx.fillStyle = "rgba(203, 213, 225, 0.4)";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.4 / this.scale;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Осевое перекрестие штифта
      const crossSize = p.radius * 0.6;
      ctx.strokeStyle = "rgba(203, 213, 225, 0.8)";
      ctx.lineWidth = 1.0 / this.scale;
      ctx.beginPath();
      ctx.moveTo(p.x - crossSize, p.y);
      ctx.lineTo(p.x + crossSize, p.y);
      ctx.moveTo(p.x, p.y - crossSize);
      ctx.lineTo(p.x, p.y + crossSize);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCentralBore(ctx, cx, cy, boreDiameter) {
    ctx.save();
    ctx.strokeStyle = "#ec4899";
    ctx.fillStyle = "rgba(10, 15, 29, 0.8)";
    ctx.lineWidth = 1.8 / this.scale;

    ctx.beginPath();
    ctx.arc(cx, cy, boreDiameter / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawGrid(ctx) {
    const step = 10; // Сетка 10 мм
    const extent = 200;
    ctx.lineWidth = 0.5 / this.scale;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";

    ctx.beginPath();
    for (let x = -extent; x <= extent; x += step) {
      ctx.moveTo(x, -extent);
      ctx.lineTo(x, extent);
    }
    for (let y = -extent; y <= extent; y += step) {
      ctx.moveTo(-extent, y);
      ctx.lineTo(extent, y);
    }
    ctx.stroke();

    // Главные координатные оси
    ctx.lineWidth = 1.0 / this.scale;
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.beginPath();
    ctx.moveTo(-extent, 0); ctx.lineTo(extent, 0);
    ctx.moveTo(0, -extent); ctx.lineTo(0, extent);
    ctx.stroke();
  }

  drawStatorRollers(ctx, rollers, stressData = null, crankRad = 0, solution = null) {
    ctx.save();
    const hasStress = stressData && stressData.FmaxRoller > 0;
    const Z2 = rollers.length;
    const Z1 = solution ? solution.discTeeth : (Z2 - 1);
    const E = solution ? solution.E : 1.5;
    const Rp = E * Z1;

    // Мгновенный центр скоростей (Pitch point / ICV) для истинного направления линии действия сил контакта
    const pitchX = Rp * Math.cos(crankRad);
    const pitchY = Rp * Math.sin(crankRad);

    for (let j = 0; j < Z2; j++) {
      const r = rollers[j];
      const rollerAngle = Math.atan2(r.y, r.x);

      // Динамический расчёт угла нагрузки относительно текущего угла эксцентрика
      let loadRatio = 0;
      let force = 0;

      if (hasStress) {
        // Угол ролика в системе координат эксцентрика
        const psi = rollerAngle - crankRad;
        const sinPsi = Math.sin(psi);
        if (sinPsi > 0.001) {
          loadRatio = sinPsi;
          force = stressData.FmaxRoller * loadRatio;
        }
      }

      // Тело ролика
      if (hasStress && loadRatio > 0.05) {
        // Активный нагруженный ролик — янтарный цвет в зависимости от величины силы
        ctx.fillStyle = `rgba(245, 158, 11, ${0.18 + 0.45 * loadRatio})`;
        ctx.strokeStyle = loadRatio > 0.6 ? "#f59e0b" : "#eab308";
        ctx.lineWidth = (1.4 + 1.2 * loadRatio) / this.scale;
      } else {
        // Ненагруженный ролик статора — стандартный изумрудный
        ctx.fillStyle = "rgba(56, 239, 125, 0.15)";
        ctx.strokeStyle = "#38ef7d";
        ctx.lineWidth = 1.4 / this.scale;
      }

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Центр ролика
      ctx.fillStyle = hasStress && loadRatio > 0.05 ? "#f59e0b" : "#38ef7d";
      ctx.beginPath();
      ctx.arc(r.x, r.y, 0.6 / this.scale, 0, Math.PI * 2);
      ctx.fill();

      // Вектор силы контакта со стрелкой, если ролик под значимой нагрузкой
      if (hasStress && loadRatio > 0.12) {
        // Направление нормали к зубу (линия от центра ролика к мгновенному центру зацепления)
        const dirX = pitchX - r.x;
        const dirY = pitchY - r.y;
        const dirLen = Math.hypot(dirX, dirY) || 1;
        const uX = dirX / dirLen;
        const uY = dirY / dirLen;

        const arrowLen = (r.radius * 0.95) * loadRatio;
        const ax = r.x + uX * arrowLen;
        const ay = r.y + uY * arrowLen;

        ctx.strokeStyle = "#f59e0b";
        ctx.fillStyle = "#f59e0b";
        ctx.lineWidth = 1.6 / this.scale;

        // Линия вектора
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        // Стрелка на конце вектора
        const headLen = Math.min(2.2 / this.scale, arrowLen * 0.4);
        const arrowAngle = Math.atan2(uY, uX);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - headLen * Math.cos(arrowAngle - Math.PI / 6), ay - headLen * Math.sin(arrowAngle - Math.PI / 6));
        ctx.lineTo(ax - headLen * Math.cos(arrowAngle + Math.PI / 6), ay - headLen * Math.sin(arrowAngle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawDisc(ctx, solution, carrier, cx, cy, rotationRad, style, holeAngleOffset = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRad);

    // Внешний циклоидный профиль
    const pts = solution.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.lineWidth;
    ctx.stroke();

    // Центральное отверстие
    if (solution.camBore > 0) {
      ctx.strokeStyle = style.boreStroke;
      ctx.lineWidth = 1.4 / this.scale;
      ctx.beginPath();
      ctx.arc(0, 0, solution.camBore / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Отверстия в диске под выходные пальцы
    if (carrier) {
      const rollerRad = (carrier.rollerDiameter || carrier.pinDiameter) / 2;
      const holeRadius = rollerRad + solution.E;
      const ws = carrier.wallStatus;
      const isCollision = ws && (ws.tInner < 0 || ws.tOuter < 0 || ws.tInter < 0);
      const isThin = ws && Math.min(ws.tInner, ws.tOuter, ws.tInter) < 1.2;

      ctx.strokeStyle = isCollision ? "#ef4444" : (isThin ? "#f59e0b" : style.holeStroke);
      ctx.lineWidth = (isCollision ? 2.2 : 1.4) / this.scale;

      for (let i = 0; i < carrier.pinCount; i++) {
        const a = (2 * Math.PI * i) / carrier.pinCount + holeAngleOffset;
        const hx = carrier.radius * Math.cos(a);
        const hy = carrier.radius * Math.sin(a);
        ctx.beginPath();
        ctx.arc(hx, hy, holeRadius, 0, Math.PI * 2);
        if (isCollision) {
          ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
          ctx.fill();
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawCarrierPins(ctx, carrier, outputAngleRad) {
    ctx.save();
    ctx.rotate(outputAngleRad);

    const useBearing = carrier.useBearing;
    const pinRadius = carrier.pinDiameter / 2;
    const rollerRadius = (carrier.rollerDiameter || carrier.pinDiameter) / 2;

    for (let i = 0; i < carrier.pinCount; i++) {
      const a = (2 * Math.PI * i) / carrier.pinCount;
      const px = carrier.radius * Math.cos(a);
      const py = carrier.radius * Math.sin(a);

      if (useBearing) {
        // Внешнее кольцо подшипника (ролик качения)
        ctx.fillStyle = "rgba(245, 158, 11, 0.35)";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.4 / this.scale;
        ctx.beginPath();
        ctx.arc(px, py, rollerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Тела качения подшипника
        const balls = 6;
        const bPitch = (pinRadius + rollerRadius) / 2;
        const bRad = (rollerRadius - pinRadius) / 3.0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (let b = 0; b < balls; b++) {
          const ba = (2 * Math.PI * b) / balls;
          ctx.beginPath();
          ctx.arc(px + bPitch * Math.cos(ba), py + bPitch * Math.sin(ba), bRad, 0, Math.PI * 2);
          ctx.fill();
        }

        // Внутреннее отверстие / стальной палец-винт
        ctx.fillStyle = "#38ef7d";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.0 / this.scale;
        ctx.beginPath();
        ctx.arc(px, py, pinRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Обычный палец скольжения
        ctx.fillStyle = "rgba(245, 158, 11, 0.4)";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.6 / this.scale;
        ctx.beginPath();
        ctx.arc(px, py, pinRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Центр пальца
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px, py, 0.6 / this.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Линии водила (окружность расположения пальцев)
    ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
    ctx.lineWidth = 1.0 / this.scale;
    ctx.beginPath();
    ctx.arc(0, 0, carrier.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawEccentricMarker(ctx, cx, cy) {
    // Линия от центра статора (0,0) к центру диска (cx, cy)
    ctx.save();
    ctx.strokeStyle = "rgba(236, 72, 153, 0.8)";
    ctx.lineWidth = 1.5 / this.scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Точка центра эксцентрика
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.2 / this.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPitchCircles(ctx, solution, carrier) {
    ctx.save();
    ctx.lineWidth = 0.8 / this.scale;
    ctx.setLineDash([2 / this.scale, 2 / this.scale]);

    // Делительная окружность роликов статора
    ctx.strokeStyle = "rgba(56, 239, 125, 0.4)";
    ctx.beginPath();
    ctx.arc(0, 0, solution.R, 0, Math.PI * 2);
    ctx.stroke();

    // Окружность пальцев каретки
    if (carrier) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
      ctx.beginPath();
      ctx.arc(0, 0, carrier.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawCenterMarker(ctx) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 1.0 / this.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawEccentricAssembly(ctx, solution, eccentric, crankRad, dualDisc) {
    if (!eccentric) return;
    const { shaftD, hasDcut, dcutFlat, bearingId, bearingOd } = eccentric;
    const E = solution.E;

    ctx.save();

    // 1. Вторая шейка эксцентрика (для диска 2 при противофазе +180°)
    if (dualDisc) {
      const cx2 = E * Math.cos(crankRad + Math.PI);
      const cy2 = E * Math.sin(crankRad + Math.PI);

      // Внешняя шейка кулачка диска 2
      ctx.beginPath();
      ctx.arc(cx2, cy2, bearingId / 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 0, 127, 0.22)";
      ctx.fill();
      ctx.strokeStyle = "#ff007f";
      ctx.lineWidth = 1.4 / this.scale;
      ctx.stroke();

      // Габарит подшипника 2
      ctx.beginPath();
      ctx.arc(cx2, cy2, bearingOd / 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 119, 169, 0.35)";
      ctx.setLineDash([2 / this.scale, 2 / this.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Первая шейка эксцентрика (основной диск)
    const cx1 = E * Math.cos(crankRad);
    const cy1 = E * Math.sin(crankRad);

    // Внешняя шейка кулачка под подшипник 1
    ctx.beginPath();
    ctx.arc(cx1, cy1, bearingId / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(236, 72, 153, 0.4)";
    ctx.fill();
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 1.8 / this.scale;
    ctx.stroke();

    // Габарит внешнего кольца подшипника 1
    ctx.beginPath();
    ctx.arc(cx1, cy1, bearingOd / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(236, 72, 153, 0.5)";
    ctx.lineWidth = 1.2 / this.scale;
    ctx.stroke();

    // Шарики подшипника (декоративно для наглядности структуры)
    const ballCount = 8;
    const pitchR = (bearingId + bearingOd) / 4;
    const ballR = (bearingOd - bearingId) / 5.2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < ballCount; i++) {
      const ba = (2 * Math.PI * i) / ballCount;
      ctx.beginPath();
      ctx.arc(cx1 + pitchR * Math.cos(ba), cy1 + pitchR * Math.sin(ba), ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Отверстие под вал двигателя в центре кулачка (0,0)
    ctx.save();
    ctx.rotate(crankRad); // Вал двигателя вращается вместе с кулачком

    const rShaft = shaftD / 2;
    ctx.beginPath();
    if (hasDcut) {
      // Срез D-cut: хорда
      const cutDepth = dcutFlat !== undefined ? dcutFlat : 0.5; // глубина среза
      const flatDist = rShaft - cutDepth;
      if (flatDist > 0 && flatDist < rShaft) {
        const angle = Math.acos(flatDist / rShaft);
        ctx.arc(0, 0, rShaft, angle, Math.PI * 2 - angle);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, rShaft, 0, Math.PI * 2);
      }
    } else {
      ctx.arc(0, 0, rShaft, 0, Math.PI * 2);
    }

    ctx.fillStyle = "#0a0f1d"; // Полость вала
    ctx.fill();
    ctx.strokeStyle = "#38ef7d"; // Неоновый зеленый контур вала
    ctx.lineWidth = 1.8 / this.scale;
    ctx.stroke();

    // Центровочный крест вала двигателя
    ctx.strokeStyle = "rgba(56, 239, 125, 0.4)";
    ctx.lineWidth = 0.8 / this.scale;
    ctx.beginPath();
    ctx.moveTo(-rShaft * 0.7, 0); ctx.lineTo(rShaft * 0.7, 0);
    ctx.moveTo(0, -rShaft * 0.7); ctx.lineTo(0, rShaft * 0.7);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  /**
   * Отрисовка тепловой карты кривизны (Heatmap) и инструмента (сопла 3D-принтера / фрезы ЧПУ)
   */
  drawCurvatureOverlay(ctx, solution, cx, cy, rotationRad, curvature) {
    if (!curvature || !curvature.pointData || curvature.pointData.length === 0) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRad);

    const pts = curvature.pointData;
    const N = pts.length;
    const toolR = curvature.toolRadius;

    // 1. Отрисовка цветных участков тепловой карты вдоль профиля диска
    for (let i = 0; i < N; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % N];

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      if (!p1.isConcave) {
        // Выпуклый участок (вершина) — спокойный бирюзовый
        ctx.strokeStyle = "rgba(0, 242, 254, 0.35)";
        ctx.lineWidth = 1.6 / this.scale;
      } else {
        // Вогнутый участок (впадина) — цветовой градиент по опасности
        if (p1.danger >= 1.0) {
          ctx.strokeStyle = "#ef4444"; // Критично: инструмент шире впадины!
          ctx.lineWidth = 3.6 / this.scale;
        } else if (p1.danger >= 0.5) {
          ctx.strokeStyle = "#f59e0b"; // Предупреждение: на пределе
          ctx.lineWidth = 2.8 / this.scale;
        } else if (p1.danger >= 0.25) {
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 2.4 / this.scale;
        } else {
          ctx.strokeStyle = "#22c55e"; // Безопасно: инструмент свободно помещается
          ctx.lineWidth = 2.0 / this.scale;
        }
      }
      ctx.stroke();
    }

    // 2. Подсветка критических точек соприкосновения
    if (curvature.criticalPoints && curvature.criticalPoints.length > 0) {
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.0 / this.scale;
      for (const cp of curvature.criticalPoints) {
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 1.2 / this.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 3. Визуализация инструмента в самой острой впадине (Sharpest Trough)
    if (curvature.sharpestTrough) {
      const st = curvature.sharpestTrough;
      const isCollision = st.danger >= 1.0;

      // Окружность инструмента, касающаяся дна впадины
      ctx.beginPath();
      ctx.arc(st.toolCx, st.toolCy, toolR, 0, Math.PI * 2);
      ctx.fillStyle = isCollision ? "rgba(239, 68, 68, 0.35)" : "rgba(34, 197, 94, 0.35)";
      ctx.fill();
      ctx.strokeStyle = isCollision ? "#ef4444" : "#22c55e";
      ctx.lineWidth = 1.8 / this.scale;
      ctx.stroke();

      // Центр инструмента
      ctx.fillStyle = isCollision ? "#ef4444" : "#22c55e";
      ctx.beginPath();
      ctx.arc(st.toolCx, st.toolCy, 0.6 / this.scale, 0, Math.PI * 2);
      ctx.fill();

      // Соприкасающаяся окружность кривизны профиля (Dashed)
      if (st.rho < 25) {
        ctx.beginPath();
        ctx.arc(st.cx, st.cy, st.rho, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(96, 165, 250, 0.5)";
        ctx.setLineDash([2 / this.scale, 2 / this.scale]);
        ctx.lineWidth = 1.0 / this.scale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Текстовая аннотация с переворотом Y для читаемости шрифта
      ctx.save();
      ctx.translate(st.toolCx, st.toolCy);
      ctx.scale(1 / this.scale, -1 / this.scale); // Переход в экранные пиксели

      const textDist = 20;
      const angle = Math.atan2(st.toolCy, st.toolCx);
      const tx = Math.cos(angle) * textDist;
      const ty = -Math.sin(angle) * textDist;

      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = tx >= 0 ? "left" : "right";
      ctx.textBaseline = "middle";

      const line1 = `ρ_min = ${st.rho.toFixed(2)} мм`;
      const line2 = `Инструмент Ø${curvature.toolDiameter.toFixed(2)} мм (${isCollision ? "КОЛЛИЗИЯ!" : "OK"})`;

      // Фоновая плашка
      const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 12;
      const bx = tx >= 0 ? tx - 4 : tx - w + 4;
      ctx.fillStyle = "rgba(10, 15, 29, 0.9)";
      ctx.fillRect(bx, ty - 14, w, 28);
      ctx.strokeStyle = isCollision ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, ty - 14, w, 28);

      ctx.fillStyle = isCollision ? "#ef4444" : "#22c55e";
      ctx.fillText(line1, tx, ty - 4);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillText(line2, tx, ty + 8);

      ctx.restore();
    }

    ctx.restore();
  }
}
