/**
 * Экспортер геометрии в формат AutoCAD DXF (R12 / 2000 ASCII)
 * Поддерживает слои, замкнутые полилинии (POLYLINE) и окружности (CIRCLE).
 */

export class DxfExporter {
  /**
   * Сгенерировать DXF файл (AutoCAD R12 / 2000 ASCII)
   * Поддерживает три режима:
   * 1. 'assembly' (по умолчанию): Сборка CAD в зацеплении (статор в 0,0, Диск 1 на +E, Диск 2 на -E)
   * 2. 'disc_only': Только контур диска 1, центрированный в (0,0) для 3D-печати / ЧПУ
   * 3. 'sheet_layout': Раскладка всех деталей на плоскости без наложений
   * @param {Object} options
   */
  static generate(options) {
    const {
      discPoints,
      camBoreRadius = 10.5,
      carrierHoles = [],
      statorRollers = [],
      eccentric = null,
      E = 1.5,
      Z1 = 10,
      dualDisc = true,
      exportMode = "assembly", // 'assembly' | 'disc_only' | 'sheet_layout'
      includeDisc1 = true,
      includeDisc2 = true,
      includeBore = true,
      includeCarrierHoles = true,
      includeCarrierPins = true,
      carrierPinRadius = 2.5,
      carrierR = 17.0,
      carrierN = 6,
      includeStator = true,
      includeEccentric = true,
      R = 30.0,
      curveType = "biarc", // 'biarc' | 'spline' | 'polyline'
      biarcTolerance = 0.005 // допустимая погрешность аппроксимации дугами в мм
    } = options;

    let dxf = "";

    // 1. Секция HEADER
    // Для сплайнов (SPLINE) и легковесных полилиний (LWPOLYLINE с Bulge) используем AC1015 (AutoCAD 2000),
    // для чистой дискретной полилинии - AC1009 (AutoCAD R12).
    const acadVer = curveType === "polyline" ? "AC1009" : "AC1015";
    dxf += "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\n" + acadVer + "\n0\nENDSEC\n";

    // 2. Секция TABLES (Слои с наглядными цветами AutoCAD)
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n10\n";

    const layers = [
      { name: "0", color: 7 },                      // Белый
      { name: "STATOR_ROLLERS", color: 3 },         // Зеленый (ролики корпуса)
      { name: "STATOR_CENTER", color: 8 },          // Серый (осевые)
      { name: "CAM_DISC_1", color: 4 },             // Голубой (основной рабочий диск, сдвиг +E)
      { name: "CAM_DISC_2", color: 1 },             // Красный (второй диск в противофазе, сдвиг -E)
      { name: "BORE_HOLE", color: 6 },              // Пурпурный (отверстие подшипника)
      { name: "CARRIER_HOLES", color: 2 },          // Желтый (отверстия под пальцы в диске)
      { name: "CARRIER_PINS", color: 5 },           // Синий (пальцы выходного вала)
      { name: "MOTOR_SHAFT", color: 7 },            // Белый (отверстие вала двигателя)
      { name: "ECCENTRIC_CAM", color: 6 }           // Пурпурный (кулачки эксцентрика)
    ];

    for (const l of layers) {
      dxf += "0\nLAYER\n";
      dxf += `2\n${l.name}\n`;
      dxf += "70\n0\n";
      dxf += `62\n${l.color}\n`;
      dxf += "6\nCONTINUOUS\n";
    }

    dxf += "0\nENDTAB\n0\nENDSEC\n";

    // 3. Секция ENTITIES
    dxf += "0\nSECTION\n2\nENTITIES\n";

    if (exportMode === "disc_only") {
      // =========================================================================
      // РЕЖИМ 1: ТОЛЬКО ДИСК (ДЛЯ 3D-ПЕЧАТИ И ЧПУ)
      // Диск строго центрирован в (0,0) относительно своей оси вращения
      // =========================================================================
      if (discPoints && discPoints.length > 0) {
        dxf += this.formatDiscCurve(discPoints, "CAM_DISC_1", curveType, biarcTolerance);
      }
      if (includeBore && camBoreRadius > 0) {
        dxf += this.circleToDxf(0.0, 0.0, camBoreRadius, "BORE_HOLE");
      }
      if (includeCarrierHoles && carrierHoles.length > 0) {
        for (const h of carrierHoles) {
          dxf += this.circleToDxf(h.x, h.y, h.radius, "CARRIER_HOLES");
        }
      }
    } else if (exportMode === "sheet_layout") {
      // =========================================================================
      // РЕЖИМ 2: РАСКЛАДКА ВСЕХ ДЕТАЛЕЙ НА ПЛОСКОСТИ (ДЛЯ ЛАЗЕРНОЙ РЕЗКИ / ПЕЧАТИ)
      // Детали разнесены по чертежу без наложений друг на друга
      // =========================================================================
      const spacing = Math.max(R * 2.6, 75);

      // Деталь 1: Диск 1 в (0, 0)
      if (discPoints && discPoints.length > 0) {
        dxf += this.formatDiscCurve(discPoints, "CAM_DISC_1", curveType, biarcTolerance);
      }
      if (includeBore && camBoreRadius > 0) {
        dxf += this.circleToDxf(0.0, 0.0, camBoreRadius, "BORE_HOLE");
      }
      if (includeCarrierHoles && carrierHoles.length > 0) {
        for (const h of carrierHoles) {
          dxf += this.circleToDxf(h.x, h.y, h.radius, "CARRIER_HOLES");
        }
      }

      // Деталь 2: Диск 2 (если двухдисковый) в (+spacing, 0)
      // Зубья Диска 2 повернуты на 180° / Z1 относительно отверстий пальцев,
      // поэтому обе детали можно собирать лицевой стороной вперед без переворотов
      if (dualDisc && discPoints && discPoints.length > 0) {
        const phi = Math.PI / Z1;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const d2Pts = discPoints.map(p => ({
          x: (p.x * cosP - p.y * sinP) + spacing,
          y: p.x * sinP + p.y * cosP
        }));
        dxf += this.formatDiscCurve(d2Pts, "CAM_DISC_2", curveType, biarcTolerance);
        if (includeBore && camBoreRadius > 0) {
          dxf += this.circleToDxf(spacing, 0.0, camBoreRadius, "BORE_HOLE");
        }
        if (includeCarrierHoles && carrierHoles.length > 0) {
          for (const h of carrierHoles) {
            dxf += this.circleToDxf(h.x + spacing, h.y, h.radius, "CARRIER_HOLES");
          }
        }
      }

      // Деталь 3: Ролики статора в (-spacing, 0)
      if (includeStator && statorRollers.length > 0) {
        for (const r of statorRollers) {
          dxf += this.circleToDxf(r.x - spacing, r.y, r.radius, "STATOR_ROLLERS");
        }
        dxf += this.circleToDxf(-spacing, 0, 1.5, "STATOR_CENTER");
      }

      // Деталь 4: Эксцентрик на вал в (0, +spacing)
      if (includeEccentric && eccentric) {
        dxf += this.formatEccentricCam(eccentric, E, dualDisc, 0.0, spacing);
      }

      // Деталь 5: Пальцы водила в (0, -spacing)
      if (includeCarrierPins && carrierN > 0) {
        for (let i = 0; i < carrierN; i++) {
          const a = (2 * Math.PI * i) / carrierN;
          dxf += this.circleToDxf(
            carrierR * Math.cos(a),
            carrierR * Math.sin(a) - spacing,
            carrierPinRadius,
            "CARRIER_PINS"
          );
        }
        dxf += this.circleToDxf(0.0, -spacing, 1.5, "STATOR_CENTER");
      }
    } else {
      // =========================================================================
      // РЕЖИМ 3: СБОРКА CAD В ЗАЦЕПЛЕНИИ (ASSEMBLY, ПО УМОЛЧАНИЮ)
      // Статор центрирован в (0,0), Диск 1 смещен на (+E, 0), Диск 2 на (-E, 0).
      // Зазор на роликах равен ровно 0.000 мм (идеальное математическое касание)!
      // =========================================================================

      // А) Ролики статора (неподвижный корпус, центр 0,0)
      if (includeStator && statorRollers.length > 0) {
        for (const r of statorRollers) {
          dxf += this.circleToDxf(r.x, r.y, r.radius, "STATOR_ROLLERS");
        }
        dxf += this.circleToDxf(0.0, 0.0, 1.5, "STATOR_CENTER");
      }

      // Б) Циклоидный диск 1: смещен строго на (+E, 0) вдоль оси X
      if (includeDisc1 && discPoints && discPoints.length > 0) {
        const shiftedDisc1 = discPoints.map(p => ({ x: p.x + E, y: p.y }));
        dxf += this.formatDiscCurve(shiftedDisc1, "CAM_DISC_1", curveType, biarcTolerance);

        // Отверстие подшипника диска 1 в (+E, 0)
        if (includeBore && camBoreRadius > 0) {
          dxf += this.circleToDxf(E, 0.0, camBoreRadius, "CAM_DISC_1");
        }

        // Отверстия под пальцы в диске 1 (смещены на +E)
        if (includeCarrierHoles && carrierHoles.length > 0) {
          for (const h of carrierHoles) {
            dxf += this.circleToDxf(h.x + E, h.y, h.radius, "CARRIER_HOLES");
          }
        }
      }

      // В) Циклоидный диск 2 (если двухдисковый редуктор):
      // Смещен на (-E, 0) и повернут на угол 180° / Z1 (фаза противофазы)
      if (dualDisc && includeDisc2 && discPoints && discPoints.length > 0) {
        const phi = Math.PI / Z1; // 180° / Z1
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        const shiftedDisc2 = discPoints.map(p => ({
          x: (p.x * cosP - p.y * sinP) - E,
          y: p.x * sinP + p.y * cosP
        }));
        dxf += this.formatDiscCurve(shiftedDisc2, "CAM_DISC_2", curveType, biarcTolerance);

        // Отверстие подшипника диска 2 в (-E, 0)
        if (includeBore && camBoreRadius > 0) {
          dxf += this.circleToDxf(-E, 0.0, camBoreRadius, "CAM_DISC_2");
        }

        // Отверстия под пальцы в диске 2:
        // ВАЖНО: Пальцы водила в сборке центрированы в (0,0) при углах a_i.
        // Чтобы единые прямые пальцы водила проходили насквозь через оба диска (Диск 1 смещен на +E, Диск 2 на -E),
        // отверстия Диска 2 должны быть смещены на -E, но НЕ повернуты на угол phi!
        if (includeCarrierHoles && carrierHoles.length > 0) {
          for (const h of carrierHoles) {
            dxf += this.circleToDxf(
              h.x - E,
              h.y,
              h.radius,
              "CARRIER_HOLES"
            );
          }
        }
      }

      // Г) Пальцы выходного вала (водило) — центр в (0,0)
      // Пальцы свободно проходят сквозь отверстия обоих дисков со свободным зазором 2*E
      if (includeCarrierPins && carrierN > 0) {
        for (let i = 0; i < carrierN; i++) {
          const a = (2 * Math.PI * i) / carrierN;
          dxf += this.circleToDxf(
            carrierR * Math.cos(a),
            carrierR * Math.sin(a),
            carrierPinRadius,
            "CARRIER_PINS"
          );
        }
      }

      // Д) Эксцентрик на вал двигателя: ось в (0,0), шейка 1 на (+E, 0), шейка 2 на (-E, 0)
      if (includeEccentric && eccentric) {
        dxf += this.formatEccentricCam(eccentric, E, dualDisc, 0.0, 0.0);
      }
    }

    dxf += "0\nENDSEC\n0\nEOF\n";
    return dxf;
  }

