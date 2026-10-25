/**
 * ParameterGuide — Интерактивная справочная база и визуальный инспектор параметров
 * в стиле Ultimaker Cura Settings Guide для CycloidDrive Studio.
 */

export const GUIDE_DATA = {
  z1: {
    title: "Число зубьев диска (Z₁)",
    symbol: "Z₁",
    badge: "Z₁ • целое число (шт)",
    summary: "Определяет базовое передаточное отношение редуктора i = Z₁ : 1. Количество вершин и впадин на диске строго одинаково и равно Z₁. Неподвижных роликов статора всегда на один больше: Zs = Z₁ + 1.",
    formula: "i = -Z₁ : 1 &nbsp;|&nbsp; Zs = Z₁ + 1 &nbsp;|&nbsp; T_вых = T_вх · Z₁ · η",
    formulaDesc: "Выход вращается в противоположную сторону (минус) со снижением скорости в Z₁ раз и ростом крутящего момента.",
    impactHigh: "Выше редукция и выходной крутящий момент. Но зубья становятся мельче, требуют точного диаметра сопла/фрезы и жесткой посадки подшипников.",
    impactLow: "Крупные, максимально прочные зубья, легкая FDM-печать соплом 0.4–0.6 мм без наплывов. Но передаточное отношение невелико.",
    proTip: "Для первой печати и стандартных FDM-принтеров идеальный диапазон Z₁ — от 10 до 15. Профиль получается крупным, плавным, без риска перелива пластика во впадинах.",
    svg: `
      <svg viewBox="0 0 320 140" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#00f2fe" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="320" height="140" fill="#090e18" rx="8"/>
        <!-- Оси координат -->
        <line x1="160" y1="10" x2="160" y2="130" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3"/>
        <line x1="20" y1="70" x2="300" y2="70" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3"/>
        <!-- Окружность центров роликов -->
        <circle cx="160" cy="70" r="54" fill="none" stroke="rgba(56, 239, 125, 0.25)" stroke-dasharray="4,3"/>
        <!-- Стилизованный циклоидный диск (10 лепестков) -->
        <path d="M 160 22 C 168 22 172 28 178 30 C 185 32 192 28 198 32 C 205 38 202 46 208 52 C 213 58 221 60 221 68 C 221 76 213 80 209 86 C 204 92 206 100 200 106 C 193 111 186 107 179 109 C 173 111 168 118 160 118 C 152 118 147 111 141 109 C 134 107 127 111 120 106 C 114 100 116 92 111 86 C 107 80 99 76 99 68 C 99 60 107 58 112 52 C 118 46 115 38 122 32 C 128 28 135 32 142 30 C 148 28 152 22 160 22 Z"
              fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" stroke-width="2"/>
        <!-- Центральное отверстие -->
        <circle cx="160" cy="70" r="16" fill="#090e18" stroke="#00f2fe" stroke-width="1.5" stroke-dasharray="2,2"/>
        <circle cx="160" cy="70" r="4" fill="#00f2fe"/>
        <!-- Ролики статора (Zs = 11 шт, зеленые) -->
        <g fill="#38ef7d" stroke="#11241a" stroke-width="1.5">
          <circle cx="160" cy="16" r="5.5"/><circle cx="191" cy="24" r="5.5"/><circle cx="212" cy="46" r="5.5"/>
          <circle cx="214" cy="77" r="5.5"/><circle cx="199" cy="104" r="5.5"/><circle cx="171" cy="122" r="5.5"/>
          <circle cx="140" cy="120" r="5.5"/><circle cx="115" cy="100" r="5.5"/><circle cx="106" cy="69" r="5.5"/>
          <circle cx="113" cy="39" r="5.5"/><circle cx="134" cy="19" r="5.5"/>
        </g>
        <!-- Выноски и надписи -->
        <text x="24" y="28" fill="#00f2fe" font-size="11" font-weight="700" font-family="monospace">Диск: Z₁ зубьев</text>
        <text x="24" y="44" fill="#8899ac" font-size="10" font-family="sans-serif">вершин = впадин</text>
        <text x="220" y="28" fill="#38ef7d" font-size="11" font-weight="700" font-family="monospace">Статор: Zs роликов</text>
        <text x="220" y="44" fill="#8899ac" font-size="10" font-family="sans-serif">Zs = Z₁ + 1</text>
        <!-- Стрелка редукции -->
        <path d="M 235 105 A 25 25 0 0 1 275 105" fill="none" stroke="#ec4899" stroke-width="2" marker-end="url(#arrow)"/>
        <text x="236" y="125" fill="#ec4899" font-size="11" font-weight="700" font-family="monospace">i = Z₁ : 1</text>
      </svg>
    `
  },

  r: {
    title: "Радиус венца роликов (R)",
    symbol: "R",
    badge: "R • миллиметры (мм)",
    summary: "Базовый делительный радиус, на котором по окружности расположены центры неподвижных роликов статора (Pin Pitch Circle Radius). Задаёт общий масштаб редуктора, плечо сил и форму зубьев.",
    formula: "ξ = (e · Zs) / R &nbsp;≈&nbsp; 0.45 ... 0.70 &nbsp;|&nbsp; R > Z₁ · e",
    formulaDesc: "ξ — коэффициент укорочения трохоиды. При R ≤ Z₁·e возникают петли самопересечения (undercutting).",
    impactHigh: "Больше плечо крутящего момента → резко падают контактные силы и напряжения по Герцу (пластик не сминается). Впадины раскрываются шире. Минус: больше диаметр корпуса.",
    impactLow: "Компактный внешний габарит, но контактные нагрузки на зубья резко возрастают. Отверстия под пальцы водила могут прорезать впадины диска насквозь.",
    proTip: "Стремитесь к соотношению R / e ≥ 15...25. Это гарантирует отсутствие петель трохоиды, отличную плавность зацепления и надежные перемычки между отверстиями пальцев водила.",
    svg: `
      <svg viewBox="0 0 320 140" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="140" fill="#090e18" rx="8"/>
        <!-- Окружность R -->
        <circle cx="160" cy="70" r="50" fill="none" stroke="#00f2fe" stroke-width="1.8" stroke-dasharray="5,4"/>
        <!-- Оси -->
        <line x1="160" y1="12" x2="160" y2="128" stroke="rgba(255,255,255,0.12)" stroke-dasharray="3,3"/>
        <line x1="20" y1="70" x2="300" y2="70" stroke="rgba(255,255,255,0.12)" stroke-dasharray="3,3"/>
        <!-- Центр (0,0) -->
        <circle cx="160" cy="70" r="3.5" fill="#fff"/>
        <text x="145" y="85" fill="#8899ac" font-size="10" font-family="sans-serif">(0,0)</text>
        <!-- Ролики статора по окружности -->
        <circle cx="210" cy="70" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="195" cy="35" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="160" cy="20" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="125" cy="35" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="110" cy="70" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="125" cy="105" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="160" cy="120" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <circle cx="195" cy="105" r="6" fill="#38ef7d" stroke="#11241a" stroke-width="1.5"/>
        <!-- Выносной радиус R с подсветкой -->
        <line x1="160" y1="70" x2="195" y2="35" stroke="#00f2fe" stroke-width="2.5"/>
        <circle cx="195" cy="35" r="2.5" fill="#00f2fe"/>
        <!-- Стрелочка и метка R -->
        <rect x="165" y="40" width="30" height="18" fill="rgba(0, 242, 254, 0.2)" rx="4" stroke="#00f2fe" stroke-width="1"/>
        <text x="175" y="53" fill="#00f2fe" font-size="12" font-weight="bold" font-family="monospace">R</text>
        <!-- Инфо надписи -->
        <text x="20" y="28" fill="#00f2fe" font-size="11" font-weight="700" font-family="monospace">Делительный радиус R</text>
        <text x="20" y="44" fill="#8899ac" font-size="10" font-family="sans-serif">до центров роликов</text>
        <text x="210" y="125" fill="#38ef7d" font-size="10" font-family="sans-serif">Венец роликов статора</text>
      </svg>
    `
  },

  rr: {
    title: "Радиус ролика статора (Rr)",
    symbol: "Rr",
    badge: "Rr • миллиметры (мм)",
    summary: "Радиус внешних тел качения (подшипников или калёных штифтов статора), с которыми вступают в силовой контакт зубья циклоидного диска.",
    formula: "Rr ≈ (1.5 ... 2.8) · e &nbsp;|&nbsp; 2 · Rr &lt; L_хорды роликов",
    formulaDesc: "Диаметр ролика 2·Rr должен быть меньше расстояния между соседними роликами, чтобы оставалась стенка корпуса.",
    impactHigh: "Шире пятно контакта → меньше контактное напряжение по Герцу (пластик не сминается). Можно применить прочные толстые оси. Минус: зубья диска сужаются у вершин.",
    impactLow: "Вершины зубьев диска массивнее и толще, но контактные напряжения растут («точечный укол» ролика в пластик), а тонкие оси роликов могут согнуться.",
    proTip: "Выбирайте Rr под реальные покупные детали: подшипники MR63 (Rr=1.5 мм), MR84 (Rr=2.0 мм), 688 (Rr=4.0 мм) или калёные штифты DIN 6325 диаметром 3, 4 или 5 мм.",
    svg: `
      <svg viewBox="0 0 320 140" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="140" fill="#090e18" rx="8"/>
        <!-- Зуб циклоидного диска (cyan) -->
        <path d="M 60 120 C 100 115 115 90 120 70 C 125 50 145 25 180 25 C 215 25 235 50 240 70 C 245 90 260 115 300 120"
              fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" stroke-width="2.5"/>
        <!-- Ролик статора (зеленый круг с ядром) -->
        <circle cx="180" cy="65" r="36" fill="rgba(56, 239, 125, 0.2)" stroke="#38ef7d" stroke-width="2.5"/>
        <circle cx="180" cy="65" r="14" fill="#1e2c3d" stroke="#5a728e" stroke-width="1.5"/>
        <circle cx="180" cy="65" r="3" fill="#38ef7d"/>
        <!-- Стрелка радиуса Rr -->
        <line x1="180" y1="65" x2="207" y2="41" stroke="#38ef7d" stroke-width="2.5"/>
        <polygon points="207,41 199,44 203,50" fill="#38ef7d"/>
        <rect x="187" y="38" width="34" height="18" fill="rgba(56, 239, 125, 0.2)" rx="4" stroke="#38ef7d" stroke-width="1"/>
        <text x="194" y="51" fill="#38ef7d" font-size="11" font-weight="bold" font-family="monospace">Rr</text>
        <!-- Пятно контакта Герца -->
        <ellipse cx="180" cy="29" rx="14" ry="4" fill="rgba(255, 0, 127, 0.4)" stroke="#ff007f" stroke-width="1.5"/>
        <text x="210" y="22" fill="#ff007f" font-size="10" font-weight="700" font-family="sans-serif">Зона контакта Герца</text>
        <!-- Описание -->
        <text x="20" y="24" fill="#38ef7d" font-size="11" font-weight="700" font-family="monospace">Ролик статора Rr</text>
        <text x="20" y="40" fill="#8899ac" font-size="10" font-family="sans-serif">Пятно контакта с зубом</text>
        <text x="20" y="130" fill="#00f2fe" font-size="10" font-family="monospace">Профиль зуба диска</text>
      </svg>
    `
  },

  e: {
    title: "Эксцентриситет (e)",
    symbol: "e",
    badge: "e • миллиметры (мм)",
    summary: "Радиальное смещение оси вращения циклоидного диска относительно центральной оси входного вала двигателя. Задаёт глубину зацепления и размах орбитального движения диска.",
    formula: "H_зуба ≈ 2 · e &nbsp;|&nbsp; D_отв_водила = D_пальца + 2 · e",
    formulaDesc: "Высота зуба диска почти точно равна 2e. Отверстия под пальцы водила обязаны быть шире пальца ровно на 2e.",
    impactHigh: "Зубья глубже и выше → исключён риск «прощёлкивания» и срыва под нагрузкой. Минусы: растет центробежная вибрация мотора, истончается стенка кулачка эксцентрика.",
    impactLow: "Минимум вибраций, прочный толстостенный кулачок. Минусы: зубья становятся низкими и пологими, риск проскока при упругой деформации пластикового корпуса.",
    proTip: "Держите e в диапазоне 1.0–1.5 мм для редукторов с Z₁=10–15. Всегда следите за индикатором «Толщина стенки кулачка» во вкладке «Вал и эксцентрик» (t_min ≥ 1.5 мм).",
    svg: `
      <svg viewBox="0 0 320 140" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="140" fill="#090e18" rx="8"/>
        <!-- Центральная ось вала мотора C0 (0,0) -->
        <circle cx="130" cy="70" r="28" fill="#111827" stroke="#4b5563" stroke-width="1.5"/>
        <line x1="130" y1="30" x2="130" y2="110" stroke="#fff" stroke-width="1.2" stroke-dasharray="3,3"/>
        <line x1="90" y1="70" x2="170" y2="70" stroke="#fff" stroke-width="1.2" stroke-dasharray="3,3"/>
        <circle cx="130" cy="70" r="3.5" fill="#fff"/>
        <text x="108" y="94" fill="#9ca3af" font-size="10" font-family="sans-serif">Вал (0,0)</text>
        <!-- Смещенная ось эксцентрика C1 (+e, 0) -->
        <circle cx="175" cy="70" r="42" fill="rgba(236, 72, 153, 0.12)" stroke="#ec4899" stroke-width="2"/>
        <line x1="175" y1="20" x2="175" y2="120" stroke="#ec4899" stroke-width="1.2" stroke-dasharray="3,3"/>
        <circle cx="175" cy="70" r="4" fill="#ec4899"/>
        <text x="175" y="94" fill="#ec4899" font-size="10" font-family="sans-serif">Кулачок</text>
        <!-- Размерная линия e -->
        <line x1="130" y1="46" x2="175" y2="46" stroke="#00f2fe" stroke-width="2"/>
        <polygon points="130,46 135,43 135,49" fill="#00f2fe"/>
        <polygon points="175,46 170,43 170,49" fill="#00f2fe"/>
        <rect x="143" y="36" width="20" height="18" fill="rgba(0, 242, 254, 0.25)" rx="3" stroke="#00f2fe" stroke-width="1"/>
        <text x="149" y="49" fill="#00f2fe" font-size="12" font-weight="bold" font-family="monospace">e</text>
        <!-- Орбита вращения -->
        <circle cx="130" cy="70" r="45" fill="none" stroke="rgba(236, 72, 153, 0.3)" stroke-dasharray="2,3"/>
        <text x="215" y="32" fill="#ec4899" font-size="11" font-weight="700" font-family="monospace">Эксцентриситет e</text>
        <text x="215" y="48" fill="#8899ac" font-size="10" font-family="sans-serif">Смещение центра диска</text>
        <text x="215" y="118" fill="#00f2fe" font-size="10" font-family="sans-serif">Высота зуба H ≈ 2e</text>
      </svg>
    `
  }
};

