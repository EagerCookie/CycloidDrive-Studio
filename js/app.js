import { SensingerSolver } from "./solvers/sensinger.js";
import { ZinclandSolver } from "./solvers/zincland.js";
import { EpitrochoidSolver } from "./solvers/epitrochoid.js";
import { CompoundCycloidSolver } from "./compoundSolver.js";
import { CanvasRenderer } from "./canvasRenderer.js";
import { DxfExporter } from "./dxfExporter.js";
import { SvgExporter } from "./svgExporter.js";
import { ProfileRelief } from "./profileRelief.js";
import { CurvatureInspector } from "./curvatureInspector.js";
import { StressCalculator } from "./stressCalculator.js";

// Главный класс приложения
class CycloidApp {
  constructor() {
    this.canvas = document.getElementById("cycloid-canvas");
    this.renderer = new CanvasRenderer(this.canvas);

    // База данных стандартных подшипников для 3D-печати
    this.bearings = {
      "6801": { id: 12.0, od: 21.0, w: 5.0, name: "6801 (12x21x5 мм)" },
      "6802": { id: 15.0, od: 24.0, w: 5.0, name: "6802 (15x24x5 мм)" },
      "6803": { id: 17.0, od: 26.0, w: 5.0, name: "6803 (17x26x5 мм)" },
      "6804": { id: 20.0, od: 32.0, w: 7.0, name: "6804 (20x32x7 мм)" },
      "6800": { id: 10.0, od: 19.0, w: 5.0, name: "6800 (10x19x5 мм)" },
      "6900": { id: 10.0, od: 22.0, w: 6.0, name: "6900 (10x22x6 мм)" },
      "608":  { id: 8.0,  od: 22.0, w: 7.0, name: "608 (8x22x7 мм)" },
      "custom": null
    };

    // База данных двигателей и валов
    this.motorShafts = {
      "nema17-d": { d: 5.0, hasDcut: true, cutDepth: 0.5 },
      "nema17-round": { d: 5.0, hasDcut: false, cutDepth: 0 },
      "nema23-d": { d: 8.0, hasDcut: true, cutDepth: 0.5 },
      "nema23-round": { d: 8.0, hasDcut: false, cutDepth: 0 },
      "quarter-inch": { d: 6.35, hasDcut: false, cutDepth: 0 },
      "shaft-4": { d: 4.0, hasDcut: false, cutDepth: 0 },
      "custom": null
    };

    // База данных подшипников для выходных пальцев
    this.pinBearings = {
      "mr74": { id: 4.0, od: 7.0, w: 2.5, name: "MR74-ZZ (4x7x2.5)" },
      "mr84": { id: 4.0, od: 8.0, w: 3.0, name: "MR84-ZZ (4x8x3.0)" },
      "mr85": { id: 5.0, od: 8.0, w: 2.5, name: "MR85-ZZ (5x8x2.5)" },
      "mr95": { id: 5.0, od: 9.0, w: 3.0, name: "MR95-ZZ (5x9x3.0)" },
      "mr105": { id: 5.0, od: 10.0, w: 4.0, name: "MR105-ZZ (5x10x4.0)" },
      "mr63": { id: 3.0, od: 6.0, w: 2.5, name: "MR63-ZZ (3x6x2.5)" },
      "mr106": { id: 6.0, od: 10.0, w: 3.0, name: "MR106-ZZ (6x10x3.0)" },
      "693": { id: 3.0, od: 8.0, w: 4.0, name: "693-ZZ (3x8x4.0)" },
      "694": { id: 4.0, od: 11.0, w: 4.0, name: "694-ZZ (4x11x4.0)" },
      "695": { id: 5.0, od: 13.0, w: 4.0, name: "695-ZZ (5x13x4.0)" },
      "custom": null
    };

    // Состояние параметров
    this.params = {
      solver: "sensinger",
      Z1: 10,
      R: 30.0,
      Rr: 3.0,
      E: 1.5,
      clearance: 0.05,
      camBore: 21.0, // Синхронизируется с bearingOd
      steps: 1200,

      // Модификации под 3D-печать (Tip & Root Relief)
      useRelief: false,
      tipRelief: 0.20,
      rootRelief: 0.10,
      tipReliefMode: "truncate",

      // Инструмент изготовления и контроль кривизны (Curvature Inspector)
      toolType: "nozzle-0.4",
      toolDiameter: 0.40,

      // Силовой и прочностной расчёт (Sensinger Stress)
      motorTorquePreset: "nema17-standard",
      motorTorque: 0.45,
      motorRpm: 1000,
      discThickness: 10.0,
      discMaterial: "pla",

      // Входной узел (Вал двигателя и кулачок-эксцентрик)
      shaftD: 5.0,
      hasDcut: true,
      dcutFlat: 0.5,
      bearingPreset: "6801",
      bearingId: 12.0,
      bearingOd: 21.0,

      // Выходной механизм (пальцы водила)
      carrierN: 6,
      carrierR: 17.0,
      carrierPinD: 5.0,
      usePinBearings: true,
      pinBearingPreset: "mr84",
      pinBearingId: 4.0,
      pinBearingOd: 8.0,
      dualDisc: false,

      // Архитектура редуктора ("standard" | "compound")
      driveType: "standard",

      // Параметры второго венца и кольца выхода (Compound Cycloid)
      Z2: 10,
      ZoutMode: "plus_1",
      Zout: 11,
      R2: 28.0,
      Rr2: 2.5,
      clearance2: 0.05,
      useDowelPins: true,
      dowelD: 3.0,
      dowelR: 16.0,
      dowelN: 4
    };

    // Состояние анимации
    this.sim = {
      isPlaying: false,
      crankAngle: 0, // градусы
      speed: 1.0,    // множитель скорости
      lastTimestamp: 0
    };

    // Текущее решение
    this.currentSolution = null;
    this.compoundSolution = null;

    this.initDOM();
    this.initPresets();
    this.loadCustomPresets();
    this.setupEvents();
    this.updateCalculations();
    this.startAnimationLoop();
  }