  static profileCurveToDxf(points, layerName, curveType = "biarc", biarcTolerance = 0.005) {
    return this.formatDiscCurve(points, layerName, curveType, biarcTolerance);
  }

  /**
   * Сформировать DXF геометрию контура диска (Bi-Arc дуги, сплайн или классическая полилиния)
   */
  static formatDiscCurve(points, layerName, curveType = "biarc", biarcTolerance = 0.005) {
    if (!points || points.length === 0) return "";

    if (curveType === "biarc") {
      const { arcs } = this.fitBiArcs(points, biarcTolerance);
      return this.biArcsToDxf(arcs, layerName);
    } else if (curveType === "spline") {
      return this.splineToDxf(points, layerName);
    } else {
      return this.polylineToDxf(points, layerName);
    }
  }

  /**
   * Аппроксимация плотной цепочки точек последовательностью сопряженных дуг окружностей (Bi-Arc)
   * с заданной максимальной погрешностью tolerance (по умолчанию 0.005 мм = 5 микрон).
   * @param {Array<{x: number, y: number}>} points Исходные точки контура
   * @param {number} tolerance Допустимое радиальное отклонение в мм
   * @returns {{ arcs: Array<{x: number, y: number, bulge: number}>, globalMaxErr: number }}
   */
  static fitBiArcs(points, tolerance = 0.005) {
    if (!points || points.length < 3) {
      return { arcs: points.map(p => ({ x: p.x, y: p.y, bulge: 0 })), globalMaxErr: 0 };
    }

    // Определяем длину уникальных точек (если последняя совпадает с первой)
    const isClosed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6;
    const N = isClosed ? points.length - 1 : points.length;

    const arcs = [];
    let i = 0;
    let globalMaxErr = 0;

    const getCircle = (p1, p2, p3) => {
      const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y;
      const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
      if (Math.abs(D) < 1e-12) return null;
      const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
      const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
      const R = Math.hypot(x1 - ux, y1 - uy);
      return { ux, uy, R };
    };

    const getBulge = (p1, p2, p3, c) => {
      let a1 = Math.atan2(p1.y - c.uy, p1.x - c.ux);
      let a2 = Math.atan2(p2.y - c.uy, p2.x - c.ux);
      let a3 = Math.atan2(p3.y - c.uy, p3.x - c.ux);
      let d2 = a2 - a1;
      while (d2 < 0) d2 += 2 * Math.PI;
      while (d2 >= 2 * Math.PI) d2 -= 2 * Math.PI;
      let d3 = a3 - a1;
      while (d3 < 0) d3 += 2 * Math.PI;
      while (d3 >= 2 * Math.PI) d3 -= 2 * Math.PI;
      const isCCW = (d2 < d3);
      const sweep = isCCW ? d3 : (2 * Math.PI - d3);
      if (sweep > Math.PI * 0.95) return 0;
      const bulge = Math.tan(sweep / 4);
      return isCCW ? bulge : -bulge;
    };

    while (i < N) {
      let bestK = i + 1;
      let bestBulge = 0;
      let bestMaxErr = 0;

      // Жадный поиск наибольшего отрезка [i, k], укладывающегося в допуск
      const maxLookahead = Math.min(i + 150, N);
      for (let k = i + 2; k <= maxLookahead; k++) {
        const mid = Math.floor((i + k) / 2);
        const c = getCircle(points[i], points[mid], points[k]);
        if (!c) break;

        let maxErr = 0;
        for (let j = i + 1; j < k; j++) {
          const d = Math.abs(Math.hypot(points[j].x - c.ux, points[j].y - c.uy) - c.R);
          if (d > maxErr) maxErr = d;
          if (maxErr > tolerance) break;
        }

        if (maxErr <= tolerance) {
          bestK = k;
          bestBulge = getBulge(points[i], points[mid], points[k], c);
          bestMaxErr = maxErr;
        } else {
          break;
        }
      }

      if (bestMaxErr > globalMaxErr) globalMaxErr = bestMaxErr;
      arcs.push({
        x: points[i].x,
        y: points[i].y,
        bulge: bestBulge
      });
      i = bestK;
    }

    return { arcs, globalMaxErr };
  }

