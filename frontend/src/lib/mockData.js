import { Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle } from 'lucide-react'

export const PROCESSES = [
  { 
    id: 'die-bond', name: 'Die Bond', icon: Cpu,
    params: [
      { id: 'bond_force', name: 'Bond Force', unit: 'N', min: 20, max: 40, nominal: 30, type: 'Process' },
      { id: 'xy_placement_offset', name: 'XY Offset', unit: 'µm', min: 0, max: 20, nominal: 5, type: 'Unit' },
      { id: 'bond_line_thickness', name: 'Bond Line Thickness', unit: 'µm', min: 15, max: 35, nominal: 25, type: 'Process' },
      { id: 'epoxy_viscosity', name: 'Epoxy Viscosity', unit: 'cP', min: 4500, max: 5500, nominal: 5000, type: 'Process' },
      { id: 'pick_place_speed', name: 'Pick & Place Speed', unit: 'UPH', min: 7000, max: 9000, nominal: 8000, type: 'Process' }
    ]
  },
  { 
    id: 'wire-bond', name: 'Wire Bond', icon: Zap,
    params: [
      { id: 'ultrasonic_power', name: 'Ultrasonic Power', unit: 'W', min: 0.8, max: 1.6, nominal: 1.2, type: 'Process' },
      { id: 'bond_time', name: 'Bond Time', unit: 'ms', min: 10, max: 20, nominal: 15, type: 'Process' },
      { id: 'loop_height', name: 'Loop Height', unit: 'µm', min: 150, max: 250, nominal: 200, type: 'Unit' },
      { id: 'capillary_stroke_count', name: 'Capillary Stroke', unit: 'k', min: 0, max: 500, nominal: 100, type: 'Drift' },
      { id: 'efo_voltage', name: 'EFO Voltage', unit: 'V', min: 55, max: 65, nominal: 60, type: 'Process' }
    ]
  },
  { 
    id: 'mold', name: 'Molding', icon: Thermometer,
    params: [
      { id: 'transfer_pressure', name: 'Transfer Pressure', unit: 'MPa', min: 6, max: 10, nominal: 8, type: 'Process' },
      { id: 'clamping_force', name: 'Clamping Force', unit: 'kN', min: 45, max: 55, nominal: 50, type: 'Process' },
      { id: 'molding_temperature', name: 'Molding Temp', unit: '°C', min: 170, max: 190, nominal: 180, type: 'Process' },
      { id: 'vacuum_level', name: 'Vacuum Level', unit: 'kPa', min: 0, max: 5, nominal: 2, type: 'Process' }
    ]
  },
  { 
    id: 'ball-attach', name: 'Ball Attach', icon: Microscope,
    params: [
      { id: 'ball_placement_accuracy', name: 'Placement Accuracy', unit: 'µm', min: 0, max: 15, nominal: 5, type: 'Unit' },
      { id: 'laser_pulse_energy', name: 'Laser Pulse Energy', unit: 'mJ', min: 10, max: 14, nominal: 12, type: 'Process' },
      { id: 'reflow_peak_temp', name: 'Reflow Peak Temp', unit: '°C', min: 250, max: 270, nominal: 260, type: 'Process' },
      { id: 'flux_density', name: 'Flux Density', unit: 'mg/cm²', min: 0.6, max: 1.0, nominal: 0.8, type: 'Process' }
    ]
  },
  { 
    id: 'saw', name: 'Saw Singulation', icon: Scissors,
    params: [
      { id: 'spindle_current', name: 'Spindle Current', unit: 'A', min: 1.5, max: 2.5, nominal: 2.0, type: 'Process' },
      { id: 'vibration_amplitude', name: 'Vibration Amplitude', unit: 'G', min: 0, max: 1.0, nominal: 0.5, type: 'Process' },
      { id: 'blade_wear_index', name: 'Blade Wear Index', unit: '', min: 0, max: 1, nominal: 0.3, type: 'Drift' },
      { id: 'cooling_water_flow', name: 'Cooling Water', unit: 'L/min', min: 1.0, max: 2.0, nominal: 1.5, type: 'Process' }
    ]
  }
]

export const MOCK_FLEETS = {
  'die-bond': [
    { id: 'DB_001', risk: 1.2, status: 'OPTIMAL', currentUnit: 'UNIT-A92J1', liveParams: { bond_force: 30.2, xy_placement_offset: 4.8, bond_line_thickness: 25.1, epoxy_viscosity: 5010, pick_place_speed: 8050 }, history: [], historicalChartData: [] },
    { id: 'DB_002', risk: 8.4, status: 'CRITICAL', currentUnit: 'UNIT-B81K2', liveParams: { bond_force: 18.5, xy_placement_offset: 25.2, bond_line_thickness: 12.0, epoxy_viscosity: 4800, pick_place_speed: 7200 }, history: [], historicalChartData: [] }
  ],
  'wire-bond': [
    { id: 'WB_005', risk: 2.1, status: 'OPTIMAL', currentUnit: 'UNIT-C71L3', liveParams: { ultrasonic_power: 1.21, bond_time: 15.2, loop_height: 202, capillary_stroke_count: 105, efo_voltage: 60.5 }, history: [], historicalChartData: [] },
    { id: 'WB_009', risk: 5.4, status: 'MARGINAL', currentUnit: 'UNIT-D61M4', liveParams: { ultrasonic_power: 0.85, bond_time: 12.1, loop_height: 140, capillary_stroke_count: 410, efo_voltage: 54.2 }, history: [], historicalChartData: [] }
  ],
  'mold': [
    { id: 'MP_001', risk: 0.8, status: 'OPTIMAL', currentUnit: 'UNIT-E51N5', liveParams: { transfer_pressure: 8.1, clamping_force: 50.5, molding_temperature: 180.5, vacuum_level: 2.1 }, history: [], historicalChartData: [] }
  ],
  'ball-attach': [
    { id: 'BA_003', risk: 1.5, status: 'OPTIMAL', currentUnit: 'UNIT-F41P6', liveParams: { ball_placement_accuracy: 4.2, laser_pulse_energy: 12.1, reflow_peak_temp: 260.1, flux_density: 0.82 }, history: [], historicalChartData: [] }
  ],
  'saw': [
    { id: 'SW_002', risk: 3.2, status: 'OPTIMAL', currentUnit: 'UNIT-G31Q7', liveParams: { spindle_current: 2.05, vibration_amplitude: 0.48, blade_wear_index: 0.32, cooling_water_flow: 1.45 }, history: [], historicalChartData: [] }
  ]
}

// Add dummy history to mock units
Object.values(MOCK_FLEETS).forEach(fleet => {
  fleet.forEach(m => {
    m.history = [
      { id: 1, time: '14:20:01', unit: 'UNIT-X001', risk: m.risk, snapshot: 'Within nominal bounds', action: 'PASS', isHighRisk: m.risk > 7 },
      { id: 2, time: '14:21:45', unit: 'UNIT-X002', risk: m.risk + 0.5, snapshot: 'Slight drift detected', action: 'PASS', isHighRisk: m.risk > 7 }
    ]
    m.historicalChartData = Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      riskScore: m.risk + (Math.random() - 0.5) * 2
    }))
  })
})