  initDOM() {
    // Вкладки
    this.tabBtns = document.querySelectorAll(".tab-btn");
    this.tabContents = document.querySelectorAll(".tab-content");

    // Инпуты параметров
    this.inputs = {
      solver: document.getElementById("param-solver"),
      z1: { range: document.getElementById("inp-z1"), num: document.getElementById("num-z1"), val: document.getElementById("val-z1") },
      r: { range: document.getElementById("inp-r"), num: document.getElementById("num-r"), val: document.getElementById("val-r") },
      rr: { range: document.getElementById("inp-rr"), num: document.getElementById("num-rr"), val: document.getElementById("val-rr") },
      e: { range: document.getElementById("inp-e"), num: document.getElementById("num-e"), val: document.getElementById("val-e") },
      clearance: { range: document.getElementById("inp-clearance"), num: document.getElementById("num-clearance"), val: document.getElementById("val-clearance") },
      camBore: { range: document.getElementById("inp-cam-bore"), num: document.getElementById("num-cam-bore"), val: document.getElementById("val-cam-bore") },
      steps: { range: document.getElementById("inp-steps"), num: document.getElementById("num-steps"), val: document.getElementById("val-steps") },

      // Входной узел
      motorPreset: document.getElementById("sel-motor-preset"),
      shaftD: { range: document.getElementById("inp-shaft-d"), num: document.getElementById("num-shaft-d"), val: document.getElementById("val-shaft-d") },
      chkDcut: document.getElementById("chk-shaft-dcut"),
      bearingPreset: document.getElementById("sel-bearing-preset"),
      bearingId: { range: document.getElementById("inp-bearing-id"), num: document.getElementById("num-bearing-id"), val: document.getElementById("val-bearing-id") },
      bearingOd: { range: document.getElementById("inp-bearing-od"), num: document.getElementById("num-bearing-od"), val: document.getElementById("val-bearing-od") },

      // Выходной вал
      carrierN: { range: document.getElementById("inp-carrier-n"), num: document.getElementById("num-carrier-n"), val: document.getElementById("val-carrier-n") },
      carrierR: { range: document.getElementById("inp-carrier-r"), num: document.getElementById("num-carrier-r"), val: document.getElementById("val-carrier-r") },
      carrierPinD: { range: document.getElementById("inp-carrier-pin-d"), num: document.getElementById("num-carrier-pin-d"), val: document.getElementById("val-carrier-pin-d") },
      dualDisc: document.getElementById("chk-dual-disc"),

      // Подшипники выходных пальцев
      chkPinBearing: document.getElementById("chk-pin-bearing"),
      pinBearingControls: document.getElementById("pin-bearing-controls"),
      pinDirectControls: document.getElementById("pin-direct-controls"),
      selPinBearing: document.getElementById("sel-pin-bearing"),
      pinBearingId: { range: document.getElementById("inp-pin-b-id"), num: document.getElementById("num-pin-b-id"), val: document.getElementById("val-pin-b-id") },
      pinBearingOd: { range: document.getElementById("inp-pin-b-od"), num: document.getElementById("num-pin-b-od"), val: document.getElementById("val-pin-b-od") },
      infoHoleFormula: document.getElementById("info-hole-formula"),
      infoMaxBearingHint: document.getElementById("info-max-bearing-hint")
    };

    // Модификации профиля (Relief)
    this.relief = {
      chkUseRelief: document.getElementById("chk-use-relief"),
      controlsBox: document.getElementById("relief-controls-box"),
      tipRelief: { range: document.getElementById("inp-tip-relief"), num: document.getElementById("num-tip-relief"), val: document.getElementById("val-tip-relief") },
      rootRelief: { range: document.getElementById("inp-root-relief"), num: document.getElementById("num-root-relief"), val: document.getElementById("val-root-relief") },
      selTipMode: document.getElementById("sel-tip-mode"),
      valToothHeight: document.getElementById("val-tooth-height"),
      valRmaxRelieved: document.getElementById("val-rmax-relieved")
    };

    // Оценка стенки эксцентрика для 3D печати
    this.eccentricCard = {
      card: document.getElementById("eccentric-wall-card"),
      title: document.getElementById("eccentric-wall-title"),
      desc: document.getElementById("eccentric-wall-desc")
    };

    // Оценка стенок диска вокруг отверстий выходных пальцев
    this.carrierWallElements = {
      card: document.getElementById("carrier-wall-card"),
      title: document.getElementById("carrier-wall-title"),
      desc: document.getElementById("carrier-wall-desc"),
      mWallInner: document.getElementById("m-wall-inner"),
      mWallOuter: document.getElementById("m-wall-outer"),
      mWallInter: document.getElementById("m-wall-inter")
    };

    // Элементы симуляции
    this.simElements = {
      btnPlayPause: document.getElementById("btn-play-pause"),
      iconPlay: document.getElementById("icon-play"),
      iconPause: document.getElementById("icon-pause"),
      playPauseText: document.getElementById("play-pause-text"),
      btnStepFwd: document.getElementById("btn-step-fwd"),
      btnResetAngle: document.getElementById("btn-reset-angle"),
      inpCrankAngle: document.getElementById("inp-crank-angle"),
      crankAngleText: document.getElementById("crank-angle-text"),
      inpSpeed: document.getElementById("inp-speed"),
      speedText: document.getElementById("speed-text"),
      outputAngleText: document.getElementById("output-angle-text")
    };

    // Метрики
    this.metrics = {
      badgeRatio: document.getElementById("badge-ratio"),
      hintZ2: document.getElementById("hint-z2"),
      hintDr: document.getElementById("hint-dr"),
      infoHoleCalc: document.getElementById("info-hole-calc"),
      statusCard: document.getElementById("status-card"),
      statusText: document.getElementById("status-text"),
      statusDesc: document.getElementById("status-desc"),
      mK1: document.getElementById("m-k1"),
      mEmax: document.getElementById("m-emax"),
      mEcurr: document.getElementById("m-ecurr"),
      mRmin: document.getElementById("m-rmin"),
      mRcurr: document.getElementById("m-rcurr"),
      mRrmax: document.getElementById("m-rrmax"),
      mRrcurr: document.getElementById("m-rrcurr"),
      infoRatioDisplay: document.getElementById("info-ratio-display")
    };

    // Архитектура редуктора (Standard / Compound)
    this.archButtons = {
      standard: document.getElementById("btn-arch-standard"),
      compound: document.getElementById("btn-arch-compound")
    };
    this.tabBtnCarrier = document.getElementById("tab-btn-carrier");
    this.carrierStandardContainer = document.getElementById("carrier-standard-container");
    this.carrierCompoundContainer = document.getElementById("carrier-compound-container");
    this.badgeArchRatio = document.getElementById("badge-arch-ratio");

    // Элементы управления вторым венцом (Compound Stage 2)
    this.compoundInputs = {
      z2: { range: document.getElementById("inp-z2"), num: document.getElementById("num-z2"), val: document.getElementById("val-z2") },
      selZoutMode: document.getElementById("sel-zout-mode"),
      valZout: document.getElementById("val-zout"),
      rowCustomZout: document.getElementById("row-custom-zout"),
      zout: { range: document.getElementById("inp-zout"), num: document.getElementById("num-zout") },
      r2: { range: document.getElementById("inp-r2"), num: document.getElementById("num-r2"), val: document.getElementById("val-r2") },
      rr2: { range: document.getElementById("inp-rr2"), num: document.getElementById("num-rr2"), val: document.getElementById("val-rr2") },
      hintDr2: document.getElementById("hint-dr2"),
      clearance2: { range: document.getElementById("inp-clearance2"), num: document.getElementById("num-clearance2"), val: document.getElementById("val-clearance2") },
      btnQuickZ2Minus: document.getElementById("btn-quick-z2-minus"),
      btnQuickZ2Plus: document.getElementById("btn-quick-z2-plus"),
      chkCompoundDowels: document.getElementById("chk-compound-dowels"),
      compoundDowelsControls: document.getElementById("compound-dowels-controls"),
      dowelD: { range: document.getElementById("inp-dowel-d"), num: document.getElementById("num-dowel-d"), val: document.getElementById("val-dowel-d") },
      dowelR: { range: document.getElementById("inp-dowel-r"), num: document.getElementById("num-dowel-r"), val: document.getElementById("val-dowel-r") },
      selDowelN: document.getElementById("sel-dowel-n"),
      valRatio: document.getElementById("val-compound-ratio"),
      valDir: document.getElementById("val-compound-dir"),
      valFormula: document.getElementById("val-compound-formula"),
      diagCard: document.getElementById("compound-diag-card"),
      diagTitle: document.getElementById("compound-diag-title"),
      diagDesc: document.getElementById("compound-diag-desc"),
      mWall1: document.getElementById("m-comp-wall1"),
      mWall2: document.getElementById("m-comp-wall2"),
      mDowelMargin: document.getElementById("m-comp-dowel-margin")
    };

    // Слои
    this.chips = {
      cam1: document.getElementById("chip-cam1"),
      cam2: document.getElementById("chip-cam2"),
      eccentric: document.getElementById("chip-eccentric"),
      rollers: document.getElementById("chip-rollers"),
      carrier: document.getElementById("chip-carrier"),
      outputRing: document.getElementById("chip-output-ring"),
      dowels: document.getElementById("chip-dowels"),
      pitch: document.getElementById("chip-pitch"),
      curvature: document.getElementById("chip-curvature")
    };
    this.chkLayers = {
      cam1: document.getElementById("chk-show-cam1"),
      cam2: document.getElementById("chk-show-cam2"),
      eccentric: document.getElementById("chk-show-eccentric"),
      rollers: document.getElementById("chk-show-rollers"),
      carrier: document.getElementById("chk-show-carrier"),
      outputRing: document.getElementById("chk-show-output-ring"),
      dowels: document.getElementById("chk-show-dowels"),
      pitch: document.getElementById("chk-show-pitch"),
      curvature: document.getElementById("chk-show-curvature")
    };

    // Контроль кривизны под сопло 3D-принтера / фрезу ЧПУ
    this.curvatureElements = {
      selToolType: document.getElementById("sel-tool-type"),
      rowCustomTool: document.getElementById("row-custom-tool"),
      inpToolD: { range: document.getElementById("inp-tool-d"), num: document.getElementById("num-tool-d"), val: document.getElementById("val-tool-d") },
      chkAnalysisCurvature: document.getElementById("chk-analysis-curvature"),
      statusCard: document.getElementById("curvature-status-card"),
      statusTitle: document.getElementById("curvature-status-title"),
      statusDesc: document.getElementById("curvature-status-desc"),
      mRhoConcave: document.getElementById("m-rho-concave"),
      mToolRadius: document.getElementById("m-tool-radius"),
      mToolMax: document.getElementById("m-tool-max"),
      mRhoConvex: document.getElementById("m-rho-convex"),
      mToolSafety: document.getElementById("m-tool-safety"),
      recNozzleBadge: document.getElementById("rec-nozzle-badge"),
      recEndmillBadge: document.getElementById("rec-endmill-badge")
    };

    // Силовой и прочностной расчёт (Sensinger Stress & Load Sharing)
    this.stressElements = {
      selMotorPreset: document.getElementById("sel-stress-motor-preset"),
      motorTorque: { range: document.getElementById("inp-motor-torque"), num: document.getElementById("num-motor-torque"), val: document.getElementById("val-motor-torque") },
      discThickness: { range: document.getElementById("inp-disc-thickness"), num: document.getElementById("num-disc-thickness"), val: document.getElementById("val-disc-thickness") },
      selMaterial: document.getElementById("sel-disc-material"),
      statusCard: document.getElementById("stress-status-card"),
      statusTitle: document.getElementById("stress-status-title"),
      statusDesc: document.getElementById("stress-status-desc"),
      mTout: document.getElementById("m-tout"),
      mFmaxRoller: document.getElementById("m-fmax-roller"),
      mActiveRollers: document.getElementById("m-active-rollers"),
      mSigmaHertz: document.getElementById("m-sigma-hertz"),
      mMatLimit: document.getElementById("m-mat-limit"),
      mStressSf: document.getElementById("m-stress-sf"),
      mFpin: document.getElementById("m-fpin"),
      mPinBend: document.getElementById("m-pin-bend"),
      mBacklash: document.getElementById("m-backlash"),
      mBacklashDeg: document.getElementById("m-backlash-deg"),
      mBacklashClearance: document.getElementById("m-backlash-clearance")
    };

    // Модальные окна и оверлеи
    this.modalDxf = document.getElementById("modal-dxf");
    this.modalSavePreset = document.getElementById("modal-save-preset");
    this.dragDropOverlay = document.getElementById("drag-drop-overlay");
    this.fileInputJson = document.getElementById("file-input-json");
    this.inpCustomPresetName = document.getElementById("inp-custom-preset-name");
    this.customPresetsGroup = document.getElementById("optgroup-custom-presets");
    this.presetSelect = document.getElementById("preset-select");
    this.customPresets = {};
  }

  initPresets() {
    this.presets = {
      "standard-10": {
        solver: "sensinger",
        Z1: 10,
        R: 30.0,
        Rr: 3.0,
        E: 1.5,
        clearance: 0.05,
        bearingPreset: "6801",
        bearingId: 12.0,
        bearingOd: 21.0,
        camBore: 21.0,
        shaftD: 5.0,
        hasDcut: true,
        carrierN: 6,
        carrierR: 17.0,
        carrierPinD: 5.0
      },
      "compact-15": {
        solver: "sensinger",
        Z1: 15,
        R: 32.0,
        Rr: 2.2,
        E: 1.0,
        clearance: 0.08,
        bearingPreset: "6800",
        bearingId: 10.0,
        bearingOd: 19.0,
        camBore: 19.0,
        shaftD: 5.0,
        hasDcut: true,
        carrierN: 6,
        carrierR: 16.0,
        carrierPinD: 4.5
      },
      "robotics-29": {
        solver: "sensinger",
        Z1: 29,
        R: 45.0,
        Rr: 2.0,
        E: 0.8,
        clearance: 0.04,
        bearingPreset: "6802",
        bearingId: 15.0,
        bearingOd: 24.0,
        camBore: 24.0,
        shaftD: 5.0,
        hasDcut: true,
        carrierN: 8,
        carrierR: 26.0,
        carrierPinD: 4.0
      },
      "high-torque-41": {
        solver: "sensinger",
        Z1: 41,
        R: 60.0,
        Rr: 2.0,
        E: 0.65,
        clearance: 0.03,
        bearingPreset: "6804",
        bearingId: 20.0,
        bearingOd: 32.0,
        camBore: 32.0,
        shaftD: 8.0,
        hasDcut: true,
        carrierN: 8,
        carrierR: 35.0,
        carrierPinD: 5.0
      },
      "zincland-default": {
        solver: "zincland",
        Z1: 9,
        R: 24.0,
        Rr: 3.0,
        E: 2.0,
        clearance: 0.0,
        bearingPreset: "6801",
        bearingId: 12.0,
        bearingOd: 21.0,
        camBore: 21.0,
        shaftD: 5.0,
        hasDcut: true,
        carrierN: 4,
        carrierR: 14.0,
        carrierPinD: 4.0
      },
      "compound-121": {
        driveType: "compound",
        solver: "sensinger",
        Z1: 11,
        R: 35.0,
        Rr: 3.0,
        E: 1.2,
        clearance: 0.05,
        camBore: 21.0,
        bearingPreset: "6801",
        bearingId: 12.0,
        bearingOd: 21.0,
        shaftD: 5.0,
        hasDcut: true,
        Z2: 10,
        ZoutMode: "plus_1",
        Zout: 11,
        R2: 28.0,
        Rr2: 2.5,
        clearance2: 0.05,
        useDowelPins: true,
        dowelD: 3.0,
        dowelR: 16.0,
        dowelN: 4
      },
      "compound-225": {
        driveType: "compound",
        solver: "sensinger",
        Z1: 15,
        R: 45.0,
        Rr: 3.5,
        E: 1.2,
        clearance: 0.05,
        camBore: 21.0,
        bearingPreset: "6801",
        bearingId: 12.0,
        bearingOd: 21.0,
        shaftD: 5.0,
        hasDcut: true,
        Z2: 14,
        ZoutMode: "plus_1",
        Zout: 15,
        R2: 38.0,
        Rr2: 3.0,
        clearance2: 0.05,
        useDowelPins: true,
        dowelD: 3.0,
        dowelR: 20.0,
        dowelN: 4
      },
      "compound-81": {
        driveType: "compound",
        solver: "sensinger",
        Z1: 9,
        R: 30.0,
        Rr: 3.0,
        E: 1.2,
        clearance: 0.05,
        camBore: 21.0,
        bearingPreset: "6801",
        bearingId: 12.0,
        bearingOd: 21.0,
        shaftD: 5.0,
        hasDcut: true,
        Z2: 8,
        ZoutMode: "plus_1",
        Zout: 9,
        R2: 24.0,
        Rr2: 2.5,
        clearance2: 0.05,
        useDowelPins: true,
        dowelD: 3.0,
        dowelR: 13.0,
        dowelN: 4
      },
      "compound-361": {
        driveType: "compound",
        solver: "sensinger",
        Z1: 19,
        R: 55.0,
        Rr: 3.0,
        E: 1.0,
        clearance: 0.05,
        camBore: 24.0,
        bearingPreset: "6802",
        bearingId: 15.0,
        bearingOd: 24.0,
        shaftD: 5.0,
        hasDcut: true,
        Z2: 18,
        ZoutMode: "plus_1",
        Zout: 19,
        R2: 48.0,
        Rr2: 2.5,
        clearance2: 0.05,
        useDowelPins: true,
        dowelD: 3.0,
        dowelR: 24.0,
        dowelN: 6
      }
    };
  }