  /**
   * Сформировать DXF сущность легковесной полилинии с дугами (LWPOLYLINE с Bulge)
   */
  static biArcsToDxf(arcs, layerName) {
    if (!arcs || arcs.length === 0) return "";
    let s = "0\nLWPOLYLINE\n";
    s += `8\n${layerName}\n`;
    s += `90\n${arcs.length}\n`;
    s += "70\n1\n"; // 70=1 замкнутая полилиния
    s += "43\n0.0\n";
    for (let i = 0; i < arcs.length; i++) {
      s += `10\n${arcs[i].x.toFixed(4)}\n`;
      s += `20\n${arcs[i].y.toFixed(4)}\n`;
      if (Math.abs(arcs[i].bulge) > 1e-6) {
        s += `42\n${arcs[i].bulge.toFixed(6)}\n`;
      }
    }
    return s;
  }

  /**
   * Сформировать DXF сущность сплайна (SPLINE) через опорные точки (Fit Points)
   */
  static splineToDxf(points, layerName, sampleStep = 10) {
    if (!points || points.length === 0) return "";

    const fitPoints = [];
    const isClosed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6;
    const N = isClosed ? points.length - 1 : points.length;
    for (let i = 0; i < N; i += sampleStep) {
      fitPoints.push(points[i]);
    }
    fitPoints.push(points[0]);

    let s = "0\nSPLINE\n";
    s += `8\n${layerName}\n`;
    s += "210\n0.0\n220\n0.0\n230\n1.0\n";
    s += "70\n1033\n"; // closed + planar + fit points
    s += "71\n3\n";    // Степень 3
    s += "72\n0\n";    // Knots
    s += "73\n0\n";    // Control points
    s += `74\n${fitPoints.length}\n`; // Число опорных точек
    s += "44\n0.0000000001\n";

    for (let i = 0; i < fitPoints.length; i++) {
      s += `11\n${fitPoints[i].x.toFixed(4)}\n`;
      s += `21\n${fitPoints[i].y.toFixed(4)}\n`;
      s += "31\n0.0\n";
    }
    return s;
  }

