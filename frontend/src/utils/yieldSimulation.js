/**
 * yieldSimulation.js
 *
 * Generates synthetic semiconductor unit telemetry matching the exact backend
 * Tri-Shield model schema (34 features + bin classification).
 *
 * Aligns with:
 *   - backend/generate_synthetic_data.py (NOMINAL_PARAMS, ARCHETYPE_OVERRIDES)
 *   - backend/models/ensemble/ensemble_model.py (FEATURE_COLS)
 *   - backend/api/schemas.py (UnitTelemetry)
 *
 * 8 Bins:
 *   Bin 1: Perfect (Sellable)
 *   Bin 2: Marginal (Downgraded but sellable)
 *   Bin 3: Recoverable (Reworkable)
 *   Bin 4: Fab Passthrough (Upstream defect — undetectable)
 *   Bin 5: Open/Short Test Fail
 *   Bin 6: Delamination / Void
 *   Bin 7: Leakage Test Fail
 *   Bin 8: Functional Test Fail
 *
 * 3 Final Tests:
 *   1. Open/Short Test   → catches Bin 5 (wire bond failures)
 *   2. Leakage Test      → catches Bin 7 (moisture/stress cracks)
 *   3. Functional Test   → catches Bin 8 (thermal/mechanical damage)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const randNormal = (mean, std) => {
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * std
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const uid = () => `UNIT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

// ─── Nominal Parameters (mirrors backend generate_synthetic_data.py) ─────────
const NOMINAL = {
  stage1: {
    bond_force:          { mean: 30.0, std: 1.0 },
    xy_placement_offset: { mean: 5.0,  std: 2.0 },
    bond_line_thickness: { mean: 25.0, std: 1.5 },
    epoxy_viscosity:     { mean: 5000, std: 200 },
    pick_place_speed:    { mean: 8000, std: 300 },
  },
  stage2: {
    ultrasonic_power:       { mean: 1.2,   std: 0.1 },
    bond_time:              { mean: 15.0,  std: 1.0 },
    loop_height:            { mean: 200,   std: 10 },
    capillary_stroke_count: { mean: 100000, std: 50000 },
    efo_voltage:            { mean: 60,    std: 2 },
  },
  stage3: {
    transfer_pressure:   { mean: 8.0,  std: 0.4 },
    clamping_force:      { mean: 50,   std: 2.0 },
    molding_temperature: { mean: 180,  std: 2.0 },
    vacuum_level:        { mean: 2.0,  std: 0.5 },
  },
  stage4: {
    ball_placement_accuracy: { mean: 5.0,  std: 2.0 },
    laser_pulse_energy:      { mean: 12.0, std: 0.5 },
    reflow_peak_temp:        { mean: 260,  std: 2.0 },
    flux_density:            { mean: 0.8,  std: 0.05 },
  },
  stage5: {
    spindle_current:     { mean: 2.0, std: 0.1 },
    vibration_amplitude: { mean: 0.5, std: 0.1 },
    blade_wear_index:    { mean: 0.3, std: 0.1 },
    cooling_water_flow:  { mean: 1.5, std: 0.1 },
  },
}

// ─── Defect Archetype Overrides (mirrors backend ARCHETYPE_OVERRIDES) ────────
const DEFECT_OVERRIDES = {
  void_delamination: {
    targetBin: 6,
    rootStage: 1,
    label: 'Void / Delamination',
    overrides: {
      stage1: {
        bond_force:          { mean: 8.0,  std: 1.0 },
        xy_placement_offset: { mean: 30.0, std: 2.0 },
        bond_line_thickness: { mean: 5.0,  std: 1.0 },
      }
    }
  },
  wire_non_stick: {
    targetBin: 5,
    rootStage: 2,
    label: 'Wire Non-Stick (Open/Short)',
    overrides: {
      stage2: {
        ultrasonic_power:       { mean: 0.2, std: 0.05 },
        bond_time:              { mean: 2.0, std: 0.5 },
        loop_height:            { mean: 350, std: 10 },
        capillary_stroke_count: { mean: 550000, std: 20000 },
      }
    }
  },
  wire_sweep: {
    targetBin: 8,
    rootStage: 3,
    label: 'Wire Sweep (Functional Fail)',
    overrides: {
      stage3: {
        transfer_pressure:   { mean: 15.0, std: 0.5 },
        clamping_force:      { mean: 75,   std: 2.0 },
        molding_temperature: { mean: 200,  std: 3.0 },
        vacuum_level:        { mean: 12.0, std: 1.0 },
      }
    }
  },
  popcorn_delamination: {
    targetBins: [5, 7],
    binWeights: [0.6, 0.4],
    rootStage: 3,
    label: 'Popcorn Delamination (Leakage)',
    overrides: {
      stage3: {
        molding_temperature: { mean: 130, std: 3.0 },
        vacuum_level:        { mean: 25.0, std: 2.0 },
        transfer_pressure:   { mean: 14.0, std: 0.5 },
        clamping_force:      { mean: 30,   std: 2.0 },
      }
    }
  },
  thermal_fracture: {
    targetBin: 7,
    rootStage: 4,
    label: 'Thermal Fracture (Leakage)',
    overrides: {
      stage4: {
        reflow_peak_temp:        { mean: 310, std: 3.0 },
        ball_placement_accuracy: { mean: 40.0, std: 3.0 },
        flux_density:            { mean: 1.8,  std: 0.1 },
        laser_pulse_energy:      { mean: 18.0, std: 1.0 },
      }
    }
  },
  ball_bridge_saw: {
    targetBin: 8,
    rootStage: 5,
    label: 'Ball Bridge / Saw Damage (Functional Fail)',
    overrides: {
      stage4: {
        ball_placement_accuracy: { mean: 45.0, std: 4.0 },
        flux_density:            { mean: 1.8,  std: 0.1 },
      },
      stage5: {
        spindle_current:     { mean: 4.0,  std: 0.2 },
        vibration_amplitude: { mean: 2.5,  std: 0.2 },
        blade_wear_index:    { mean: 0.99, std: 0.01 },
      }
    }
  },
  fab_passthrough: {
    targetBin: 4,
    rootStage: 0,
    label: 'Fab Passthrough (Upstream)',
    overrides: {}  // No sensor deviation — invisible to backend
  },
}

// ─── Machine Pools ───────────────────────────────────────────────────────────
const MACHINES = {
  die_bonder:  ['DB_001','DB_002','DB_003','DB_004','DB_005'],
  wire_bonder: ['WB_001','WB_002','WB_003','WB_004','WB_005'],
  mold_press:  ['MP_001','MP_002','MP_003','MP_004','MP_005'],
  ball_attach: ['BA_001','BA_002','BA_003','BA_004','BA_005'],
  saw:         ['SW_001','SW_002','SW_003','SW_004','SW_005'],
}
const DEGRADED_MACHINES = {
  die_bonder:  ['DB_001','DB_002'],
  wire_bonder: ['WB_001','WB_002'],
  mold_press:  ['MP_001'],
  ball_attach: ['BA_001'],
  saw:         ['SW_001'],
}

// ─── RRS Computation (mirrors backend compute_rrs_stageN) ────────────────────
function computeRrsStage1(unit) {
  const forceDev = Math.abs(unit.bond_force - 30.0) / 5.0
  const placeErr = unit.xy_placement_offset / 15.0
  const bltDev   = Math.abs(unit.bond_line_thickness - 25.0) / 7.0
  return clamp(forceDev * 0.40 + placeErr * 0.35 + bltDev * 0.25, 0, 1)
}

function computeRrsStage2(unit) {
  const powerDev = Math.abs(unit.ultrasonic_power - 1.2) / 0.4
  const timeDev  = Math.abs(unit.bond_time - 15.0) / 5.0
  const loopDev  = Math.abs(unit.loop_height - 200) / 50.0
  const wear     = unit.capillary_stroke_count / 500000
  return clamp(wear * 0.30 + powerDev * 0.30 + timeDev * 0.20 + loopDev * 0.20, 0, 1)
}

function computeRrsStage3(unit) {
  const pressDev  = Math.abs(unit.transfer_pressure - 8.0) / 2.0
  const vacRisk   = unit.vacuum_level / 10.0
  const tempDev   = Math.abs(unit.molding_temperature - 180) / 10.0
  const resinRisk = unit.resin_batch_risk_score || 0
  return clamp(vacRisk * 0.30 + tempDev * 0.25 + pressDev * 0.25 + resinRisk * 0.20, 0, 1)
}

function computeRrsStage4(unit) {
  const tempDev = Math.abs(unit.reflow_peak_temp - 260) / 10.0
  const ballErr = unit.ball_placement_accuracy / 25.0
  const fluxDev = Math.abs(unit.flux_density - 0.8) / 0.3
  return clamp(tempDev * 0.35 + ballErr * 0.35 + fluxDev * 0.30, 0, 1)
}

function computeRrsStage5(unit) {
  const blade      = unit.blade_wear_index
  const vibRisk    = unit.vibration_amplitude / 1.5
  const currentDev = Math.abs(unit.spindle_current - 2.0) / 0.5
  return clamp(blade * 0.35 + vibRisk * 0.35 + currentDev * 0.30, 0, 1)
}

function computeCumulativeRrs(prevRrs, stageRrs) {
  // More aggressive accumulation: severe stage defects can push RRS past termination threshold
  return clamp(prevRrs + stageRrs * (1 - prevRrs) * 0.85, 0, 1)
}

// ─── Bin Names (for UI display) ──────────────────────────────────────────────
export const BIN_NAMES = {
  1: 'Bin 1 — Perfect',
  2: 'Bin 2 — Marginal',
  3: 'Bin 3 — Recoverable',
  4: 'Bin 4 — Fab Passthrough',
  5: 'Bin 5 — Open/Short Fail',
  6: 'Bin 6 — Delamination',
  7: 'Bin 7 — Leakage Fail',
  8: 'Bin 8 — Functional Fail',
}

// ─── 3 Final Tests ───────────────────────────────────────────────────────────
export const FINAL_TESTS = {
  open_short:  { name: 'Open/Short Test',  catchesBins: [5],    icon: '⚡' },
  leakage:     { name: 'Leakage Test',     catchesBins: [7],    icon: '💧' },
  functional:  { name: 'Functional Test',  catchesBins: [8],    icon: '🔧' },
}

/**
 * Determine which final tests a unit would fail based on its bin code.
 */