/**
 * Класс управления интерактивным окном инженерной справки
 */
export class ParameterGuide {
  constructor() {
    this.popover = null;
    this.currentKey = null;
    this.activeBtn = null;
    this.init();
  }

  init() {
    this.createPopoverElement();
    this.bindEvents();
  }

  createPopoverElement() {
    if (document.getElementById("param-help-popover")) {
      this.popover = document.getElementById("param-help-popover");
      return;
    }

    const popover = document.createElement("div");
    popover.id = "param-help-popover";
    popover.className = "help-popover";
    popover.style.display = "none";
    popover.innerHTML = `
      <div class="help-popover-header">
        <div class="help-title-wrap">
          <span class="help-header-icon">📖</span>
          <div class="help-title-text">
            <h4 class="help-title" id="help-popover-title">Параметр</h4>
            <span class="help-badge" id="help-popover-badge">Справка</span>
          </div>
        </div>
        <button type="button" class="help-close-btn" id="help-popover-close" aria-label="Закрыть справку">&times;</button>
      </div>

      <div class="help-popover-body">
        <div class="help-diagram-container" id="help-popover-diagram"></div>

        <div class="help-section">
          <div class="help-section-title">Физический смысл и кинематика</div>
          <p class="help-text" id="help-popover-summary"></p>
        </div>

        <div class="help-formula-box" id="help-popover-formula-box">
          <div class="help-formula-label">Ключевое соотношение:</div>
          <div class="help-formula" id="help-popover-formula"></div>
          <div class="help-formula-desc" id="help-popover-formula-desc"></div>
        </div>

        <div class="help-section">
          <div class="help-section-title">Влияние на конструкцию:</div>
          <div class="help-impact-grid">
            <div class="help-impact-item impact-high">
              <span class="impact-arrow">▲</span>
              <div class="impact-content">
                <strong>При увеличении:</strong>
                <span id="help-popover-impact-high"></span>
              </div>
            </div>
            <div class="help-impact-item impact-low">
              <span class="impact-arrow">▼</span>
              <div class="impact-content">
                <strong>При уменьшении:</strong>
                <span id="help-popover-impact-low"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="help-tip-box">
          <div class="help-tip-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span>Совет инженера по 3D-печати:</span>
          </div>
          <p class="help-tip-text" id="help-popover-protip"></p>
        </div>
      </div>
    `;

    document.body.appendChild(popover);
    this.popover = popover;
  }