  /**
   * Сформировать DXF сущность полилинии
   */
  static polylineToDxf(points, layerName) {
    let s = "0\nPOLYLINE\n";
    s += `8\n${layerName}\n`;
    s += "66\n1\n70\n1\n"; // 70=1 замкнутая полилиния
    s += "10\n0.0\n20\n0.0\n30\n0.0\n";
    for (let i = 0; i < points.length; i++) {
      s += "0\nVERTEX\n";
      s += `8\n${layerName}\n`;
      s += `10\n${points[i].x.toFixed(4)}\n`;
      s += `20\n${points[i].y.toFixed(4)}\n`;
      s += "30\n0.0\n";
    }
    s += "0\nSEQEND\n";
    return s;
  }

  /**
   * Сформировать DXF сущность окружности
   */
  static circleToDxf(cx, cy, radius, layerName) {
    let s = "0\nCIRCLE\n";
    s += `8\n${layerName}\n`;
    s += `10\n${cx.toFixed(4)}\n`;
    s += `20\n${cy.toFixed(4)}\n`;
    s += "30\n0.0\n";
    s += `40\n${radius.toFixed(4)}\n`;
    return s;
  }

  /**
   * Экспорт детали-эксцентрика (отверстие вала + шейки кулачков)
   */
  static formatEccentricCam(eccentric, E, dualDisc, offsetX = 0, offsetY = 0) {
    let s = "";
    const rShaft = eccentric.shaftD / 2;
    const rBearingId = eccentric.bearingId / 2;

    // Отверстие под вал двигателя в (offsetX, offsetY)
    if (eccentric.hasDcut) {
      const cutDepth = eccentric.dcutFlat !== undefined ? eccentric.dcutFlat : 0.5;
      const flatDist = rShaft - cutDepth;
      if (flatDist > 0 && flatDist < rShaft) {
        const angle = Math.acos(flatDist / rShaft);
        s += "0\nPOLYLINE\n8\nMOTOR_SHAFT\n66\n1\n70\n1\n10\n0.0\n20\n0.0\n30\n0.0\n";
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const a = angle + ((2 * Math.PI - 2 * angle) * i) / steps;
          s += `0\nVERTEX\n8\nMOTOR_SHAFT\n10\n${(offsetX + rShaft * Math.cos(a)).toFixed(4)}\n20\n${(offsetY + rShaft * Math.sin(a)).toFixed(4)}\n30\n0.0\n`;
        }
        s += "0\nSEQEND\n";
      } else {
        s += this.circleToDxf(offsetX, offsetY, rShaft, "MOTOR_SHAFT");
      }
    } else {
      s += this.circleToDxf(offsetX, offsetY, rShaft, "MOTOR_SHAFT");
    }