  setupEvents() {
    // Переключение вкладок
    this.tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-tab");
        this.tabBtns.forEach(b => b.classList.remove("active"));
        this.tabContents.forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(targetId)?.classList.add("active");
      });
    });

    // Связка слайдеров и числовых полей
    const bindControl = (ctrl, key, isFloat = true, onChangeCallback = null) => {
      if (!ctrl || !ctrl.range) return;
      const updateVal = (val) => {
        const numVal = isFloat ? parseFloat(val) : parseInt(val, 10);
        if (isNaN(numVal)) return;
        this.params[key] = numVal;
        ctrl.range.value = numVal;
        ctrl.num.value = numVal;
        if (ctrl.val) ctrl.val.textContent = isFloat ? numVal.toFixed(2) : numVal;
        if (onChangeCallback) onChangeCallback(numVal);
        this.updateCalculations();
      };

      ctrl.range.addEventListener("input", (e) => updateVal(e.target.value));
      ctrl.num.addEventListener("change", (e) => updateVal(e.target.value));
    };

    bindControl(this.inputs.z1, "Z1", false);
    bindControl(this.inputs.r, "R", true);
    bindControl(this.inputs.rr, "Rr", true);
    bindControl(this.inputs.e, "E", true);
    bindControl(this.inputs.clearance, "clearance", true);
    bindControl(this.inputs.camBore, "camBore", true, (val) => {
      // Синхронизируем с внешним диаметром подшипника
      this.params.bearingOd = val;
      this.inputs.bearingOd.range.value = val;
      this.inputs.bearingOd.num.value = val;
      this.inputs.bearingOd.val.textContent = val.toFixed(2);
      this.inputs.bearingPreset.value = "custom";
    });
    bindControl(this.inputs.steps, "steps", false);

    // Входной узел: Вал двигателя
    bindControl(this.inputs.shaftD, "shaftD", true, () => {
      this.inputs.motorPreset.value = "custom";
    });
    this.inputs.chkDcut.addEventListener("change", (e) => {
      this.params.hasDcut = e.target.checked;
      this.render();
    });

    this.inputs.motorPreset.addEventListener("change", (e) => {
      const preset = this.motorShafts[e.target.value];
      if (preset) {
        this.params.shaftD = preset.d;
        this.params.hasDcut = preset.hasDcut;
        this.params.dcutFlat = preset.cutDepth;
        this.inputs.shaftD.range.value = preset.d;
        this.inputs.shaftD.num.value = preset.d;
        this.inputs.shaftD.val.textContent = preset.d.toFixed(2);
        this.inputs.chkDcut.checked = preset.hasDcut;
        this.updateCalculations();
      }
    });

    // Входной узел: Подшипник
    bindControl(this.inputs.bearingId, "bearingId", true, () => {
      this.inputs.bearingPreset.value = "custom";
    });
    bindControl(this.inputs.bearingOd, "bearingOd", true, (val) => {
      this.params.camBore = val;
      this.inputs.camBore.range.value = val;
      this.inputs.camBore.num.value = val;
      this.inputs.camBore.val.textContent = val.toFixed(2);
      this.inputs.bearingPreset.value = "custom";
    });

    this.inputs.bearingPreset.addEventListener("change", (e) => {
      const b = this.bearings[e.target.value];
      if (b) {
        this.params.bearingId = b.id;
        this.params.bearingOd = b.od;
        this.params.camBore = b.od;

        this.inputs.bearingId.range.value = b.id;
        this.inputs.bearingId.num.value = b.id;
        this.inputs.bearingId.val.textContent = b.id.toFixed(2);

        this.inputs.bearingOd.range.value = b.od;
        this.inputs.bearingOd.num.value = b.od;
        this.inputs.bearingOd.val.textContent = b.od.toFixed(2);

        this.inputs.camBore.range.value = b.od;
        this.inputs.camBore.num.value = b.od;
        this.inputs.camBore.val.textContent = b.od.toFixed(2);

        this.updateCalculations();
      }
    });

    // Кнопка быстрого экспорта чертежа эксцентрика
    document.getElementById("btn-export-cam-dxf").addEventListener("click", () => {
      this.exportEccentricCamDxf();
    });

    // Выходной вал
    bindControl(this.inputs.carrierN, "carrierN", false);
    bindControl(this.inputs.carrierR, "carrierR", true);
    bindControl(this.inputs.carrierPinD, "carrierPinD", true);

    // Подшипники выходных пальцев
    if (this.inputs.chkPinBearing) {
      this.inputs.chkPinBearing.addEventListener("change", (e) => {
        this.params.usePinBearings = e.target.checked;
        if (this.inputs.pinBearingControls) {
          this.inputs.pinBearingControls.style.display = e.target.checked ? "block" : "none";
        }
        if (this.inputs.pinDirectControls) {
          this.inputs.pinDirectControls.style.display = e.target.checked ? "none" : "block";
        }
        this.updateCalculations();
      });
    }

    if (this.inputs.selPinBearing) {
      this.inputs.selPinBearing.addEventListener("change", (e) => {
        const pb = this.pinBearings[e.target.value];
        if (pb) {
          this.params.pinBearingId = pb.id;
          this.params.pinBearingOd = pb.od;
          this.inputs.pinBearingId.range.value = pb.id;
          this.inputs.pinBearingId.num.value = pb.id;
          this.inputs.pinBearingId.val.textContent = pb.id.toFixed(2);
          this.inputs.pinBearingOd.range.value = pb.od;
          this.inputs.pinBearingOd.num.value = pb.od;
          this.inputs.pinBearingOd.val.textContent = pb.od.toFixed(2);
          this.updateCalculations();
        }
      });
    }

    bindControl(this.inputs.pinBearingId, "pinBearingId", true, () => {
      if (this.inputs.selPinBearing) this.inputs.selPinBearing.value = "custom";
    });
    bindControl(this.inputs.pinBearingOd, "pinBearingOd", true, () => {
      if (this.inputs.selPinBearing) this.inputs.selPinBearing.value = "custom";
    });

    this.inputs.solver.addEventListener("change", (e) => {
      this.params.solver = e.target.value;
      this.updateCalculations();
    });

    this.inputs.dualDisc.addEventListener("change", (e) => {
      this.params.dualDisc = e.target.checked;
      if (this.chkLayers.cam2) {
        this.chkLayers.cam2.checked = e.target.checked;
        this.renderer.layers.cam2 = e.target.checked;
        if (this.chips.cam2) {
          this.chips.cam2.classList.toggle("active", e.target.checked);
        }
      }
      const dxfDisc2 = document.getElementById("dxf-inc-disc2");
      if (dxfDisc2) {
        dxfDisc2.checked = e.target.checked;
      }
      this.updateCalculations();
    });

    // Архитектура редуктора (Standard Carrier Pins vs Compound Cycloid)
    if (this.archButtons.standard) {
      this.archButtons.standard.addEventListener("click", () => this.setDriveType("standard"));
    }
    if (this.archButtons.compound) {
      this.archButtons.compound.addEventListener("click", () => this.setDriveType("compound"));
    }

    // Параметры второго венца и кольца выхода (Compound Cycloid)
    bindControl(this.compoundInputs.z2, "Z2", false, () => {
      this.syncZout();
    });

    if (this.compoundInputs.selZoutMode) {
      this.compoundInputs.selZoutMode.addEventListener("change", (e) => {
        this.params.ZoutMode = e.target.value;
        if (this.compoundInputs.rowCustomZout) {
          this.compoundInputs.rowCustomZout.style.display = e.target.value === "custom" ? "block" : "none";
        }
        this.syncZout();
        this.updateCalculations();
      });
    }

    bindControl(this.compoundInputs.zout, "Zout", false);
    bindControl(this.compoundInputs.r2, "R2", true);
    bindControl(this.compoundInputs.rr2, "Rr2", true);
    bindControl(this.compoundInputs.clearance2, "clearance2", true);

    if (this.compoundInputs.btnQuickZ2Minus) {
      this.compoundInputs.btnQuickZ2Minus.addEventListener("click", () => {
        const newZ2 = Math.max(3, this.params.Z1 - 1);
        this.params.Z2 = newZ2;
        if (this.compoundInputs.z2 && this.compoundInputs.z2.range) {
          this.compoundInputs.z2.range.value = newZ2;
          this.compoundInputs.z2.num.value = newZ2;
          if (this.compoundInputs.z2.val) this.compoundInputs.z2.val.textContent = newZ2;
        }
        this.syncZout();
        this.updateCalculations();
      });
    }

    if (this.compoundInputs.btnQuickZ2Plus) {
      this.compoundInputs.btnQuickZ2Plus.addEventListener("click", () => {
        const newZ2 = this.params.Z1 + 1;
        this.params.Z2 = newZ2;
        if (this.compoundInputs.z2 && this.compoundInputs.z2.range) {
          this.compoundInputs.z2.range.value = newZ2;
          this.compoundInputs.z2.num.value = newZ2;
          if (this.compoundInputs.z2.val) this.compoundInputs.z2.val.textContent = newZ2;
        }
        this.syncZout();
        this.updateCalculations();
      });
    }

    if (this.compoundInputs.chkCompoundDowels) {
      this.compoundInputs.chkCompoundDowels.addEventListener("change", (e) => {
        this.params.useDowelPins = e.target.checked;
        if (this.compoundInputs.compoundDowelsControls) {
          this.compoundInputs.compoundDowelsControls.style.display = e.target.checked ? "block" : "none";
        }
        this.updateCalculations();
      });
    }

    bindControl(this.compoundInputs.dowelD, "dowelD", true);
    bindControl(this.compoundInputs.dowelR, "dowelR", true);

    if (this.compoundInputs.selDowelN) {
      this.compoundInputs.selDowelN.addEventListener("change", (e) => {
        this.params.dowelN = parseInt(e.target.value, 10);
        this.updateCalculations();
      });
    }

    // Инициализация отображения типа архитектуры
    this.setDriveType(this.params.driveType || "standard", false);

    // Модификации профиля под 3D-печать (Tip & Root Relief)
    if (this.relief && this.relief.chkUseRelief) {
      this.relief.chkUseRelief.addEventListener("change", (e) => {
        this.params.useRelief = e.target.checked;
        if (this.relief.controlsBox) {
          this.relief.controlsBox.style.display = e.target.checked ? "block" : "none";
        }
        this.updateCalculations();
      });
    }

    bindControl(this.relief.tipRelief, "tipRelief", true);
    bindControl(this.relief.rootRelief, "rootRelief", true);

    if (this.relief && this.relief.selTipMode) {
      this.relief.selTipMode.addEventListener("change", (e) => {
        this.params.tipReliefMode = e.target.value;
        this.updateCalculations();
      });
    }

    // Контроль кривизны под сопло 3D-принтера / фрезу ЧПУ
    if (this.curvatureElements) {
      const toolPresets = CurvatureInspector.getPresets();

      if (this.curvatureElements.selToolType) {
        this.curvatureElements.selToolType.addEventListener("change", (e) => {
          const val = e.target.value;
          this.params.toolType = val;
          if (val === "custom") {
            if (this.curvatureElements.rowCustomTool) this.curvatureElements.rowCustomTool.style.display = "block";
          } else {
            if (this.curvatureElements.rowCustomTool) this.curvatureElements.rowCustomTool.style.display = "none";
            const p = toolPresets[val];
            if (p) {
              this.params.toolDiameter = p.d;
              if (this.curvatureElements.inpToolD && this.curvatureElements.inpToolD.range) {
                this.curvatureElements.inpToolD.range.value = p.d;
                this.curvatureElements.inpToolD.num.value = p.d;
                this.curvatureElements.inpToolD.val.textContent = p.d.toFixed(2);
              }
            }
          }
          this.updateCalculations();
        });
      }

      bindControl(this.curvatureElements.inpToolD, "toolDiameter", true, () => {
        this.params.toolType = "custom";
        if (this.curvatureElements.selToolType) this.curvatureElements.selToolType.value = "custom";
      });

      // Синхронизация чекбокса на вкладке анализа с верхним тулбаром
      if (this.curvatureElements.chkAnalysisCurvature) {
        this.curvatureElements.chkAnalysisCurvature.addEventListener("change", (e) => {
          const checked = e.target.checked;
          this.renderer.layers.curvature = checked;
          if (this.chkLayers.curvature) this.chkLayers.curvature.checked = checked;
          if (this.chips.curvature) {
            this.chips.curvature.classList.toggle("active", checked);
          }
          this.render();
        });
      }

      // Синхронизация при переключении верхнего чипа
      if (this.chkLayers.curvature) {
        this.chkLayers.curvature.addEventListener("change", (e) => {
          if (this.curvatureElements.chkAnalysisCurvature) {
            this.curvatureElements.chkAnalysisCurvature.checked = e.target.checked;
          }
        });
      }
    }

    // Силовой и прочностной расчёт (Sensinger Stress & Load Sharing)
    if (this.stressElements) {
      const motorPresets = StressCalculator.getMotorPresets();

      if (this.stressElements.selMotorPreset) {
        this.stressElements.selMotorPreset.addEventListener("change", (e) => {
          const val = e.target.value;
          this.params.motorTorquePreset = val;
          const p = motorPresets[val];
          if (p) {
            this.params.motorTorque = p.torque;
            this.params.motorRpm = p.rpm;
            if (this.stressElements.motorTorque && this.stressElements.motorTorque.range) {
              this.stressElements.motorTorque.range.value = p.torque;
              this.stressElements.motorTorque.num.value = p.torque;
              this.stressElements.motorTorque.val.textContent = p.torque.toFixed(2);
            }
          }
          this.updateCalculations();
        });
      }

      bindControl(this.stressElements.motorTorque, "motorTorque", true, () => {
        this.params.motorTorquePreset = "custom";
        if (this.stressElements.selMotorPreset) this.stressElements.selMotorPreset.value = "custom";
      });

      bindControl(this.stressElements.discThickness, "discThickness", true);

      if (this.stressElements.selMaterial) {
        this.stressElements.selMaterial.addEventListener("change", (e) => {
          this.params.discMaterial = e.target.value;
          this.updateCalculations();
        });
      }
    }

    // Пресеты (встроенные и пользовательские)
    if (this.presetSelect) {
      this.presetSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val.startsWith("custom:")) {
          const key = val.replace("custom:", "");
          if (this.customPresets[key]) {
            this.loadProjectParams(this.customPresets[key], key);
          }
        } else {
          this.applyPreset(val);
        }
      });
    }

    // Сохранение кастомного пресета
    const btnSavePreset = document.getElementById("btn-save-custom-preset");
    if (btnSavePreset) {
      btnSavePreset.addEventListener("click", () => {
        if (this.inpCustomPresetName) {
          this.inpCustomPresetName.value = `Мой Z${this.params.Z1} (${this.params.Z1}:1)`;
        }
        if (this.modalSavePreset) {
          this.modalSavePreset.style.display = "flex";
          setTimeout(() => this.inpCustomPresetName?.focus(), 50);
        }
      });
    }

    document.getElementById("btn-close-save-preset-modal")?.addEventListener("click", () => {
      if (this.modalSavePreset) this.modalSavePreset.style.display = "none";
    });
    document.getElementById("btn-cancel-save-preset")?.addEventListener("click", () => {
      if (this.modalSavePreset) this.modalSavePreset.style.display = "none";
    });
    document.getElementById("btn-confirm-save-preset")?.addEventListener("click", () => {
      const name = this.inpCustomPresetName?.value?.trim();
      if (name) {
        this.saveCustomPreset(name);
        if (this.modalSavePreset) this.modalSavePreset.style.display = "none";
      }
    });

    // Экспорт / Импорт JSON проектов
    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      this.exportProjectJson();
    });

    document.getElementById("btn-import-json")?.addEventListener("click", () => {
      this.fileInputJson?.click();
    });

    this.fileInputJson?.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.importProjectJson(e.target.files[0]);
        e.target.value = ""; // Сброс для повторного выбора
      }
    });

    // Drag and Drop файлов JSON на окно браузера
    window.addEventListener("dragenter", (e) => {
      if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
        if (this.dragDropOverlay) this.dragDropOverlay.style.display = "flex";
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    this.dragDropOverlay?.addEventListener("dragleave", (e) => {
      if (e.target === this.dragDropOverlay) {
        this.dragDropOverlay.style.display = "none";
      }
    });

    window.addEventListener("drop", (e) => {
      e.preventDefault();
      if (this.dragDropOverlay) this.dragDropOverlay.style.display = "none";
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith(".json")) {
          this.importProjectJson(file);
        } else {
          this.showToast("Пожалуйста, перетащите файл с расширением .json", "error");
        }
      }
    });

    // Слои
    Object.keys(this.chkLayers).forEach(key => {
      if (!this.chkLayers[key]) return;
      this.chkLayers[key].addEventListener("change", (e) => {
        this.renderer.layers[key] = e.target.checked;
        if (e.target.checked) {
          this.chips[key].classList.add("active");
        } else {
          this.chips[key].classList.remove("active");
        }
        if (key === "cam2") {
          this.params.dualDisc = e.target.checked;
          if (this.inputs.dualDisc) this.inputs.dualDisc.checked = e.target.checked;
          const dxfDisc2 = document.getElementById("dxf-inc-disc2");
          if (dxfDisc2) dxfDisc2.checked = e.target.checked;
          this.updateCalculations();
          return;
        }
        this.render();
      });
    });

    // Видовой экран
    document.getElementById("btn-reset-view").addEventListener("click", () => this.renderer.resetView());
    document.getElementById("btn-zoom-in").addEventListener("click", () => this.renderer.zoom(1.2));
    document.getElementById("btn-zoom-out").addEventListener("click", () => this.renderer.zoom(0.8));
    this.renderer.onViewChange = () => {
      document.getElementById("zoom-text").textContent = `${Math.round((this.renderer.scale / 7.0) * 100)}%`;
      this.render();
    };

    // Симуляция: Пуск / Пауза
    this.simElements.btnPlayPause.addEventListener("click", () => {
      this.sim.isPlaying = !this.sim.isPlaying;
      if (this.sim.isPlaying) {
        this.simElements.btnPlayPause.classList.add("playing");
        this.simElements.iconPlay.style.display = "none";
        this.simElements.iconPause.style.display = "block";
        this.simElements.playPauseText.textContent = "Пауза";
      } else {
        this.simElements.btnPlayPause.classList.remove("playing");
        this.simElements.iconPlay.style.display = "block";
        this.simElements.iconPause.style.display = "none";
        this.simElements.playPauseText.textContent = "Старт симуляции";
      }
    });

    // Симуляция: Шаг вперед +5°
    this.simElements.btnStepFwd.addEventListener("click", () => {
      this.sim.crankAngle = (this.sim.crankAngle + 5) % 360;
      this.updateSimDisplay();
      this.render();
    });

    // Симуляция: Сброс угла в 0°
    this.simElements.btnResetAngle.addEventListener("click", () => {
      this.sim.crankAngle = 0;
      this.updateSimDisplay();
      this.render();
    });

    // Ползунок угла поворота
    this.simElements.inpCrankAngle.addEventListener("input", (e) => {
      this.sim.crankAngle = parseFloat(e.target.value);
      this.updateSimDisplay();
      this.render();
    });

    // Скорость вращения
    this.simElements.inpSpeed.addEventListener("input", (e) => {
      this.sim.speed = parseFloat(e.target.value);
      this.simElements.speedText.textContent = `${this.sim.speed.toFixed(1)}x`;
    });

    // Экспорт DXF
    document.getElementById("btn-export-dxf").addEventListener("click", () => {
      const dxfDisc2 = document.getElementById("dxf-inc-disc2");
      if (dxfDisc2) {
        dxfDisc2.checked = !!this.params.dualDisc;
      }
      this.modalDxf.style.display = "flex";
    });
    document.getElementById("btn-close-dxf-modal").addEventListener("click", () => {
      this.modalDxf.style.display = "none";
    });
    document.getElementById("btn-cancel-dxf").addEventListener("click", () => {
      this.modalDxf.style.display = "none";
    });
    document.getElementById("btn-confirm-dxf-download").addEventListener("click", () => {
      this.exportDxf();
      this.modalDxf.style.display = "none";
    });

    // Переключение карточек режима в модальном окне DXF
    const modeRadios = document.querySelectorAll('input[name="dxf-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener("change", () => {
        document.querySelectorAll(".mode-card").forEach(c => c.classList.remove("active"));
        radio.closest(".mode-card")?.classList.add("active");
        
        const optionsBox = document.getElementById("assembly-layers-options");
        if (optionsBox) {
          optionsBox.style.opacity = radio.value === "disc_only" ? "0.45" : "1.0";
        }
      });
    });

    // Переключение карточек формата кривой (Bi-Arc / Сплайн / Полилиния)
    const curveRadios = document.querySelectorAll('input[name="dxf-curve-type"]');
    curveRadios.forEach(radio => {
      radio.addEventListener("change", () => {
        document.querySelectorAll(".curve-card").forEach(c => c.classList.remove("active"));
        radio.closest(".curve-card")?.classList.add("active");

        const tolRow = document.getElementById("biarc-tolerance-row");
        if (tolRow) {
          tolRow.style.opacity = radio.value === "biarc" ? "1.0" : "0.35";
          tolRow.style.pointerEvents = radio.value === "biarc" ? "auto" : "none";
        }
      });
    });

    // Экспорт SVG
    document.getElementById("btn-export-svg").addEventListener("click", () => {
      this.exportSvg();
    });
  }

  setDriveType(type, triggerUpdate = true) {
    this.params.driveType = type;
    const isCompound = (type === "compound");

    if (this.archButtons.standard) {
      this.archButtons.standard.classList.toggle("active", !isCompound);
    }
    if (this.archButtons.compound) {
      this.archButtons.compound.classList.toggle("active", isCompound);
    }

    if (this.carrierStandardContainer) {
      this.carrierStandardContainer.style.display = isCompound ? "none" : "block";
    }
    if (this.carrierCompoundContainer) {
      this.carrierCompoundContainer.style.display = isCompound ? "block" : "none";
    }

    if (this.tabBtnCarrier) {
      this.tabBtnCarrier.textContent = isCompound ? "Венец 2 (Compound)" : "Выходной вал";
    }

    // Переключение видимости чипов слоёв
    if (this.chips.carrier) {
      this.chips.carrier.style.display = isCompound ? "none" : "inline-flex";
    }
    if (this.chips.outputRing) {
      this.chips.outputRing.style.display = isCompound ? "inline-flex" : "none";
    }
    if (this.chips.dowels) {
      this.chips.dowels.style.display = isCompound ? "inline-flex" : "none";
    }

    if (triggerUpdate) {
      this.updateCalculations();
    }
  }

  syncZout() {
    if (this.params.ZoutMode === "plus_1") {
      this.params.Zout = this.params.Z2 + 1;
    } else if (this.params.ZoutMode === "minus_1") {
      this.params.Zout = Math.max(2, this.params.Z2 - 1);
    }
    if (this.compoundInputs.valZout) {
      this.compoundInputs.valZout.textContent = this.params.Zout;
    }
    if (this.compoundInputs.zout && this.compoundInputs.zout.range) {
      this.compoundInputs.zout.range.value = this.params.Zout;
      this.compoundInputs.zout.num.value = this.params.Zout;
    }
  }

  applyPreset(presetKey) {
    const p = this.presets[presetKey];
    if (!p) return;

    Object.assign(this.params, p);

    this.inputs.solver.value = this.params.solver;
    const setCtrl = (ctrl, val, isFloat = true) => {
      if (!ctrl || !ctrl.range) return;
      ctrl.range.value = val;
      ctrl.num.value = val;
      if (ctrl.val) ctrl.val.textContent = isFloat ? val.toFixed(2) : val;
    };

    setCtrl(this.inputs.z1, this.params.Z1, false);
    setCtrl(this.inputs.r, this.params.R, true);
    setCtrl(this.inputs.rr, this.params.Rr, true);
    setCtrl(this.inputs.e, this.params.E, true);
    setCtrl(this.inputs.clearance, this.params.clearance, true);
    setCtrl(this.inputs.camBore, this.params.camBore, true);

    if (p.bearingPreset) this.inputs.bearingPreset.value = p.bearingPreset;
    setCtrl(this.inputs.bearingId, this.params.bearingId, true);
    setCtrl(this.inputs.bearingOd, this.params.bearingOd, true);
    setCtrl(this.inputs.shaftD, this.params.shaftD, true);
    this.inputs.chkDcut.checked = this.params.hasDcut;

    setCtrl(this.inputs.carrierN, this.params.carrierN, false);
    setCtrl(this.inputs.carrierR, this.params.carrierR, true);
    setCtrl(this.inputs.carrierPinD, this.params.carrierPinD, true);

    // Compound параметры
    if (this.compoundInputs) {
      if (p.Z2 !== undefined) setCtrl(this.compoundInputs.z2, this.params.Z2, false);
      if (p.R2 !== undefined) setCtrl(this.compoundInputs.r2, this.params.R2, true);
      if (p.Rr2 !== undefined) setCtrl(this.compoundInputs.rr2, this.params.Rr2, true);
      if (p.clearance2 !== undefined) setCtrl(this.compoundInputs.clearance2, this.params.clearance2, true);
      if (p.dowelD !== undefined) setCtrl(this.compoundInputs.dowelD, this.params.dowelD, true);
      if (p.dowelR !== undefined) setCtrl(this.compoundInputs.dowelR, this.params.dowelR, true);
      if (this.compoundInputs.selDowelN && p.dowelN !== undefined) {
        this.compoundInputs.selDowelN.value = p.dowelN;
      }
      if (this.compoundInputs.chkCompoundDowels && p.useDowelPins !== undefined) {
        this.compoundInputs.chkCompoundDowels.checked = !!p.useDowelPins;
        if (this.compoundInputs.compoundDowelsControls) {
          this.compoundInputs.compoundDowelsControls.style.display = p.useDowelPins ? "block" : "none";
        }
      }
      if (this.compoundInputs.selZoutMode && p.ZoutMode) {
        this.compoundInputs.selZoutMode.value = p.ZoutMode;
        if (this.compoundInputs.rowCustomZout) {
          this.compoundInputs.rowCustomZout.style.display = p.ZoutMode === "custom" ? "block" : "none";
        }
      }
      this.syncZout();
    }

    if (p.driveType) {
      this.setDriveType(p.driveType, false);
    } else {
      this.setDriveType("standard", false);
    }

    if (this.relief) {
      if (this.relief.chkUseRelief) {
        this.relief.chkUseRelief.checked = !!this.params.useRelief;
        if (this.relief.controlsBox) {
          this.relief.controlsBox.style.display = this.params.useRelief ? "block" : "none";
        }
      }
      setCtrl(this.relief.tipRelief, this.params.tipRelief ?? 0.20, true);
      setCtrl(this.relief.rootRelief, this.params.rootRelief ?? 0.10, true);
      if (this.relief.selTipMode && this.params.tipReliefMode) {
        this.relief.selTipMode.value = this.params.tipReliefMode;
      }
    }

    this.updateCalculations();
  }

  updateCalculations() {
    // Выбор решателя
    let solverClass = SensingerSolver;
    if (this.params.solver === "zincland") solverClass = ZinclandSolver;
    else if (this.params.solver === "epitrochoid") solverClass = EpitrochoidSolver;

    this.currentSolution = solverClass.solve({
      R: this.params.R,
      Rr: this.params.Rr,
      Z1: this.params.Z1,
      E: this.params.E,
      clearance: this.params.clearance,
      camBore: this.params.camBore,
      steps: this.params.steps
    });

    // Применение модификаций профиля (Tip Relief & Root Relief под 3D-печать)
    const reliefRes = ProfileRelief.apply(this.currentSolution.points, {
      enabled: this.params.useRelief,
      tipRelief: this.params.tipRelief,
      rootRelief: this.params.rootRelief,
      tipMode: this.params.tipReliefMode
    });
    this.currentSolution.points = reliefRes.points;
    this.currentSolution.outerRadius = reliefRes.stats.rMaxRelieved;
    this.currentSolution.rootRadius = reliefRes.stats.rMinRelieved;
    this.currentSolution.reliefStats = reliefRes.stats;

    if (this.relief && this.relief.valToothHeight && this.relief.valRmaxRelieved) {
      this.relief.valToothHeight.textContent = `${reliefRes.stats.toothHeight.toFixed(2)} мм`;
      this.relief.valRmaxRelieved.textContent = `${reliefRes.stats.rMaxRelieved.toFixed(2)} мм`;
    }

    // Расчёт и контроль радиуса кривизны под сопло 3D-принтера / фрезу ЧПУ
    const curvature = CurvatureInspector.analyze(this.currentSolution.points, this.params.toolDiameter);
    this.currentSolution.curvatureAnalysis = curvature;

    if (this.curvatureElements) {
      const ce = this.curvatureElements;
      if (ce.statusCard) {
        ce.statusCard.className = `status-card status-${curvature.status === 'ok' ? 'ok' : 'warning'}`;
        if (ce.statusTitle) ce.statusTitle.textContent = curvature.title;
        if (ce.statusDesc) ce.statusDesc.textContent = curvature.desc;
      }
      if (ce.mRhoConcave) ce.mRhoConcave.textContent = `${curvature.minRhoConcave.toFixed(2)} мм`;
      if (ce.mToolRadius) ce.mToolRadius.textContent = `${curvature.toolRadius.toFixed(2)} мм`;
      if (ce.mToolMax) ce.mToolMax.textContent = `Ø ${curvature.maxSafeToolDiameter.toFixed(2)} мм`;
      if (ce.mRhoConvex) ce.mRhoConvex.textContent = `${curvature.minRhoConvex.toFixed(2)} мм`;
      if (ce.mToolSafety) {
        ce.mToolSafety.textContent = `${curvature.safetyFactor.toFixed(1)}x`;
        ce.mToolSafety.style.color = curvature.safetyFactor < 1.0 ? "var(--accent-red)" : (curvature.safetyFactor < 1.3 ? "#f59e0b" : "#22c55e");
      }
      if (ce.recNozzleBadge) ce.recNozzleBadge.textContent = curvature.recommendations.nozzle;
      if (ce.recEndmillBadge) ce.recEndmillBadge.textContent = curvature.recommendations.endmill;
    }

    // Силовой и прочностной расчёт (Sensinger Stress & Load Sharing)
    const rho_c = curvature ? curvature.minRhoConcave : 4.25;
    const stress = StressCalculator.calculate({
      motorTorque: this.params.motorTorque,
      motorRpm: this.params.motorRpm,
      efficiency: 0.90,
      discThickness: this.params.discThickness,
      materialKey: this.params.discMaterial,
      Z1: this.params.Z1,
      R: this.params.R,
      Rr: this.params.Rr,
      E: this.params.E,
      clearance: this.params.clearance,
      dualDisc: this.params.dualDisc,
      carrierN: this.params.carrierN,
      carrierR: this.params.carrierR,
      carrierPinD: this.params.usePinBearings ? this.params.pinBearingId : this.params.carrierPinD,
      rho_c
    });
    this.currentSolution.stressAnalysis = stress;

    if (this.stressElements) {
      const se = this.stressElements;
      if (se.statusCard) {
        se.statusCard.className = `status-card status-${stress.stressStatus === 'ok' ? 'ok' : 'warning'}`;
        if (se.statusTitle) se.statusTitle.textContent = stress.statusTitle;
        if (se.statusDesc) se.statusDesc.textContent = stress.statusDesc;
      }
      if (se.mTout) se.mTout.textContent = `${stress.outputTorque.toFixed(2)} Н·м`;
      if (se.mFmaxRoller) se.mFmaxRoller.textContent = `${stress.FmaxRoller.toFixed(1)} Н`;
      if (se.mActiveRollers) se.mActiveRollers.textContent = stress.activeRollersCount;
      if (se.mSigmaHertz) se.mSigmaHertz.textContent = `${stress.sigmaHertz.toFixed(1)} МПа`;
      if (se.mMatLimit) se.mMatLimit.textContent = `${stress.allowableStress.toFixed(1)} МПа`;
      if (se.mStressSf) {
        se.mStressSf.textContent = `${stress.safetyFactor.toFixed(2)}x`;
        se.mStressSf.style.color = stress.safetyFactor < 1.0 ? "var(--accent-red)" : (stress.safetyFactor < 1.5 ? "#f59e0b" : "#22c55e");
      }
      if (se.mFpin) se.mFpin.textContent = `${stress.Fpin.toFixed(1)} Н`;
      if (se.mPinBend) se.mPinBend.textContent = `${stress.pinBendingStress.toFixed(1)} МПа`;
      if (se.mBacklash) se.mBacklash.textContent = `${stress.backlashArcmin.toFixed(1)}'`;
      if (se.mBacklashDeg) se.mBacklashDeg.textContent = `${stress.backlashDeg.toFixed(2)}°`;
      if (se.mBacklashClearance) se.mBacklashClearance.textContent = `${this.params.clearance.toFixed(2)} мм`;
    }

    // Если активен двухвенцовый режим Compound Cycloid
    if (this.params.driveType === "compound") {
      this.compoundSolution = CompoundCycloidSolver.solve({
        solver: this.params.solver,
        Z1: this.params.Z1,
        Zs1: this.params.Z1 + 1,
        R1: this.params.R,
        Rr1: this.params.Rr,
        clearance1: this.params.clearance,
        Z2: this.params.Z2,
        Zout: this.params.Zout,
        R2: this.params.R2,
        Rr2: this.params.Rr2,
        clearance2: this.params.clearance2,
        E: this.params.E,
        camBore: this.params.camBore,
        useDowelPins: this.params.useDowelPins,
        dowelD: this.params.dowelD,
        dowelR: this.params.dowelR,
        dowelN: this.params.dowelN,
        steps: this.params.steps
      });

      // Применяем Relief к Stage 1 в Compound
      if (this.params.useRelief && this.compoundSolution.stage1) {
        const relief1 = ProfileRelief.apply(this.compoundSolution.stage1.points, {
          enabled: this.params.useRelief,
          tipRelief: this.params.tipRelief,
          rootRelief: this.params.rootRelief,
          tipMode: this.params.tipReliefMode
        });
        this.compoundSolution.stage1.points = relief1.points;
      }

      // Применяем Relief к Stage 2 в Compound
      if (this.params.useRelief && this.compoundSolution.stage2) {
        const relief2 = ProfileRelief.apply(this.compoundSolution.stage2.points, {
          enabled: this.params.useRelief,
          tipRelief: this.params.tipRelief,
          rootRelief: this.params.rootRelief,
          tipMode: this.params.tipReliefMode
        });
        this.compoundSolution.stage2.points = relief2.points;
      }

      // Обновляем показатели передаточного отношения
      const k = this.compoundSolution.kinematics;
      const iRatio = k.ratio;
      const ratioStr = Number.isFinite(iRatio) ? (iRatio > 0 ? `+${iRatio.toFixed(1)}:1` : `${iRatio.toFixed(1)}:1`) : "∞";

      if (this.metrics.badgeRatio) this.metrics.badgeRatio.textContent = `i = ${ratioStr}`;
      if (this.badgeArchRatio) this.badgeArchRatio.textContent = ratioStr;
      if (this.metrics.infoRatioDisplay) this.metrics.infoRatioDisplay.textContent = ratioStr;

      if (this.compoundInputs.valRatio) {
        this.compoundInputs.valRatio.textContent = Number.isFinite(iRatio) ? `${Math.abs(iRatio).toFixed(1)}:1` : "∞ (синхронно)";
      }
      if (this.compoundInputs.valDir) {
        if (!Number.isFinite(iRatio)) {
          this.compoundInputs.valDir.textContent = "Заклинено (0 об/мин)";
        } else if (iRatio > 0) {
          this.compoundInputs.valDir.textContent = "Совпадает с мотором (+)";
        } else {
          this.compoundInputs.valDir.textContent = "Противоположно (Реверс -)";
        }
      }
      if (this.compoundInputs.valFormula) {
        this.compoundInputs.valFormula.textContent = k.formulaStr;
      }
      if (this.compoundInputs.hintDr2) {
        this.compoundInputs.hintDr2.textContent = (this.params.Rr2 * 2).toFixed(1);
      }

      // Диагностика стенок Compound
      const cd = this.compoundSolution.diagnostics;
      if (this.compoundInputs.mWall1) this.compoundInputs.mWall1.textContent = `${cd.tWall1.toFixed(1)} мм`;
      if (this.compoundInputs.mWall2) this.compoundInputs.mWall2.textContent = `${cd.tWall2.toFixed(1)} мм`;
      if (this.compoundInputs.mDowelMargin) {
        this.compoundInputs.mDowelMargin.textContent = `${cd.dowelInnerMargin.toFixed(1)} мм`;
      }

      if (this.compoundInputs.diagCard) {
        if (cd.wallStatus === "error" || cd.dowelStatus === "error" || cd.hasUndercutting) {
          this.compoundInputs.diagCard.className = "status-card status-warning";
          if (this.compoundInputs.diagTitle) this.compoundInputs.diagTitle.textContent = "Внимание: геометрия требует проверки";
          if (this.compoundInputs.diagDesc) this.compoundInputs.diagDesc.textContent = cd.dowelDesc || cd.statusDesc;
        } else {
          this.compoundInputs.diagCard.className = "status-card status-ok";
          if (this.compoundInputs.diagTitle) this.compoundInputs.diagTitle.textContent = "Стенки диска: Надёжно";
          if (this.compoundInputs.diagDesc) this.compoundInputs.diagDesc.textContent = cd.dowelDesc || "Штифты и подшипник размещены безопасно для 3D-печати.";
        }
      }

      // Диагностика эксцентрика (общая для обоих режимов)
      const tMin = (this.params.bearingId - this.params.shaftD) / 2 - this.params.E;
      if (this.eccentricCard && this.eccentricCard.title) {
        this.eccentricCard.title.textContent = `Толщина стенки: ${tMin.toFixed(2)} мм`;
        if (tMin < 0.5) {
          this.eccentricCard.card.className = "status-card status-warning";
          this.eccentricCard.desc.textContent = `Опасно! Стенка слишком тонка (${tMin.toFixed(2)} мм) или прорезана. Эксцентрик лопнет! Выберите подшипник 6802 или 6803.`;
        } else if (tMin < 1.5) {
          this.eccentricCard.card.className = "status-card status-warning";
          this.eccentricCard.desc.textContent = `Предупреждение: стенка ${tMin.toFixed(2)} мм тонковата для пластика. Печатайте со 100% заполнением или увеличьте подшипник.`;
        } else {
          this.eccentricCard.card.className = "status-card status-ok";
          this.eccentricCard.desc.textContent = `Надёжно для 3D-печати (t_min ≥ 1.5 мм). Обеспечит прочную посадку и выдержит крутящий момент.`;
        }
      }

      this.updateSimDisplay();
      this.render();
      return;
    }

    // Обновление диагностических показателей профиля
    const diag = this.currentSolution.diagnostics;
    this.metrics.badgeRatio.textContent = `i = ${this.params.Z1}:1`;
    this.metrics.hintZ2.textContent = this.params.Z1 + 1;
    this.metrics.hintDr.textContent = (this.params.Rr * 2).toFixed(1);
    this.metrics.infoRatioDisplay.textContent = `-${this.params.Z1}`;

    // Расчёт эффективного размера ролика и отверстия
    const dRoller = this.params.usePinBearings ? this.params.pinBearingOd : this.params.carrierPinD;
    const dPin = this.params.usePinBearings ? this.params.pinBearingId : this.params.carrierPinD;
    const holeDiameter = dRoller + 2 * this.params.E;

    if (this.params.usePinBearings) {
      this.metrics.infoHoleCalc.textContent = `D_отв = ${holeDiameter.toFixed(2)} мм (подшипник Ø${dRoller.toFixed(1)} мм, палец Ø${dPin.toFixed(1)} мм)`;
      if (this.inputs.infoHoleFormula) {
        this.inputs.infoHoleFormula.innerHTML = `D<sub>отв</sub> = D<sub>подшипника</sub> (${dRoller.toFixed(1)}) + 2 · e (${(2 * this.params.E).toFixed(2)}) = <strong>${holeDiameter.toFixed(2)} мм</strong>`;
      }
    } else {
      this.metrics.infoHoleCalc.textContent = `D_отв = ${holeDiameter.toFixed(2)} мм (палец скольжения Ø${dPin.toFixed(1)} мм)`;
      if (this.inputs.infoHoleFormula) {
        this.inputs.infoHoleFormula.innerHTML = `D<sub>отв</sub> = D<sub>пальца</sub> (${dPin.toFixed(1)}) + 2 · e (${(2 * this.params.E).toFixed(2)}) = <strong>${holeDiameter.toFixed(2)} мм</strong>`;
      }
    }

    this.metrics.mK1.textContent = diag.k1.toFixed(3);
    this.metrics.mEmax.textContent = `${diag.Emax.toFixed(2)} мм`;
    this.metrics.mEcurr.textContent = `${this.params.E.toFixed(2)} мм`;
    this.metrics.mRmin.textContent = `${diag.Rmin.toFixed(1)} мм`;
    this.metrics.mRcurr.textContent = `${this.params.R.toFixed(1)} мм`;
    this.metrics.mRrmax.textContent = `${diag.Rrmax.toFixed(2)} мм`;
    this.metrics.mRrcurr.textContent = `${this.params.Rr.toFixed(2)} мм`;

    if (diag.hasUndercutting) {
      this.metrics.statusCard.className = "status-card status-warning";
      this.metrics.statusText.textContent = diag.statusText;
      this.metrics.statusDesc.textContent = diag.statusDesc;
    } else {
      this.metrics.statusCard.className = "status-card status-ok";
      this.metrics.statusText.textContent = diag.statusText;
      this.metrics.statusDesc.textContent = diag.statusDesc;
    }

    // Расчёт и диагностика прочности печатного эксцентрика
    // t_min = (d_внутр - D_вала) / 2 - e
    const tMin = (this.params.bearingId - this.params.shaftD) / 2 - this.params.E;
    this.eccentricCard.title.textContent = `Толщина стенки: ${tMin.toFixed(2)} мм`;

    if (tMin < 0.5) {
      this.eccentricCard.card.className = "status-card status-warning";
      this.eccentricCard.desc.textContent = `Опасно! Стенка слишком тонка (${tMin.toFixed(2)} мм) или прорезана. Эксцентрик лопнет! Выберите подшипник 6802 или 6803.`;
    } else if (tMin < 1.5) {
      this.eccentricCard.card.className = "status-card status-warning";
      this.eccentricCard.desc.textContent = `Предупреждение: стенка ${tMin.toFixed(2)} мм тонковата для пластика. Печатайте со 100% заполнением или увеличьте подшипник.`;
    } else {
      this.eccentricCard.card.className = "status-card status-ok";
      this.eccentricCard.desc.textContent = `Надёжно для 3D-печати (t_min ≥ 1.5 мм). Обеспечит прочную посадку и выдержит крутящий момент.`;
    }

    // Расчёт и диагностика толщины стенок диска вокруг отверстий под пальцы
    const rBore = this.params.camBore / 2;
    const rHole = holeDiameter / 2;
    const rCarrier = this.params.carrierR;
    const nCarrier = this.params.carrierN;

    // 1. Стенка к центральному отверстию подшипника (t_inner)
    const tInner = (rCarrier - rHole) - rBore;

    // 2. Стенка к зубьям / впадинам циклоидного диска (t_outer)
    let tOuter = Infinity;
    if (this.currentSolution && this.currentSolution.points && this.currentSolution.points.length > 0) {
      const pts = this.currentSolution.points;
      for (let i = 0; i < nCarrier; i++) {
        const a = (2 * Math.PI * i) / nCarrier;
        const hx = rCarrier * Math.cos(a);
        const hy = rCarrier * Math.sin(a);
        for (let j = 0; j < pts.length; j += 4) {
          const d = Math.hypot(pts[j].x - hx, pts[j].y - hy) - rHole;
          if (d < tOuter) tOuter = d;
        }
      }
    } else {
      tOuter = (this.params.R - this.params.Rr - this.params.E) - (rCarrier + rHole);
    }

    // 3. Перемычка между соседними отверстиями пальцев (t_inter)
    const distCenters = 2 * rCarrier * Math.sin(Math.PI / nCarrier);
    const tInter = distCenters - 2 * rHole;

    // 4. Обратный расчёт максимально допустимого подшипника для безопасных стенок (t >= 1.8 мм)
    const tSafe = 1.8;
    const maxHoleInner = 2 * (rCarrier - rBore - tSafe);
    const rootRadius = this.currentSolution.rootRadius || (this.params.R - this.params.Rr - this.params.E);
    const maxHoleOuter = 2 * (rootRadius - rCarrier - tSafe);
    const maxAllowableHole = Math.min(maxHoleInner, maxHoleOuter);
    const maxBearingOd = Math.max(0, maxAllowableHole - 2 * this.params.E);

    if (this.inputs.infoMaxBearingHint) {
      if (maxBearingOd <= 3.0) {
        this.inputs.infoMaxBearingHint.innerHTML = `<span style="color:var(--accent-red)">Текущий R_пальцев (${rCarrier.toFixed(1)} мм) слишком тесен для подшипников! Сместите R_пальцев ближе к середине (~${((rBore + rootRadius) / 2).toFixed(1)} мм).</span>`;
      } else {
        const isExceeded = this.params.usePinBearings && (this.params.pinBearingOd > maxBearingOd);
        const col = isExceeded ? "var(--accent-red)" : "var(--accent-cyan)";
        this.inputs.infoMaxBearingHint.innerHTML = `<span style="color:${col}">Макс. размер подшипника (для стенки ≥ 1.8 мм): <strong>D_внеш ≤ ${maxBearingOd.toFixed(1)} мм</strong> ${isExceeded ? "(текущий больше нормы!)" : "✓"}</span>`;
      }
    }

    this.carrierWallStatus = { tInner, tOuter, tInter };

    // Обновление UI значений
    if (this.carrierWallElements && this.carrierWallElements.mWallInner) {
      this.carrierWallElements.mWallInner.textContent = `${tInner.toFixed(2)} мм`;
      this.carrierWallElements.mWallOuter.textContent = `${tOuter.toFixed(2)} мм`;
      this.carrierWallElements.mWallInter.textContent = `${tInter.toFixed(2)} мм`;

      const minWall = Math.min(tInner, tOuter, tInter);

      if (tInner < 0) {
        this.carrierWallElements.card.className = "status-card status-warning";
        this.carrierWallElements.title.textContent = "Ошибка: отверстия врезаются в подшипник!";
        this.carrierWallElements.desc.textContent = `Отверстия пересекают посадочное кольцо подшипника на ${Math.abs(tInner).toFixed(2)} мм. Увеличьте радиус расположения пальцев R.`;
      } else if (tOuter < 0) {
        this.carrierWallElements.card.className = "status-card status-warning";
        this.carrierWallElements.title.textContent = "Ошибка: отверстия прорезают зубья!";
        this.carrierWallElements.desc.textContent = `Отверстия выходят во впадины зубьев диска на ${Math.abs(tOuter).toFixed(2)} мм. Уменьшите радиус расположения пальцев R или диаметр пальцев.`;
      } else if (tInter < 0) {
        this.carrierWallElements.card.className = "status-card status-warning";
        this.carrierWallElements.title.textContent = "Ошибка: отверстия накладываются друг на друга!";
        this.carrierWallElements.desc.textContent = `Отверстия пересекаются между собой. Уменьшите число пальцев или диаметр пальцев.`;
      } else if (minWall < 1.2) {
        this.carrierWallElements.card.className = "status-card status-warning";
        this.carrierWallElements.title.textContent = `Опасно: критически тонкая стенка (${minWall.toFixed(2)} мм)`;
        this.carrierWallElements.desc.textContent = `Стенка диска слишком тонкая для 3D-печати (< 1.2 мм). При крутящем моменте отверстия выломает.`;
      } else if (minWall < 1.8) {
        this.carrierWallElements.card.className = "status-card status-warning";
        this.carrierWallElements.title.textContent = `Внимание: стенка ${minWall.toFixed(2)} мм`;
        this.carrierWallElements.desc.textContent = `Рекомендуется не менее 1.8–2.0 мм пластика для надёжной передачи крутящего момента.`;
      } else {
        this.carrierWallElements.card.className = "status-card status-ok";
        this.carrierWallElements.title.textContent = `Стенки диска: Надёжно (мин. ${minWall.toFixed(2)} мм)`;
        this.carrierWallElements.desc.textContent = `Отверстия достаточно удалены от подшипника и зубьев. Толщина стенок оптимальна для 3D-печати.`;
      }
    }

    this.render();
  }

  updateSimDisplay() {
    this.simElements.inpCrankAngle.value = this.sim.crankAngle.toFixed(1);
    this.simElements.crankAngleText.textContent = `${this.sim.crankAngle.toFixed(1)}°`;

    if (this.params.driveType === "compound" && this.compoundSolution) {
      const iRatio = this.compoundSolution.kinematics ? this.compoundSolution.kinematics.ratio : this.compoundSolution.ratio;
      const outAngle = Number.isFinite(iRatio) && iRatio !== 0 ? (this.sim.crankAngle / iRatio) : 0;
      this.simElements.outputAngleText.textContent = `${outAngle.toFixed(1)}°`;
    } else {
      // Выходной угол = -crankAngle / Z1
      const outAngle = (-this.sim.crankAngle / this.params.Z1);
      this.simElements.outputAngleText.textContent = `${outAngle.toFixed(1)}°`;
    }
  }

  startAnimationLoop() {
    const loop = (timestamp) => {
      if (this.sim.isPlaying) {
        if (!this.sim.lastTimestamp) this.sim.lastTimestamp = timestamp;
        const dt = (timestamp - this.sim.lastTimestamp) / 1000;
        this.sim.lastTimestamp = timestamp;

        // Вращение эксцентрика: 60 град/сек при 1x
        const dAngle = 60 * this.sim.speed * dt;
        this.sim.crankAngle = (this.sim.crankAngle + dAngle) % 360;

        this.updateSimDisplay();
        this.render();
      } else {
        this.sim.lastTimestamp = timestamp;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render() {
    if (this.params.driveType === "compound" && this.compoundSolution) {
      this.renderer.render({
        isCompound: true,
        compoundSolution: this.compoundSolution,
        eccentric: {
          shaftD: this.params.shaftD,
          hasDcut: this.params.hasDcut,
          dcutFlat: this.params.dcutFlat,
          bearingId: this.params.bearingId,
          bearingOd: this.params.bearingOd
        },
        crankAngleDeg: this.sim.crankAngle,
        curvatureAnalysis: this.compoundSolution.stage1 ? this.compoundSolution.stage1.curvatureAnalysis : null,
        stressAnalysis: null
      });
      return;
    }

    const dRoller = this.params.usePinBearings ? this.params.pinBearingOd : this.params.carrierPinD;
    const dPin = this.params.usePinBearings ? this.params.pinBearingId : this.params.carrierPinD;

    this.renderer.render({
      solution: this.currentSolution,
      carrier: {
        pinCount: this.params.carrierN,
        radius: this.params.carrierR,
        pinDiameter: dPin,
        rollerDiameter: dRoller,
        useBearing: this.params.usePinBearings,
        wallStatus: this.carrierWallStatus
      },
      eccentric: {
        shaftD: this.params.shaftD,
        hasDcut: this.params.hasDcut,
        dcutFlat: this.params.dcutFlat,
        bearingId: this.params.bearingId,
        bearingOd: this.params.bearingOd
      },
      dualDisc: this.params.dualDisc,
      crankAngleDeg: this.sim.crankAngle,
      curvatureAnalysis: this.currentSolution ? this.currentSolution.curvatureAnalysis : null,
      stressAnalysis: this.currentSolution ? this.currentSolution.stressAnalysis : null
    });
  }

  exportEccentricCamDxf() {
    const dxfContent = DxfExporter.generateEccentricOnly({
      shaftD: this.params.shaftD,
      hasDcut: this.params.hasDcut,
      dcutFlat: this.params.dcutFlat,
      bearingId: this.params.bearingId
    }, this.params.E, this.params.dualDisc);

    const filename = `eccentric_cam_shaft${this.params.shaftD}mm_e${this.params.E}mm.dxf`;
    DxfExporter.download(dxfContent, filename);
  }

  exportDxf() {
    if (this.params.driveType === "compound") {
      if (!this.compoundSolution) return;

      const modeRadio = document.querySelector('input[name="dxf-mode"]:checked');
      const exportMode = modeRadio ? modeRadio.value : "assembly";

      const curveRadio = document.querySelector('input[name="dxf-curve-type"]:checked');
      const curveType = curveRadio ? curveRadio.value : "biarc";
      const biarcTolSelect = document.getElementById("dxf-biarc-tol");
      const biarcTolerance = biarcTolSelect ? parseFloat(biarcTolSelect.value) || 0.005 : 0.005;

      const dxfContent = DxfExporter.generateCompound({
        compoundSolution: this.compoundSolution,
        exportMode: (exportMode === "disc_only" ? "compound_both" : exportMode),
        curveType,
        biarcTolerance,
        includeStator1: document.getElementById("dxf-inc-stator")?.checked ?? true,
        includeOutputRing: true,
        includeDisc1: document.getElementById("dxf-inc-disc1")?.checked ?? true,
        includeDisc2: true,
        includeDowels: true,
        includeBore: document.getElementById("dxf-inc-bore")?.checked ?? true
      });

      const iRatio = Math.round(this.compoundSolution.ratio || this.compoundSolution.kinematics?.ratio || 0);
      const prefix = exportMode === "assembly" ? "assembly" : (exportMode === "disc_only" ? "discs" : "layout");
      const filename = `compound_cycloid_${prefix}_i${iRatio}_Z1_${this.params.Z1}_Z2_${this.params.Z2}.dxf`;
      DxfExporter.download(dxfContent, filename);

      const formatLabel = curveType === "biarc"
        ? "дуги Bi-Arc"
        : (curveType === "spline" ? "NURBS сплайн" : "полилиния");
      this.showToast(`Compound DXF успешно сохранён (${formatLabel})`, "success");
      return;
    }

    if (!this.currentSolution) return;

    const modeRadio = document.querySelector('input[name="dxf-mode"]:checked');
    const exportMode = modeRadio ? modeRadio.value : "assembly";

    const curveRadio = document.querySelector('input[name="dxf-curve-type"]:checked');
    const curveType = curveRadio ? curveRadio.value : "biarc";
    const biarcTolSelect = document.getElementById("dxf-biarc-tol");
    const biarcTolerance = biarcTolSelect ? parseFloat(biarcTolSelect.value) || 0.005 : 0.005;

    const includeDisc1 = document.getElementById("dxf-inc-disc1")?.checked ?? true;
    const includeDisc2 = document.getElementById("dxf-inc-disc2")?.checked ?? this.params.dualDisc;
    const includeBore = document.getElementById("dxf-inc-bore")?.checked ?? true;
    const includeCarrierHoles = document.getElementById("dxf-inc-carrier")?.checked ?? true;
    const includeCarrierPins = document.getElementById("dxf-inc-carrier-pins")?.checked ?? true;
    const includeEccentric = document.getElementById("dxf-inc-eccentric")?.checked ?? true;
    const includeStator = document.getElementById("dxf-inc-stator")?.checked ?? true;

    const dRoller = this.params.usePinBearings ? this.params.pinBearingOd : this.params.carrierPinD;
    const holeRadius = (dRoller + 2 * this.params.E) / 2;
    const carrierPinRadius = (this.params.usePinBearings ? this.params.pinBearingOd : this.params.carrierPinD) / 2;

    const carrierHoles = [];
    if (includeCarrierHoles) {
      for (let i = 0; i < this.params.carrierN; i++) {
        const a = (2 * Math.PI * i) / this.params.carrierN;
        carrierHoles.push({
          x: this.params.carrierR * Math.cos(a),
          y: this.params.carrierR * Math.sin(a),
          radius: holeRadius
        });
      }
    }

    const dxfContent = DxfExporter.generate({
      discPoints: this.currentSolution.points,
      camBoreRadius: this.params.camBore / 2,
      carrierHoles,
      statorRollers: this.currentSolution.rollers,
      eccentric: {
        shaftD: this.params.shaftD,
        hasDcut: this.params.hasDcut,
        dcutFlat: this.params.dcutFlat,
        bearingId: this.params.bearingId,
        bearingOd: this.params.bearingOd
      },
      E: this.params.E,
      Z1: this.params.Z1,
      dualDisc: this.params.dualDisc,
      exportMode,
      curveType,
      biarcTolerance,
      includeDisc1,
      includeDisc2,
      includeBore,
      includeCarrierHoles,
      includeCarrierPins,
      carrierPinRadius,
      carrierR: this.params.carrierR,
      carrierN: this.params.carrierN,
      includeStator,
      includeEccentric,
      R: this.params.R
    });

    const prefix = exportMode === "assembly" ? "assembly" : (exportMode === "disc_only" ? "disc" : "layout");
    const filename = `cycloid_${prefix}_Z${this.params.Z1}_e${this.params.E}mm.dxf`;
    DxfExporter.download(dxfContent, filename);

    const formatLabel = curveType === "biarc"
      ? "дуги Bi-Arc"
      : (curveType === "spline" ? "NURBS сплайн" : "полилиния");
    this.showToast(`DXF успешно сохранён (${formatLabel})`, "success");
  }

  exportSvg() {
    if (this.params.driveType === "compound") {
      if (!this.compoundSolution) return;

      const svgContent = SvgExporter.generateCompound({
        compoundSolution: this.compoundSolution,
        exportMode: "assembly"
      });

      const iRatio = Math.round(this.compoundSolution.ratio || this.compoundSolution.kinematics?.ratio || 0);
      const filename = `compound_cycloid_assembly_i${iRatio}.svg`;
      SvgExporter.download(svgContent, filename);
      this.showToast("Compound SVG успешно экспортирован", "success");
      return;
    }

    if (!this.currentSolution) return;

    const dRoller = this.params.usePinBearings ? this.params.pinBearingOd : this.params.carrierPinD;
    const holeRadius = (dRoller + 2 * this.params.E) / 2;
    const carrierPinRadius = (this.params.usePinBearings ? this.params.pinBearingOd : this.params.carrierPinD) / 2;

    const carrierHoles = [];
    for (let i = 0; i < this.params.carrierN; i++) {
      const a = (2 * Math.PI * i) / this.params.carrierN;
      carrierHoles.push({
        x: this.params.carrierR * Math.cos(a),
        y: this.params.carrierR * Math.sin(a),
        radius: holeRadius
      });
    }

    const svgContent = SvgExporter.generate({
      discPoints: this.currentSolution.points,
      camBoreRadius: this.params.camBore / 2,
      carrierHoles,
      statorRollers: this.currentSolution.rollers,
      E: this.params.E,
      Z1: this.params.Z1,
      dualDisc: this.params.dualDisc,
      exportMode: "assembly",
      includeStator: true,
      includeCarrier: true,
      includeCarrierPins: true,
      carrierPinRadius,
      carrierR: this.params.carrierR,
      carrierN: this.params.carrierN
    });

    const filename = `cycloid_assembly_Z${this.params.Z1}.svg`;
    SvgExporter.download(svgContent, filename);
  }

  // =========================================================================
  // УПРАВЛЕНИЕ ПРОЕКТАМИ (JSON) И ПОЛЬЗОВАТЕЛЬСКИМИ ПРЕСЕТАМИ
  // =========================================================================

  /**
   * Загрузка пользовательских пресетов из localStorage
   */
  loadCustomPresets() {
    try {
      const stored = localStorage.getItem("cycloid_custom_presets");
      this.customPresets = stored ? JSON.parse(stored) : {};
    } catch (e) {
      this.customPresets = {};
    }
    this.updateCustomPresetsUI();
  }

  /**
   * Обновление выпадающего списка пресетов в шапке
   */
  updateCustomPresetsUI() {
    if (!this.customPresetsGroup) return;
    this.customPresetsGroup.innerHTML = "";

    const keys = Object.keys(this.customPresets);
    if (keys.length === 0) {
      this.customPresetsGroup.style.display = "none";
      return;
    }

    this.customPresetsGroup.style.display = "block";
    for (const key of keys) {
      const opt = document.createElement("option");
      opt.value = `custom:${key}`;
      opt.textContent = `★ ${key}`;
      this.customPresetsGroup.appendChild(opt);
    }
  }

  /**
   * Сохранить текущие параметры как именованный пресет в браузере
   */
  saveCustomPreset(name) {
    if (!name) return;
    this.customPresets[name] = JSON.parse(JSON.stringify(this.params));
    try {
      localStorage.setItem("cycloid_custom_presets", JSON.stringify(this.customPresets));
      this.updateCustomPresetsUI();
      if (this.presetSelect) {
        this.presetSelect.value = `custom:${name}`;
      }
      this.showToast(`Пресет сохранён: "${name}"`, "success");
    } catch (e) {
      this.showToast("Ошибка сохранения в память браузера", "error");
    }
  }

  /**
   * Экспорт полного снимка конфигурации редуктора в файл JSON
   */
  exportProjectJson() {
    const project = {
      format: "cycloid-studio-project",
      version: "1.0",
      createdAt: new Date().toISOString(),
      projectName: `Cycloid_Z${this.params.Z1}_e${this.params.E}mm`,
      description: `Циклоидный редуктор i=${this.params.Z1}:1, R=${this.params.R}мм, Rr=${this.params.Rr}мм, e=${this.params.E}мм`,
      specs: {
        driveType: this.params.driveType || "standard",
        ratio: this.params.driveType === "compound"
          ? (this.compoundSolution ? `${this.compoundSolution.kinematics?.ratio?.toFixed(1)}:1` : `${this.params.Z1}:1`)
          : `${this.params.Z1}:1`,
        discTeeth: this.params.Z1,
        statorRollers: this.params.Z1 + 1,
        pinCircleRadius: this.params.R,
        rollerRadius: this.params.Rr,
        eccentricity: this.params.E,
        dualDisc: this.params.dualDisc,
        compoundZ2: this.params.driveType === "compound" ? this.params.Z2 : undefined,
        compoundZout: this.params.driveType === "compound" ? this.params.Zout : undefined
      },
      params: JSON.parse(JSON.stringify(this.params))
    };

    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.projectName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`Проект сохранён в ${project.projectName}.json`, "success");
  }

  /**
   * Импорт проекта из выбранного или перетащенного JSON файла
   */
  importProjectJson(file) {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const p = data.params || data;

        if (!p || typeof p !== "object" || p.Z1 === undefined || p.R === undefined) {
          throw new Error("Неверный формат: файл не содержит параметров циклоидного редуктора");
        }

        const name = data.projectName || file.name.replace(/\.[^/.]+$/, "");
        this.loadProjectParams(p, name);
      } catch (err) {
        this.showToast(`Ошибка загрузки: ${err.message}`, "error");
      }
    };

    reader.onerror = () => {
      this.showToast("Не удалось прочитать выбранный файл", "error");
    };

    reader.readAsText(file);
  }

  /**
   * Применить параметры проекта и обновить все контролы пользовательского интерфейса
   */
  loadProjectParams(p, projectName) {
    if (!p) return;
    Object.assign(this.params, p);

    const setCtrl = (ctrl, val, isFloat = true) => {
      if (!ctrl || !ctrl.range) return;
      ctrl.range.value = val;
      ctrl.num.value = val;
      ctrl.val.textContent = isFloat ? Number(val).toFixed(2) : val;
    };

    // Обновление основных параметров венца
    if (this.inputs.solver && this.params.solver) {
      this.inputs.solver.value = this.params.solver;
    }
    if (this.params.Z1 !== undefined) setCtrl(this.inputs.z1, this.params.Z1, false);
    if (this.params.R !== undefined) setCtrl(this.inputs.r, this.params.R, true);
    if (this.params.Rr !== undefined) setCtrl(this.inputs.rr, this.params.Rr, true);
    if (this.params.E !== undefined) setCtrl(this.inputs.e, this.params.E, true);
    if (this.params.clearance !== undefined) setCtrl(this.inputs.clearance, this.params.clearance, true);
    if (this.params.camBore !== undefined) setCtrl(this.inputs.camBore, this.params.camBore, true);

    // Моторный узел и подшипники кулачка
    if (this.inputs.bearingPreset && this.params.bearingPreset) {
      this.inputs.bearingPreset.value = this.params.bearingPreset;
    }
    if (this.params.bearingId !== undefined) setCtrl(this.inputs.bearingId, this.params.bearingId, true);
    if (this.params.bearingOd !== undefined) setCtrl(this.inputs.bearingOd, this.params.bearingOd, true);
    if (this.params.shaftD !== undefined) setCtrl(this.inputs.shaftD, this.params.shaftD, true);
    if (this.inputs.chkDcut && this.params.hasDcut !== undefined) {
      this.inputs.chkDcut.checked = !!this.params.hasDcut;
      const dcutWrap = document.getElementById("dcut-depth-wrap");
      if (dcutWrap) dcutWrap.style.display = this.params.hasDcut ? "block" : "none";
    }

    // Выходной вал и пальцы
    if (this.params.carrierN !== undefined) setCtrl(this.inputs.carrierN, this.params.carrierN, false);
    if (this.params.carrierR !== undefined) setCtrl(this.inputs.carrierR, this.params.carrierR, true);
    if (this.params.carrierPinD !== undefined) setCtrl(this.inputs.carrierPinD, this.params.carrierPinD, true);

    if (this.inputs.chkPinBearings && this.params.usePinBearings !== undefined) {
      this.inputs.chkPinBearings.checked = !!this.params.usePinBearings;
      const dirControls = document.getElementById("pin-direct-controls");
      const bControls = document.getElementById("pin-bearing-controls");
      if (dirControls) dirControls.style.display = this.params.usePinBearings ? "none" : "block";
      if (bControls) bControls.style.display = this.params.usePinBearings ? "block" : "none";
    }

    if (this.inputs.pinBearingPreset && this.params.pinBearingPreset) {
      this.inputs.pinBearingPreset.value = this.params.pinBearingPreset;
    }
    if (this.inputs.pinBearingId && this.params.pinBearingId !== undefined) {
      setCtrl(this.inputs.pinBearingId, this.params.pinBearingId, true);
    }
    if (this.inputs.pinBearingOd && this.params.pinBearingOd !== undefined) {
      setCtrl(this.inputs.pinBearingOd, this.params.pinBearingOd, true);
    }

    const dualDiscInput = this.inputs.dualDisc || this.inputs.chkDualDisc;
    if (dualDiscInput && this.params.dualDisc !== undefined) {
      dualDiscInput.checked = !!this.params.dualDisc;
      if (this.chkLayers.cam2) {
        this.chkLayers.cam2.checked = !!this.params.dualDisc;
        this.renderer.layers.cam2 = !!this.params.dualDisc;
        if (this.chips.cam2) {
          this.chips.cam2.classList.toggle("active", !!this.params.dualDisc);
        }
      }
      const dxfDisc2 = document.getElementById("dxf-inc-disc2");
      if (dxfDisc2) {
        dxfDisc2.checked = !!this.params.dualDisc;
      }
    }

    // Архитектура редуктора и параметры Compound
    if (this.params.driveType) {
      this.setDriveType(this.params.driveType, false);
    }
    if (this.compoundInputs) {
      if (this.params.Z2 !== undefined) setCtrl(this.compoundInputs.z2, this.params.Z2, false);
      if (this.params.R2 !== undefined) setCtrl(this.compoundInputs.r2, this.params.R2, true);
      if (this.params.Rr2 !== undefined) setCtrl(this.compoundInputs.rr2, this.params.Rr2, true);
      if (this.params.clearance2 !== undefined) setCtrl(this.compoundInputs.clearance2, this.params.clearance2, true);
      if (this.params.dowelD !== undefined) setCtrl(this.compoundInputs.dowelD, this.params.dowelD, true);
      if (this.params.dowelR !== undefined) setCtrl(this.compoundInputs.dowelR, this.params.dowelR, true);
      if (this.compoundInputs.selDowelN && this.params.dowelN !== undefined) {
        this.compoundInputs.selDowelN.value = this.params.dowelN;
      }
      if (this.compoundInputs.chkCompoundDowels && this.params.useDowelPins !== undefined) {
        this.compoundInputs.chkCompoundDowels.checked = !!this.params.useDowelPins;
        if (this.compoundInputs.compoundDowelsControls) {
          this.compoundInputs.compoundDowelsControls.style.display = this.params.useDowelPins ? "block" : "none";
        }
      }
      if (this.compoundInputs.selZoutMode && this.params.ZoutMode) {
        this.compoundInputs.selZoutMode.value = this.params.ZoutMode;
        if (this.compoundInputs.rowCustomZout) {
          this.compoundInputs.rowCustomZout.style.display = this.params.ZoutMode === "custom" ? "block" : "none";
        }
      }
      this.syncZout();
    }

    // Модификации профиля под 3D-печать (Relief)
    if (this.relief) {
      if (this.params.useRelief !== undefined) {
        if (this.relief.chkUseRelief) this.relief.chkUseRelief.checked = !!this.params.useRelief;
        if (this.relief.controlsBox) this.relief.controlsBox.style.display = this.params.useRelief ? "block" : "none";
      }
      if (this.params.tipRelief !== undefined) setCtrl(this.relief.tipRelief, this.params.tipRelief, true);
      if (this.params.rootRelief !== undefined) setCtrl(this.relief.rootRelief, this.params.rootRelief, true);
      if (this.relief.selTipMode && this.params.tipReliefMode) {
        this.relief.selTipMode.value = this.params.tipReliefMode;
      }
    }

    // Инструмент изготовления и контроль кривизны
    if (this.curvatureElements) {
      if (this.params.toolType && this.curvatureElements.selToolType) {
        this.curvatureElements.selToolType.value = this.params.toolType;
        if (this.curvatureElements.rowCustomTool) {
          this.curvatureElements.rowCustomTool.style.display = this.params.toolType === "custom" ? "block" : "none";
        }
      }
      if (this.params.toolDiameter !== undefined) {
        setCtrl(this.curvatureElements.inpToolD, this.params.toolDiameter, true);
      }
    }

    // Силовой и прочностной расчёт (Sensinger Stress)
    if (this.stressElements) {
      if (this.params.motorTorquePreset && this.stressElements.selMotorPreset) {
        this.stressElements.selMotorPreset.value = this.params.motorTorquePreset;
      }
      if (this.params.motorTorque !== undefined) {
        setCtrl(this.stressElements.motorTorque, this.params.motorTorque, true);
      }
      if (this.params.discThickness !== undefined) {
        setCtrl(this.stressElements.discThickness, this.params.discThickness, true);
      }
      if (this.params.discMaterial && this.stressElements.selMaterial) {
        this.stressElements.selMaterial.value = this.params.discMaterial;
      }
    }

    this.updateCalculations();
    this.render();
    this.showToast(`Проект загружен: ${projectName || 'Без названия'}`, "success");
  }

  /**
   * Отображение всплывающего уведомления (Toast)
   */
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === "error") {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-12px) scale(0.95)";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }
}

// Запуск при загрузке документа
window.addEventListener("DOMContentLoaded", () => {
  window.app = new CycloidApp();
});