  bindEvents() {
    // Делегирование кликов по всем кнопкам .help-btn
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".help-btn");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const paramKey = btn.getAttribute("data-help");
        if (this.currentKey === paramKey && this.popover.style.display !== "none") {
          this.close();
        } else {
          this.open(paramKey, btn);
        }
        return;
      }

      // Клик по кнопке закрытия
      if (e.target.closest("#help-popover-close")) {
        this.close();
        return;
      }

      // Клик вне карточки закрывает ее
      if (this.popover && this.popover.style.display !== "none") {
        if (!this.popover.contains(e.target)) {
          this.close();
        }
      }
    });

    // Закрытие по клавише Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.popover && this.popover.style.display !== "none") {
        this.close();
      }
    });

    // Корректировка позиции при ресайзе окна
    window.addEventListener("resize", () => {
      if (this.popover && this.popover.style.display !== "none" && this.activeBtn) {
        this.positionPopover(this.activeBtn);
      }
    });
  }

  open(paramKey, btnElement) {
    const data = GUIDE_DATA[paramKey];
    if (!data) return;

    this.currentKey = paramKey;
    if (this.activeBtn) this.activeBtn.classList.remove("active");
    this.activeBtn = btnElement;
    this.activeBtn.classList.add("active");

    // Заполнение данными
    document.getElementById("help-popover-title").textContent = data.title;
    document.getElementById("help-popover-badge").innerHTML = data.badge;
    document.getElementById("help-popover-diagram").innerHTML = data.svg;
    document.getElementById("help-popover-summary").textContent = data.summary;
    document.getElementById("help-popover-formula").innerHTML = data.formula;
    document.getElementById("help-popover-formula-desc").textContent = data.formulaDesc;
    document.getElementById("help-popover-impact-high").textContent = " " + data.impactHigh;
    document.getElementById("help-popover-impact-low").textContent = " " + data.impactLow;
    document.getElementById("help-popover-protip").textContent = data.proTip;

    this.popover.style.display = "block";
    this.positionPopover(btnElement);
  }

  positionPopover(btn) {
    const btnRect = btn.getBoundingClientRect();
    const popoverRect = this.popover.getBoundingClientRect();
    const padding = 12;

    // Пытаемся разместить справа от кнопки (над холстом)
    let left = btnRect.right + padding;
    let top = btnRect.top - 20;

    // Если справа не помещается, проверяем слева или ниже
    if (left + popoverRect.width > window.innerWidth - padding) {
      // Слева
      left = btnRect.left - popoverRect.width - padding;
    }

    if (left < padding) {
      // Центрируем по ширине экрана
      left = Math.max(padding, (window.innerWidth - popoverRect.width) / 2);
    }

    // Проверяем вертикальные границы экрана
    if (top + popoverRect.height > window.innerHeight - padding) {
      top = window.innerHeight - popoverRect.height - padding;
    }
    if (top < padding) {
      top = padding;
    }

    this.popover.style.left = `${Math.round(left)}px`;
    this.popover.style.top = `${Math.round(top)}px`;
  }

  close() {
    if (this.popover) {
      this.popover.style.display = "none";
    }
    if (this.activeBtn) {
      this.activeBtn.classList.remove("active");
      this.activeBtn = null;
    }
    this.currentKey = null;
  }
}