    // Шейка 1: центр (+E, 0)
    s += this.circleToDxf(offsetX + E, offsetY, rBearingId, "ECCENTRIC_CAM");

    // Шейка 2: центр (-E, 0)
    if (dualDisc) {
      s += this.circleToDxf(offsetX - E, offsetY, rBearingId, "ECCENTRIC_CAM");
    }

    return s;
  }

  /**
   * Сгенерировать отдельный чистый чертёж детали "Эксцентрик" (кулачок на вал)
   */
  static generateEccentricOnly(eccentric, E, dualDisc = true) {
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n3\n";

    const layers = [
      { name: "0", color: 7 },
      { name: "MOTOR_SHAFT_BORE", color: 3 },
      { name: "ECCENTRIC_LOBE_1", color: 4 },
      { name: "ECCENTRIC_LOBE_2", color: 6 }
    ];

    for (const l of layers) {
      dxf += `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`;
    }
    dxf += "0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

    const rShaft = eccentric.shaftD / 2;
    const rBearingId = eccentric.bearingId / 2;

    // Отверстие под вал
    if (eccentric.hasDcut) {
      const cutDepth = eccentric.dcutFlat !== undefined ? eccentric.dcutFlat : 0.5;
      const flatDist = rShaft - cutDepth;
      if (flatDist > 0 && flatDist < rShaft) {
        const angle = Math.acos(flatDist / rShaft);
        dxf += "0\nPOLYLINE\n8\nMOTOR_SHAFT_BORE\n66\n1\n70\n1\n10\n0.0\n20\n0.0\n30\n0.0\n";
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const a = angle + ((2 * Math.PI - 2 * angle) * i) / steps;
          dxf += `0\nVERTEX\n8\nMOTOR_SHAFT_BORE\n10\n${(rShaft * Math.cos(a)).toFixed(4)}\n20\n${(rShaft * Math.sin(a)).toFixed(4)}\n30\n0.0\n`;
        }
        dxf += "0\nSEQEND\n";
      } else {
        dxf += this.circleToDxf(0, 0, rShaft, "MOTOR_SHAFT_BORE");
      }
    } else {
      dxf += this.circleToDxf(0, 0, rShaft, "MOTOR_SHAFT_BORE");
    }

    // Шейка 1: (+E, 0)
    dxf += this.circleToDxf(E, 0, rBearingId, "ECCENTRIC_LOBE_1");

    // Шейка 2: (-E, 0)
    if (dualDisc) {
      dxf += this.circleToDxf(-E, 0, rBearingId, "ECCENTRIC_LOBE_2");
    }

    dxf += "0\nENDSEC\n0\nEOF\n";
    return dxf;
  }

  /**
   * Экспорт геометрии двухвенцового редуктора (Compound Cycloid) в DXF
   * @param {Object} options
   */
  static generateCompound(options) {
    const {
      compoundSolution,
      exportMode = "assembly", // 'assembly' | 'disc1_only' | 'disc2_only' | 'compound_both' | 'sheet_layout'
      curveType = "biarc",
      biarcTolerance = 0.005,
      includeStator1 = true,
      includeOutputRing = true,
      includeDisc1 = true,
      includeDisc2 = true,
      includeDowels = true,
      includeBore = true
    } = options;

    const sol = compoundSolution;
    const acadVer = curveType === "polyline" ? "AC1009" : "AC1015";
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\n" + acadVer + "\n0\nENDSEC\n";

    // Таблица слоев
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n7\n";
    const layers = [
      { name: "0", color: 7 },
      { name: "STATOR1_ROLLERS", color: 3 }, // Зеленый
      { name: "OUTPUT_ROLLERS", color: 2 },  // Желтый / янтарный
      { name: "COMPOUND_DISC_1", color: 4 }, // Циан
      { name: "COMPOUND_DISC_2", color: 6 }, // Пурпурный
      { name: "DOWEL_HOLES", color: 7 },     // Белый
      { name: "BORE_HOLE", color: 1 }        // Красный
    ];
    for (const l of layers) {
      dxf += `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`;
    }
    dxf += "0\nENDTAB\n0\nENDSEC\n";

    // Секция сущностей
    dxf += "0\nSECTION\n2\nENTITIES\n";

    const boreRadius = sol.camBore / 2;
    const E = sol.E;

    if (exportMode === "disc1_only") {
      // Только Венец 1 в (0,0)
      dxf += this.profileCurveToDxf(sol.stage1.points, "COMPOUND_DISC_1", curveType, biarcTolerance);
      if (includeBore) {
        dxf += this.circleToDxf(0, 0, boreRadius, "BORE_HOLE");
      }
      if (includeDowels && sol.useDowelPins && sol.dowelPins) {
        for (const p of sol.dowelPins) {
          dxf += this.circleToDxf(p.x, p.y, p.radius, "DOWEL_HOLES");
        }
      }
    } else if (exportMode === "disc2_only") {
      // Только Венец 2 в (0,0)
      dxf += this.profileCurveToDxf(sol.stage2.points, "COMPOUND_DISC_2", curveType, biarcTolerance);
      if (includeBore) {
        dxf += this.circleToDxf(0, 0, boreRadius, "BORE_HOLE");
      }
      if (includeDowels && sol.useDowelPins && sol.dowelPins) {
        for (const p of sol.dowelPins) {
          dxf += this.circleToDxf(p.x, p.y, p.radius, "DOWEL_HOLES");
        }
      }
    } else if (exportMode === "sheet_layout") {
      // Раскладка 4 деталей на плоскости:
      const R1 = sol.R1;
      const R2 = sol.R2;
      const spacingX = (R1 + R2) * 1.35;
      const spacingY = (R1 + R2) * 1.35;

      // 1. Венец 1 в (0, 0)
      dxf += this.profileCurveToDxf(sol.stage1.points, "COMPOUND_DISC_1", curveType, biarcTolerance);
      dxf += this.circleToDxf(0, 0, boreRadius, "BORE_HOLE");
      if (sol.useDowelPins && sol.dowelPins) {
        for (const p of sol.dowelPins) {
          dxf += this.circleToDxf(p.x, p.y, p.radius, "DOWEL_HOLES");
        }
      }

      // 2. Венец 2 в (spacingX, 0)
      const d2Pts = sol.stage2.points.map(pt => ({ x: pt.x + spacingX, y: pt.y }));
      dxf += this.profileCurveToDxf(d2Pts, "COMPOUND_DISC_2", curveType, biarcTolerance);
      dxf += this.circleToDxf(spacingX, 0, boreRadius, "BORE_HOLE");
      if (sol.useDowelPins && sol.dowelPins) {
        for (const p of sol.dowelPins) {
          dxf += this.circleToDxf(p.x + spacingX, p.y, p.radius, "DOWEL_HOLES");
        }
      }

      // 3. Статор 1 ролики в (0, spacingY)
      for (const r of sol.stator1Rollers) {
        dxf += this.circleToDxf(r.x, r.y + spacingY, r.radius, "STATOR1_ROLLERS");
      }

      // 4. Ролики кольца выхода в (spacingX, spacingY)
      for (const r of sol.outputRingRollers) {
        dxf += this.circleToDxf(r.x + spacingX, r.y + spacingY, r.radius, "OUTPUT_ROLLERS");
      }
    } else {
      // 'assembly' (по умолчанию)
      if (includeStator1 && sol.stator1Rollers) {
        for (const r of sol.stator1Rollers) {
          dxf += this.circleToDxf(r.x, r.y, r.radius, "STATOR1_ROLLERS");
        }
      }
      if (includeOutputRing && sol.outputRingRollers) {
        for (const r of sol.outputRingRollers) {
          dxf += this.circleToDxf(r.x, r.y, r.radius, "OUTPUT_ROLLERS");
        }
      }

      // Венец 1 на (+E, 0)
      if (includeDisc1 && sol.stage1) {
        const d1Pts = sol.stage1.points.map(pt => ({ x: pt.x + E, y: pt.y }));
        dxf += this.profileCurveToDxf(d1Pts, "COMPOUND_DISC_1", curveType, biarcTolerance);
      }

      // Венец 2 на (+E, 0)
      if (includeDisc2 && sol.stage2) {
        const d2Pts = sol.stage2.points.map(pt => ({ x: pt.x + E, y: pt.y }));
        dxf += this.profileCurveToDxf(d2Pts, "COMPOUND_DISC_2", curveType, biarcTolerance);
      }

      // Центральное отверстие на (+E, 0)
      if (includeBore) {
        dxf += this.circleToDxf(E, 0, boreRadius, "BORE_HOLE");
      }

      // Штифты сопряжения на (+E, 0)
      if (includeDowels && sol.useDowelPins && sol.dowelPins) {
        for (const p of sol.dowelPins) {
          dxf += this.circleToDxf(p.x + E, p.y, p.radius, "DOWEL_HOLES");
        }
      }
    }

    dxf += "0\nENDSEC\n0\nEOF\n";
    return dxf;
  }

  /**
   * Скачать сгенерированный DXF как файл
   */
  static download(dxfContent, filename = "cycloid_gear.dxf") {
    const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
