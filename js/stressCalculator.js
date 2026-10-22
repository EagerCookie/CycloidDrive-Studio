/**
 * Модуль расчёта контактных напряжений, сил и распределения нагрузки (Sensinger Stress & Load Sharing).
 * Основан на методике Jonathon W. Sensinger (2010):
 * "Unified approach to Cycloid Drive Profile, Stress and Efficiency optimization" (ASME J. Mech. Des.)
 * и классической контактной теории Герца для контакта цилиндра с цилиндрической выемкой.
 */

export class StressCalculator {
  /**
   * Библиотека конструкционных материалов для 3D-печати и металлообработки
   */
  static getMaterials() {
    return {
      "pla": {
        name: "PLA (Полилактид)",
        E: 3500, // МПа
        nu: 0.36,
        allowableStress: 45, // МПа (предел упругой деформации)
        density: 1.24, // г/см³
        desc: "Базовый жесткий термопласт для прототипирования. Хрупок при резких ударных нагрузках."
      },
      "petg": {
        name: "PETG (Полиэтиленгликоль)",
        E: 2100,
        nu: 0.38,
        allowableStress: 35,
        density: 1.27,
        desc: "Ударопрочный и вязкий материал с отличной межслойной адгезией. Высокая износостойкость."
      },
      "nylon": {
        name: "Nylon / PA12 (Полиамид)",
        E: 1750,
        nu: 0.40,
        allowableStress: 48,
        density: 1.01,
        desc: "Антифрикционный самосмазывающийся полимер. Отличная стойкость к истиранию и циклической усталости."
      },
      "pacf": {
        name: "PA-CF (Нейлон с углеволокном 20%)",
        E: 4500,
        nu: 0.35,
        allowableStress: 65,
        density: 1.15,
        desc: "Инженерный композит: высокая жесткость, термостойкость до 140°C и прочность на смятие."
      },
      "pom": {
        name: "POM / Delrin (Полиацеталь)",
        E: 2800,
        nu: 0.35,
        allowableStress: 60,
        density: 1.41,
        desc: "Золотой стандарт для зубчатых передач: минимальный коэффициент трения и стабильность размеров."
      },
      "steel": {
        name: "Конструкционная сталь (Сталь 40Х / 1045)",
        E: 210000,
        nu: 0.30,
        allowableStress: 350,
        density: 7.85,
        desc: "Максимальная нагрузочная способность и ресурс для промышленных роботов и станков ЧПУ."
      },
      "al6061": {
        name: "Алюминиевый сплав (Д16Т / 6061-T6)",
        E: 70000,
        nu: 0.33,
        allowableStress: 180,
        density: 2.70,
        desc: "Легкий сплав с высокой прочностью для облегченных манипуляторов и БПЛА."
      },
      "custom": null
    };
  }

  /**
   * Пресеты стандартных двигателей
   */
  static getMotorPresets() {
    return {
      "nema17-compact": { name: "NEMA 17 (Компактный 34 мм, 0.28 Н·м)", torque: 0.28, rpm: 1200 },
      "nema17-standard": { name: "NEMA 17 (Стандартный 40 мм, 0.45 Н·м)", torque: 0.45, rpm: 1000 },
      "nema17-high":     { name: "NEMA 17 (Усиленный 48 мм, 0.59 Н·м)", torque: 0.59, rpm: 800 },
      "nema23-standard": { name: "NEMA 23 (Стандартный 56 мм, 1.26 Н·м)", torque: 1.26, rpm: 800 },
      "nema23-high":     { name: "NEMA 23 (Высокомоментный 76 мм, 2.50 Н·м)", torque: 2.50, rpm: 600 },
      "nema34-high":     { name: "NEMA 34 (Промышленный 86 мм, 4.50 Н·м)", torque: 4.50, rpm: 500 },
      "custom": null
    };
  }

