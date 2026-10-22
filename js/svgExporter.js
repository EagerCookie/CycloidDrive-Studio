/**
 * Экспортер векторной графики в SVG формат
 */

export class SvgExporter {
  static generate(options) {
    const {
      discPoints,
      camBoreRadius,
      carrierHoles = [],
      statorRollers = [],
      E = 1.5,
      Z1 = 10,
      dualDisc = true,
      exportMode = "assembly", // 'assembly' | 'disc_only'
      includeStator = true,
      includeCarrier = true,
      includeCarrierPins = true,
      carrierPinRadius = 2.5,
      carrierR = 17.0,
      carrierN = 6
    } = options;

    const isAssembly = exportMode === "assembly";
    const shiftX1 = isAssembly ? E : 0;

    // Сдвинутые точки для Диска 1
    const d1Points = (discPoints || []).map(p => ({ x: p.x + shiftX1, y: p.y }));

    // Точки для Диска 2 (если двухдисковый в сборке)
    let d2Points = [];
    let d2Holes = [];
    if (isAssembly && dualDisc && discPoints && discPoints.length > 0) {
      const phi = Math.PI / Z1;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      d2Points = discPoints.map(p => ({
        x: (p.x * cosP - p.y * sinP) - E,
        y: p.x * sinP + p.y * cosP
      }));
      // Отверстия под пальцы в Диске 2 смещены на -E, но не повернуты на phi,
      // так как пальцы выходного вала являются едиными прямыми стержнями
      d2Holes = carrierHoles.map(h => ({
        x: h.x - E,
        y: h.y,
        radius: h.radius
      }));
    }

    // Определяем габаритные размеры (bounding box)
    let minX = -45, maxX = 45, minY = -45, maxY = 45;
    const allPoints = [...d1Points, ...d2Points];

    if (includeStator && statorRollers) {
      for (const r of statorRollers) {
        allPoints.push({ x: r.x - r.radius, y: r.y - r.radius });
        allPoints.push({ x: r.x + r.radius, y: r.y + r.radius });
      }
    }

    for (const p of allPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = 6;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const width = maxX - minX;
    const height = maxY - minY;

    // Helper для построения SVG path
    const makePathD = (pts) => {
      if (!pts || pts.length === 0) return "";
      let d = `M ${pts[0].x.toFixed(3)} ${(-pts[0].y).toFixed(3)} `;
      for (let i = 1; i < pts.length; i++) {
        d += `L ${pts[i].x.toFixed(3)} ${(-pts[i].y).toFixed(3)} `;
      }
      return d + "Z";
    };

    const pathD1 = makePathD(d1Points);
    const pathD2 = makePathD(d2Points);

    let carrierPinsSvg = "";
    if (isAssembly && includeCarrierPins && carrierN > 0) {
      for (let i = 0; i < carrierN; i++) {
        const a = (2 * Math.PI * i) / carrierN;
        const px = carrierR * Math.cos(a);
        const py = -carrierR * Math.sin(a);
        carrierPinsSvg += `<circle cx="${px.toFixed(3)}" cy="${py.toFixed(3)}" r="${carrierPinRadius.toFixed(3)}" class="carrier-pin" />\n    `;
      }
    }

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="${minX.toFixed(2)} ${(-maxY).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}"
     width="${width.toFixed(2)}mm" height="${height.toFixed(2)}mm"
     style="background:#0a0f1d;">
  <defs>
    <style>
      .cam-disc-1 { fill: rgba(0, 242, 254, 0.15); stroke: #00f2fe; stroke-width: 0.35; }
      .cam-disc-2 { fill: rgba(255, 0, 127, 0.12); stroke: #ff007f; stroke-width: 0.35; }
      .bore { fill: #0a0f1d; stroke: #ff007f; stroke-width: 0.3; }
      .carrier-hole { fill: #0a0f1d; stroke: #f59e0b; stroke-width: 0.25; }
      .carrier-pin { fill: rgba(59, 130, 246, 0.3); stroke: #3b82f6; stroke-width: 0.3; }
      .stator-pin { fill: rgba(56, 239, 125, 0.2); stroke: #38ef7d; stroke-width: 0.25; }
      .axis { stroke: #475569; stroke-width: 0.15; stroke-dasharray: 1 1; }
    </style>
  </defs>

  <!-- Осевые линии -->
  <line x1="${minX}" y1="0" x2="${maxX}" y2="0" class="axis" />
  <line x1="0" y1="${-minY}" x2="0" y2="${-maxY}" class="axis" />

  <!-- Ролики статора -->
  ${(includeStator && statorRollers) ? `
  <g id="stator_rollers">
    ${statorRollers.map(r => `<circle cx="${r.x.toFixed(3)}" cy="${(-r.y).toFixed(3)}" r="${r.radius.toFixed(3)}" class="stator-pin" />`).join('\n    ')}
  </g>` : ''}

  <!-- Пальцы выходного вала (водило) -->
  ${carrierPinsSvg ? `
  <g id="carrier_pins">
    ${carrierPinsSvg}
  </g>` : ''}

  <!-- Диск 2 (противофаза -E) -->
  ${pathD2 ? `
  <g id="cycloid_cam_2">
    <path d="${pathD2}" class="cam-disc-2" />
    ${camBoreRadius > 0 ? `<circle cx="${(-E).toFixed(3)}" cy="0" r="${camBoreRadius.toFixed(3)}" class="bore" />` : ''}
    ${includeCarrier ? d2Holes.map(h => `<circle cx="${h.x.toFixed(3)}" cy="${(-h.y).toFixed(3)}" r="${h.radius.toFixed(3)}" class="carrier-hole" />`).join('\n    ') : ''}
  </g>` : ''}

  <!-- Диск 1 (рабочий, смещение +E) -->
  <g id="cycloid_cam_1">
    <path d="${pathD1}" class="cam-disc-1" />
    ${camBoreRadius > 0 ? `<circle cx="${shiftX1.toFixed(3)}" cy="0" r="${camBoreRadius.toFixed(3)}" class="bore" />` : ''}
    ${includeCarrier ? carrierHoles.map(h => `<circle cx="${(h.x + shiftX1).toFixed(3)}" cy="${(-h.y).toFixed(3)}" r="${h.radius.toFixed(3)}" class="carrier-hole" />`).join('\n    ') : ''}
  </g>
</svg>`;

    return svg;
  }

  /**
   * Генерация SVG для двухвенцового редуктора (Compound Cycloid)
   */
  static generateCompound(options) {
    const {
      compoundSolution,
      exportMode = "assembly" // 'assembly' | 'disc1_only' | 'disc2_only' | 'sheet_layout'
    } = options;

    const sol = compoundSolution;
    const E = sol.E;
    const boreRadius = sol.camBore / 2;

    const ptsToPath = (pts, shiftX = 0, shiftY = 0) => {
      if (!pts || pts.length === 0) return "";
      let d = `M ${(pts[0].x + shiftX).toFixed(3)} ${(-pts[0].y + shiftY).toFixed(3)} `;
      for (let i = 1; i < pts.length; i++) {
        d += `L ${(pts[i].x + shiftX).toFixed(3)} ${(-pts[i].y + shiftY).toFixed(3)} `;
      }
      d += "Z";
      return d;
    };

    let minX = -50, maxX = 50, minY = -50, maxY = 50;

    const updateBounds = (x, y, r = 0) => {
      if (x - r < minX) minX = x - r;
      if (x + r > maxX) maxX = x + r;
      if (y - r < minY) minY = y - r;
      if (y + r > maxY) maxY = y + r;
    };

    let bodySvg = "";

    if (exportMode === "disc1_only") {
      const path1 = ptsToPath(sol.stage1.points);
      sol.stage1.points.forEach(p => updateBounds(p.x, -p.y));
      bodySvg += `<g id="compound_disc_1"><path d="${path1}" fill="rgba(0, 242, 254, 0.2)" stroke="#00f2fe" stroke-width="1" />`;
      bodySvg += `<circle cx="0" cy="0" r="${boreRadius.toFixed(3)}" fill="#0a0f1d" stroke="#ec4899" stroke-width="1" />`;
      if (sol.useDowelPins && sol.dowelPins) {
        sol.dowelPins.forEach(p => {
          bodySvg += `<circle cx="${p.x.toFixed(3)}" cy="${(-p.y).toFixed(3)}" r="${p.radius.toFixed(3)}" fill="#0a0f1d" stroke="#cbd5e1" stroke-width="0.8" />`;
        });
      }
      bodySvg += `</g>`;
    } else if (exportMode === "disc2_only") {
      const path2 = ptsToPath(sol.stage2.points);
      sol.stage2.points.forEach(p => updateBounds(p.x, -p.y));
      bodySvg += `<g id="compound_disc_2"><path d="${path2}" fill="rgba(192, 132, 252, 0.2)" stroke="#c084fc" stroke-width="1" />`;
      bodySvg += `<circle cx="0" cy="0" r="${boreRadius.toFixed(3)}" fill="#0a0f1d" stroke="#ec4899" stroke-width="1" />`;
      if (sol.useDowelPins && sol.dowelPins) {
        sol.dowelPins.forEach(p => {
          bodySvg += `<circle cx="${p.x.toFixed(3)}" cy="${(-p.y).toFixed(3)}" r="${p.radius.toFixed(3)}" fill="#0a0f1d" stroke="#cbd5e1" stroke-width="0.8" />`;
        });
      }
      bodySvg += `</g>`;
    } else {
      // 'assembly' (по умолчанию)
      // Stator 1
      bodySvg += `<g id="stator1_rollers">`;
      for (const r of sol.stator1Rollers) {
        updateBounds(r.x, -r.y, r.radius);
        bodySvg += `<circle cx="${r.x.toFixed(3)}" cy="${(-r.y).toFixed(3)}" r="${r.radius.toFixed(3)}" fill="rgba(56, 239, 125, 0.2)" stroke="#38ef7d" stroke-width="1" />`;
      }
      bodySvg += `</g>`;

      // Output Ring
      bodySvg += `<g id="output_rollers">`;
      for (const r of sol.outputRingRollers) {
        updateBounds(r.x, -r.y, r.radius);
        bodySvg += `<circle cx="${r.x.toFixed(3)}" cy="${(-r.y).toFixed(3)}" r="${r.radius.toFixed(3)}" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" stroke-width="1" />`;
      }
      bodySvg += `</g>`;

      // Disc 1 (shifted by +E)
      const path1 = ptsToPath(sol.stage1.points, E, 0);
      sol.stage1.points.forEach(p => updateBounds(p.x + E, -p.y));
      bodySvg += `<g id="compound_disc_1"><path d="${path1}" fill="rgba(0, 242, 254, 0.15)" stroke="#00f2fe" stroke-width="1" /></g>`;

      // Disc 2 (shifted by +E)
      const path2 = ptsToPath(sol.stage2.points, E, 0);
      sol.stage2.points.forEach(p => updateBounds(p.x + E, -p.y));
      bodySvg += `<g id="compound_disc_2"><path d="${path2}" fill="rgba(192, 132, 252, 0.18)" stroke="#c084fc" stroke-width="1" />`;
      bodySvg += `<circle cx="${E.toFixed(3)}" cy="0" r="${boreRadius.toFixed(3)}" fill="#0a0f1d" stroke="#ec4899" stroke-width="1" />`;
      if (sol.useDowelPins && sol.dowelPins) {
        sol.dowelPins.forEach(p => {
          bodySvg += `<circle cx="${(p.x + E).toFixed(3)}" cy="${(-p.y).toFixed(3)}" r="${p.radius.toFixed(3)}" fill="#0a0f1d" stroke="#cbd5e1" stroke-width="0.8" />`;
        });
      }
      bodySvg += `</g>`;
    }

    const margin = 10;
    const vbX = (minX - margin).toFixed(2);
    const vbY = (minY - margin).toFixed(2);
    const vbW = (maxX - minX + margin * 2).toFixed(2);
    const vbH = (maxY - minY + margin * 2).toFixed(2);

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}mm" height="${vbH}mm" style="background:#0a0f1d">
  ${bodySvg}
</svg>`;
  }

  static download(svgContent, filename = "cycloid_gear.svg") {
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
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
