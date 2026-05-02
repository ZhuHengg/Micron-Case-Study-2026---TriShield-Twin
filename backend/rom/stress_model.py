import numpy as np
from .config import GRID_SIZE, NOMINAL

def gaussian_hotspot(X, Y, cx, cy, sigma, amplitude):
    """Single 2D Gaussian centered at (cx, cy)."""
    return amplitude * np.exp(-((X - cx)**2 + (Y - cy)**2) / (2 * sigma**2))

def compute_stress_field(params: dict) -> np.ndarray:
    """
    Maps 23 process parameters to a 50x50 von Mises stress grid.
    Uses superposition of Gaussian "hotspots" at physically meaningful locations.
    
    Args:
        params: dict with keys matching CSV columns
    
    Returns:
        stress_field: np.ndarray of shape (50, 50), values in MPa
    """
    # Create coordinate grid [0, 1] x [0, 1]
    x = np.linspace(0, 1, GRID_SIZE)
    y = np.linspace(0, 1, GRID_SIZE)
    X, Y = np.meshgrid(x, y)
    
    grid = np.zeros((GRID_SIZE, GRID_SIZE))
    
    # Baseline residual stress (uniform)
    grid += 20.0
    
    # =============================================================
    # Stage 1 — Die Bond: Stress concentrates at die center and corners
    # =============================================================
    force_dev = abs(params.get('bond_force', 30.0) - NOMINAL['bond_force']) / 5.0
    offset_norm = params.get('xy_placement_offset', 0.0) / 15.0
    blt_dev = abs(params.get('bond_line_thickness', 25.0) - NOMINAL['bond_line_thickness']) / 7.0
    epoxy_dev = abs(params.get('epoxy_viscosity', 5000) - 5000) / 1000.0
    pps_dev = abs(params.get('pick_place_speed', 8000) - 8000) / 2000.0
    
    amp_center = force_dev * 35.0 + epoxy_dev * 8.0
    amp_corners = offset_norm * 25.0 + blt_dev * 18.0
    
    # Center hotspot
    grid += gaussian_hotspot(X, Y, 0.5, 0.5, 0.18, amp_center)
    # 4 corners (die edges) — offset shifts the stress pattern asymmetrically
    shift = offset_norm * 0.05  # slight asymmetry from placement offset
    grid += gaussian_hotspot(X, Y, 0.2 + shift, 0.2, 0.09, amp_corners)
    grid += gaussian_hotspot(X, Y, 0.8 - shift, 0.2, 0.09, amp_corners * 0.9)
    grid += gaussian_hotspot(X, Y, 0.2 + shift, 0.8, 0.09, amp_corners * 0.95)
    grid += gaussian_hotspot(X, Y, 0.8, 0.8, 0.09, amp_corners)
    # Pick-place speed affects a diagonal stress band
    grid += gaussian_hotspot(X, Y, 0.35, 0.35, 0.15, pps_dev * 6.0)

    # =============================================================
    # Stage 2 — Wire Bond: Stress along wire bond pad ring
    # =============================================================
    power_dev = abs(params.get('ultrasonic_power', 1.2) - NOMINAL['ultrasonic_power']) / 0.4
    time_dev = abs(params.get('bond_time', 15.0) - 15.0) / 5.0
    loop_dev = abs(params.get('loop_height', 200.0) - 200.0) / 50.0
    wear_norm = params.get('capillary_stroke_count', 0.0) / 500_000.0
    efo_dev = abs(params.get('efo_voltage', 60.0) - 60.0) / 10.0
    
    # Ring of pads — each pad gets a slightly different amplitude based on wear
    n_pads = 8
    for i, angle in enumerate(np.linspace(0, 2*np.pi, n_pads, endpoint=False)):
        cx = 0.5 + 0.35 * np.cos(angle)
        cy = 0.5 + 0.35 * np.sin(angle)
        # Wear makes some pads worse than others (deterministic variation)
        pad_wear_factor = 1.0 + 0.3 * np.sin(i * 1.5)  # varies by pad position
        amp = (power_dev * 20.0 + wear_norm * 28.0 + time_dev * 10.0) * pad_wear_factor
        grid += gaussian_hotspot(X, Y, cx, cy, 0.07, amp)
    
    # Loop height affects a broad vertical stress band (wire sweep risk)
    grid += gaussian_hotspot(X, Y, 0.5, 0.4, 0.25, loop_dev * 12.0)
    # EFO contributes localized stress at bond-foot (bottom center)
    grid += gaussian_hotspot(X, Y, 0.5, 0.7, 0.1, efo_dev * 8.0)

    # =============================================================
    # Stage 3 — Mold: Broad thermal stress + localized void stress
    # =============================================================
    temp_dev = abs(params.get('molding_temperature', 180.0) - NOMINAL['molding_temperature']) / 10.0
    vac_risk = params.get('vacuum_level', 2.0) / 10.0
    press_dev = abs(params.get('transfer_pressure', 8.0) - 8.0) / 2.0
    clamp_dev = abs(params.get('clamping_force', 50.0) - 50.0) / 10.0
    
    # Broad thermal stress (CTE mismatch)
    amp_thermal = temp_dev * 40.0
    grid += gaussian_hotspot(X, Y, 0.5, 0.5, 0.35, amp_thermal)
    
    # Vacuum-driven void stress concentrators (localized spots)
    amp_void = vac_risk * 25.0
    grid += gaussian_hotspot(X, Y, 0.3, 0.4, 0.12, amp_void)
    grid += gaussian_hotspot(X, Y, 0.7, 0.6, 0.1, amp_void * 0.8)
    grid += gaussian_hotspot(X, Y, 0.4, 0.7, 0.08, amp_void * 0.6)
    
    # Transfer pressure → wire sweep risk (horizontal band)
    grid += gaussian_hotspot(X, Y, 0.5, 0.5, 0.3, press_dev * 15.0)
    # Clamping force → edge crush
    grid += gaussian_hotspot(X, Y, 0.1, 0.5, 0.15, clamp_dev * 10.0)
    grid += gaussian_hotspot(X, Y, 0.9, 0.5, 0.15, clamp_dev * 10.0)

    # =============================================================
    # Stage 4 — Ball Attach: Stress at solder ball locations
    # =============================================================
    reflow_dev = abs(params.get('reflow_peak_temp', 260.0) - NOMINAL['reflow_peak_temp']) / 10.0
    ball_err = params.get('ball_placement_accuracy', 0.0) / 25.0
    flux_dev = abs(params.get('flux_density', 0.8) - 0.8) / 0.3
    laser_dev = abs(params.get('laser_pulse_energy', 12.0) - 12.0) / 2.0
    
    # BGA ball grid — 2 rows at bottom
    for cx in np.linspace(0.15, 0.85, 6):
        amp_b = reflow_dev * 30.0 + ball_err * 20.0 + flux_dev * 10.0
        grid += gaussian_hotspot(X, Y, cx, 0.88, 0.07, amp_b)
        grid += gaussian_hotspot(X, Y, cx, 0.78, 0.06, amp_b * 0.7)
    
    # Laser mark stress — localized at top of package
    grid += gaussian_hotspot(X, Y, 0.5, 0.15, 0.1, laser_dev * 12.0)

    # =============================================================
    # Stage 5 — Saw: Edge stress along package perimeter
    # =============================================================
    vib_norm = params.get('vibration_amplitude', 0.0) / 1.5
    blade_wear = params.get('blade_wear_index', 0.0)
    current_dev = abs(params.get('spindle_current', 2.0) - 2.0) / 0.5
    flow_dev = abs(params.get('cooling_water_flow', 1.5) - 1.5) / 0.5
    
    amp_saw = vib_norm * 22.0 + blade_wear * 30.0 + current_dev * 15.0
    
    # 4 edges with different widths (narrower = more localized saw damage)
    grid += gaussian_hotspot(X, Y, 0.5, 0.02, 0.08, amp_saw)       # Top kerf
    grid += gaussian_hotspot(X, Y, 0.5, 0.98, 0.08, amp_saw * 0.9) # Bottom kerf
    grid += gaussian_hotspot(X, Y, 0.02, 0.5, 0.08, amp_saw * 0.85)# Left kerf
    grid += gaussian_hotspot(X, Y, 0.98, 0.5, 0.08, amp_saw)       # Right kerf
    
    # Cooling flow affects thermal gradient at edges
    grid += gaussian_hotspot(X, Y, 0.5, 0.0, 0.15, flow_dev * 8.0)
    grid += gaussian_hotspot(X, Y, 0.5, 1.0, 0.15, flow_dev * 8.0)
    
    # Corner chipping (blade wear × vibration interaction)
    chip_amp = blade_wear * vib_norm * 45.0
    grid += gaussian_hotspot(X, Y, 0.05, 0.05, 0.06, chip_amp)
    grid += gaussian_hotspot(X, Y, 0.95, 0.05, 0.06, chip_amp)
    grid += gaussian_hotspot(X, Y, 0.05, 0.95, 0.06, chip_amp)
    grid += gaussian_hotspot(X, Y, 0.95, 0.95, 0.06, chip_amp)

    return np.clip(grid, 0, 300)