export function getTestResults(binCode) {
  return {
    open_short:  { passed: ![5].includes(binCode),  name: 'Open/Short Test' },
    leakage:     { passed: ![7].includes(binCode),  name: 'Leakage Test' },
    functional:  { passed: ![8].includes(binCode),  name: 'Functional Test' },
  }
}

// ─── Main Generator ──────────────────────────────────────────────────────────
/**
 * Generate a single semiconductor unit with full telemetry.
 *
 * @param {'normal'|'drift'|'excursion'|'marginal'|'fab_escape'} template
 *   - normal:      Healthy Bin 1 unit (nominal sensor values)
 *   - drift:       Marginal unit (wider variance, may land Bin 2-3)
 *   - excursion:   Random defect archetype (Bins 5-8)
 *   - marginal:    Suspicious but within spec (Bin 2-3)
 *   - fab_escape:  Fab passthrough defect (Bin 4, invisible to backend)
 */
export function generateUnitData(template = 'normal') {
  const now = new Date()
  const unitId = uid()

  // ── Select archetype based on template ──────────────────────────────────
  let archetype = null
  let isDefective = false
  let stdMultiplier = 1.0

  if (template === 'excursion' || template === 'attack') {
    // Pick a random defect archetype
    const archetypeKeys = Object.keys(DEFECT_OVERRIDES)
    const key = pick(archetypeKeys.filter(k => k !== 'fab_passthrough'))
    archetype = DEFECT_OVERRIDES[key]
    isDefective = true
  } else if (template === 'fab_escape') {
    archetype = DEFECT_OVERRIDES.fab_passthrough
    isDefective = true
  } else if (template === 'drift' || template === 'suspicious') {
    stdMultiplier = 2.0  // wider variance → marginal zone
  } else if (template === 'marginal') {
    stdMultiplier = 1.5
  }

  // ── Generate sensor params per stage ────────────────────────────────────
  const gen = (stage, param) => {
    let { mean, std } = NOMINAL[stage][param]
    // Apply overrides if this is a defect archetype
    if (archetype?.overrides?.[stage]?.[param]) {
      mean = archetype.overrides[stage][param].mean
      std  = archetype.overrides[stage][param].std
    } else {
      std *= stdMultiplier
    }
    return Math.max(0, randNormal(mean, std))
  }

  // ── Pick machines ───────────────────────────────────────────────────────
  const pickMachine = (stage) => {
    if (isDefective && archetype?.rootStage) {
      const stageMap = { die_bonder: 1, wire_bonder: 2, mold_press: 3, ball_attach: 4, saw: 5 }
      if (stageMap[stage] === archetype.rootStage && Math.random() < 0.85) {
        return pick(DEGRADED_MACHINES[stage])
      }
    }
    return pick(MACHINES[stage])
  }

  // ── Stage 1: Die Attach ─────────────────────────────────────────────────
  const unit = {
    unit_id: unitId,
    timestamp: now.toISOString(),

    // Stage 1
    bond_force:          parseFloat(gen('stage1', 'bond_force').toFixed(3)),
    xy_placement_offset: parseFloat(Math.abs(gen('stage1', 'xy_placement_offset')).toFixed(3)),
    bond_line_thickness: parseFloat(gen('stage1', 'bond_line_thickness').toFixed(3)),
    epoxy_viscosity:     parseFloat(gen('stage1', 'epoxy_viscosity').toFixed(1)),
    pick_place_speed:    parseFloat(gen('stage1', 'pick_place_speed').toFixed(1)),

    // Stage 2
    ultrasonic_power:       parseFloat(gen('stage2', 'ultrasonic_power').toFixed(4)),
    bond_time:              parseFloat(gen('stage2', 'bond_time').toFixed(2)),
    loop_height:            parseFloat(gen('stage2', 'loop_height').toFixed(1)),
    capillary_stroke_count: parseFloat(clamp(gen('stage2', 'capillary_stroke_count'), 0, 500000).toFixed(0)),
    efo_voltage:            parseFloat(gen('stage2', 'efo_voltage').toFixed(2)),

    // Stage 3
    transfer_pressure:   parseFloat(gen('stage3', 'transfer_pressure').toFixed(3)),
    clamping_force:      parseFloat(gen('stage3', 'clamping_force').toFixed(2)),
    molding_temperature: parseFloat(gen('stage3', 'molding_temperature').toFixed(1)),
    vacuum_level:        parseFloat(gen('stage3', 'vacuum_level').toFixed(3)),

    // Stage 4
    ball_placement_accuracy: parseFloat(Math.abs(gen('stage4', 'ball_placement_accuracy')).toFixed(3)),
    laser_pulse_energy:      parseFloat(gen('stage4', 'laser_pulse_energy').toFixed(3)),
    reflow_peak_temp:        parseFloat(gen('stage4', 'reflow_peak_temp').toFixed(1)),
    flux_density:            parseFloat(gen('stage4', 'flux_density').toFixed(4)),

    // Stage 5
    spindle_current:     parseFloat(gen('stage5', 'spindle_current').toFixed(4)),
    vibration_amplitude: parseFloat(gen('stage5', 'vibration_amplitude').toFixed(4)),
    blade_wear_index:    parseFloat(clamp(gen('stage5', 'blade_wear_index'), 0, 1).toFixed(4)),
    cooling_water_flow:  parseFloat(gen('stage5', 'cooling_water_flow').toFixed(4)),

    // Resin batch
    resin_batch_risk_score: isDefective ? parseFloat((0.5 + Math.random() * 0.3).toFixed(3)) : parseFloat((Math.random() * 0.15).toFixed(3)),
  }

  // ── Compute RRS chain ───────────────────────────────────────────────────
  unit.rrs_1 = parseFloat(computeRrsStage1(unit).toFixed(4))
  unit.rrs_2 = parseFloat(computeCumulativeRrs(unit.rrs_1, computeRrsStage2(unit)).toFixed(4))
  unit.rrs_3 = parseFloat(computeCumulativeRrs(unit.rrs_2, computeRrsStage3(unit)).toFixed(4))
  unit.rrs_4 = parseFloat(computeCumulativeRrs(unit.rrs_3, computeRrsStage4(unit)).toFixed(4))
  unit.rrs_5 = parseFloat(computeCumulativeRrs(unit.rrs_4, computeRrsStage5(unit)).toFixed(4))

  // ── Compute RRS deltas ──────────────────────────────────────────────────
  unit.rrs_delta_1 = parseFloat(unit.rrs_1.toFixed(4))
  unit.rrs_delta_2 = parseFloat((unit.rrs_2 - unit.rrs_1).toFixed(4))
  unit.rrs_delta_3 = parseFloat((unit.rrs_3 - unit.rrs_2).toFixed(4))
  unit.rrs_delta_4 = parseFloat((unit.rrs_4 - unit.rrs_3).toFixed(4))
  unit.rrs_delta_5 = parseFloat((unit.rrs_5 - unit.rrs_4).toFixed(4))

  // ── Machine risk score ──────────────────────────────────────────────────
  unit.machine_die_bonder  = pickMachine('die_bonder')
  unit.machine_wire_bonder = pickMachine('wire_bonder')
  unit.machine_mold_press  = pickMachine('mold_press')
  unit.machine_ball_attach = pickMachine('ball_attach')
  unit.machine_saw         = pickMachine('saw')

  // Simplified machine_risk_score: degraded machines contribute higher risk
  const degradedCount = [
    DEGRADED_MACHINES.die_bonder.includes(unit.machine_die_bonder),
    DEGRADED_MACHINES.wire_bonder.includes(unit.machine_wire_bonder),
    DEGRADED_MACHINES.mold_press.includes(unit.machine_mold_press),
    DEGRADED_MACHINES.ball_attach.includes(unit.machine_ball_attach),
    DEGRADED_MACHINES.saw.includes(unit.machine_saw),
  ].filter(Boolean).length
  unit.machine_risk_score = parseFloat(clamp((degradedCount / 5) * 0.8 + Math.random() * 0.1, 0, 1).toFixed(3))

  // ── Assign bin code ─────────────────────────────────────────────────────
  if (!isDefective) {
    if (template === 'normal') {
      unit.bin_code = 1
    } else if (template === 'marginal') {
      unit.bin_code = Math.random() < 0.85 ? 1 : 2
    } else if (template === 'drift' || template === 'suspicious') {
      const r = Math.random()
      unit.bin_code = r < 0.60 ? 1 : (r < 0.85 ? 2 : 3)
    } else {
      unit.bin_code = 1
    }
  } else if (archetype) {
    if (archetype.targetBins) {
      // Weighted random pick (e.g., popcorn → 60% Bin 5, 40% Bin 7)
      const r = Math.random()
      let cumulative = 0
      for (let i = 0; i < archetype.targetBins.length; i++) {
        cumulative += archetype.binWeights[i]
        if (r <= cumulative) {
          unit.bin_code = archetype.targetBins[i]
          break
        }
      }
      if (!unit.bin_code) unit.bin_code = archetype.targetBins[0]
    } else {
      unit.bin_code = archetype.targetBin
    }
  }

  unit.is_defective = unit.bin_code >= 4 ? 1 : 0

  // ── INJECT NEAR-MISS NOISE (For FP Testing) ─────────────────────────────
  // Occasionally make a "Good" unit (Bin 1-3) have one very suspicious sensor 
  // feature to trigger model uncertainty (False Positives).
  if (!isDefective && Math.random() < 0.15) {
    const feature = pick(['rrs_5', 'machine_risk_score', 'molding_temperature', 'ultrasonic_power'])
    if (feature === 'rrs_5') unit.rrs_5 = parseFloat((0.7 + Math.random() * 0.2).toFixed(4))
    if (feature === 'machine_risk_score') unit.machine_risk_score = parseFloat((0.65 + Math.random() * 0.2).toFixed(3))
    if (feature === 'molding_temperature') unit.molding_temperature = parseFloat((187 + Math.random() * 5).toFixed(1))
    if (feature === 'ultrasonic_power') unit.ultrasonic_power = parseFloat((0.5 + Math.random() * 0.3).toFixed(4))
  }

  // ── Final Test Results ──────────────────────────────────────────────────
  const tests = getTestResults(unit.bin_code)
  unit.test_open_short  = tests.open_short.passed
  unit.test_leakage     = tests.leakage.passed
  unit.test_functional  = tests.functional.passed

  // ── UI Context Fields ───────────────────────────────────────────────────
  unit.id         = unitId
  unit.unit_id    = unitId
  unit.timestamp  = new Date().toISOString()
  unit.binName    = BIN_NAMES[unit.bin_code] || `Bin ${unit.bin_code}`
  unit.template   = template
  unit.archetype  = archetype?.label || (template === 'normal' ? 'Nominal' : 'Marginal')
  unit.isDefective = unit.is_defective === 1
  unit.riskSignalCount = isDefective ? Math.floor(3 + Math.random() * 3) : Math.floor(Math.random() * 2)

  // Assembly line context
  unit.fab       = pick(['Fab 10N', 'Fab 15', 'Fab 20'])
  unit.lotId     = `LOT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  unit.waferNum  = Math.floor(1 + Math.random() * 25)

  return unit
}