  /**
   * Выполнить расчёт сил, контактных напряжений и кинематического люфта
   * @param {Object} options
   * @param {number} options.motorTorque Крутящий момент на входе (Н·м)
   * @param {number} options.motorRpm Обороты двигателя на входе (об/мин)
   * @param {number} options.efficiency КПД редуктора (обычно 0.85–0.92)
   * @param {number} options.discThickness Толщина циклоидного диска b (мм)
   * @param {string} options.materialKey Ключ материала диска ('pla', 'petg', ...)
   * @param {Object} [options.customMaterial] Пользовательские свойства (если materialKey === 'custom')
   * @param {number} options.Z1 Число зубьев диска
   * @param {number} options.R Радиус расположения роликов статора (мм)
   * @param {number} options.Rr Радиус ролика статора (мм)
   * @param {number} options.E Эксцентриситет (мм)
   * @param {number} options.clearance Эквидистантный зазор (мм)
   * @param {boolean} options.dualDisc Используется ли схема с двумя дисками (делит момент пополам)
   * @param {number} options.carrierN Количество пальцев выходного вала
   * @param {number} options.carrierR Радиус расположения пальцев водила (мм)
   * @param {number} options.carrierPinD Диаметр пальца водила (мм)
   * @param {number} [options.rho_c] Радиус кривизны профиля в точке контакта (мм)
   * @returns {Object} Результаты расчёта
   */
  static calculate(options) {
    const {
      motorTorque = 0.45,
      motorRpm = 1000,
      efficiency = 0.90,
      discThickness = 10.0,
      materialKey = "pla",
      customMaterial = null,
      Z1 = 10,
      R = 30.0,
      Rr = 3.0,
      E = 1.5,
      clearance = 0.05,
      dualDisc = true,
      carrierN = 6,
      carrierR = 17.0,
      carrierPinD = 4.0,
      rho_c = 4.25
    } = options;

    const Z2 = Z1 + 1; // Число роликов статора
    const b = Math.max(1.0, discThickness); // мм

    // 1. Выходной крутящий момент и обороты
    // T_out = T_in * Z1 * eta
    const outputTorque = motorTorque * Z1 * efficiency; // Н·м
    const outputTorqueNmm = outputTorque * 1000; // Н·мм
    const outputRpm = motorRpm / Z1;
    const outputPowerWatts = (outputTorque * (outputRpm * 2 * Math.PI)) / 60;

    // В двухдисковой схеме нагрузка делится поровну между двумя противофазными дисками
    const discsCount = dualDisc ? 2 : 1;
    const torquePerDisc = outputTorqueNmm / discsCount; // Н·мм на один диск

    // 2. Расчёт нормальных сил на роликах статора (Sensinger Multi-tooth Load Sharing)
    // В зацеплении одновременно находится приблизительно половина роликов (Z2 / 2).
    // По Sensinger: F_max = (4 * T_disc) / (Z2 * R)
    const FmaxRoller = (4 * torquePerDisc) / (Z2 * R); // Н

    // Распределение сил по всем Z2 роликам статора при текущем положении
    const rollerForces = new Array(Z2);
    let activeRollersCount = 0;
    for (let j = 0; j < Z2; j++) {
      const angle = (2 * Math.PI * j) / Z2;
      // Синусоидальное распределение сил в активной полуплоскости зацепления
      const sinA = Math.sin(angle);
      if (sinA > 0.001) {
        rollerForces[j] = FmaxRoller * sinA;
        activeRollersCount++;
      } else {
        rollerForces[j] = 0;
      }
    }

    // 3. Контактные напряжения по Герцу (Hertzian Contact Stress)
    // Пара трения: Цилиндрический ролик статора (сталь) + зуб циклоидного диска
    const materials = this.getMaterials();
    let mat = materials[materialKey];
    if (materialKey === "custom" && customMaterial) {
      mat = customMaterial;
    }
    if (!mat) mat = materials["pla"];

    const E1 = mat.E; // МПа (диск)
    const nu1 = mat.nu;
    const allowableStress = mat.allowableStress; // МПа

    // Ролики статора изготовлены из закаленной стали (подшипниковые штифты / ролики)
    const E2 = 210000; // МПа
    const nu2 = 0.30;

    // Приведённый модуль упругости: 1/E* = (1 - nu1^2)/E1 + (1 - nu2^2)/E2
    const invEstar = (1 - nu1 * nu1) / E1 + (1 - nu2 * nu2) / E2;
    const Estar = invEstar > 0 ? 1 / invEstar : E1;

    // Приведённый радиус кривизны контакта: 1/rho* = 1/rho_c + 1/Rr
    // В зоне рабочего зацепления сопряжение выпукло-вогнутое или двух цилиндров
    const effRhoC = Math.max(0.5, rho_c);
    const rhoStar = (effRhoC * Rr) / (effRhoC + Rr); // мм

    // Пиковое контактное давление Герца:
    // sigma_H = sqrt( (F_max * E*) / (pi * b * rho*) )
    const radicand = (FmaxRoller * Estar) / (Math.PI * b * rhoStar);
    const sigmaHertz = radicand > 0 ? Math.sqrt(radicand) : 0; // МПа

    // Коэффициент запаса прочности по контакту
    const safetyFactor = sigmaHertz > 0 ? (allowableStress / sigmaHertz) : 999;

    let stressStatus = "ok";
    let statusTitle = "";
    let statusDesc = "";

    if (safetyFactor >= 1.5) {
      stressStatus = "ok";
      statusTitle = `Надёжно: Запас прочности ${safetyFactor.toFixed(1)}x`;
      statusDesc = `Контактные напряжения (σ_H = ${sigmaHertz.toFixed(1)} МПа) значительно ниже предела материала ([σ] = ${allowableStress} МПа). Диск выдержит длительную непрерывную работу.`;
    } else if (safetyFactor >= 1.0) {
      stressStatus = "warning";
      statusTitle = `Внимание: Работа вблизи предела текучести (запас ${(safetyFactor * 100 - 100).toFixed(0)}%)`;
      statusDesc = `Напряжения σ_H = ${sigmaHertz.toFixed(1)} МПа близки к пределу материала (${allowableStress} МПа). Рекомендуется увеличить толщину диска b до ${(b * 1.5).toFixed(0)} мм или использовать PA-CF.`;
    } else {
      stressStatus = "critical";
      statusTitle = `Опасно: Перегрузка материала! (дефицит ${((1 - safetyFactor) * 100).toFixed(0)}%)`;
      statusDesc = `Контактные напряжения (${sigmaHertz.toFixed(1)} МПа) превышают предел ${mat.name} (${allowableStress} МПа)! Зубья диска будут деформироваться и сминаться. Увеличьте толщину диска b, диаметр венца R или перейдите на более прочный материал.`;
    }

    // 4. Напряжения в пальцах выходного вала (Carrier Pins)
    // Сила на один палец: F_pin = T_out / (carrierN * carrierR)
    const totalCarrierArm = Math.max(1.0, carrierN * carrierR);
    const Fpin = outputTorqueNmm / totalCarrierArm; // Н

    const pinRadius = Math.max(0.5, carrierPinD / 2);
    const pinArea = Math.PI * Math.pow(pinRadius, 2); // мм²
    const pinShearStress = pinArea > 0 ? (Fpin / pinArea) : 0; // МПа

    // Изгибное напряжение в консольном пальце (плечо изгиба ~ b / 2)
    const pinW = (Math.PI * Math.pow(carrierPinD, 3)) / 32; // момент сопротивления изгибу
    const pinBendingMoment = Fpin * (b / 2); // Н·мм
    const pinBendingStress = pinW > 0 ? (pinBendingMoment / pinW) : 0; // МПа

    // Допускаемое напряжение для стальных пальцев/винтов класса 8.8 (300 МПа) или 12.9 (500 МПа)
    const pinAllowableStress = 350; // МПа
    const pinSafetyFactor = pinBendingStress > 0 ? (pinAllowableStress / pinBendingStress) : 999;

    // 5. Теоретический люфт редуктора (Angular Backlash)
    // Возникает из-за эквидистантного зазора delta = clearance между зубьями и роликами:
    // Delta_theta = (2 * delta) / (E * Z1) в радианах
    const backlashRad = (E > 0 && Z1 > 0) ? (2 * clearance) / (E * Z1) : 0;
    const backlashDeg = (backlashRad * 180) / Math.PI;
    const backlashArcmin = backlashDeg * 60; // угловые минуты

    return {
      outputTorque,
      outputRpm,
      outputPowerWatts,
      FmaxRoller,
      activeRollersCount,
      rollerForces,
      sigmaHertz,
      allowableStress,
      safetyFactor,
      stressStatus,
      statusTitle,
      statusDesc,
      material: mat,
      materialKey,
      discThickness: b,
      discsCount,
      Fpin,
      pinShearStress,
      pinBendingStress,
      pinSafetyFactor,
      backlashRad,
      backlashDeg,
      backlashArcmin
    };
  }
}
