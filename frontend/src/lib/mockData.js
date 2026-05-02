import { Cpu, Zap, Thermometer, Microscope, Scissors, CheckCircle } from 'lucide-react';

export const PROCESSES = [
  { id: 'die-bond', name: 'Die Bond', icon: Cpu,
    params: [
      { id: 'force', name: 'Bond Force', unit: 'N', type: 'Unit', min: 4, max: 6, nominal: 5 },
      { id: 'viscosity', name: 'Epoxy Viscosity', unit: 'cP', type: 'Process', min: 400, max: 500, nominal: 450 }
    ]
  },
  { id: 'wire-bond', name: 'Wire Bond', icon: Zap,
    params: [
      { id: 'power', name: 'Ultrasonic Power', unit: 'W', type: 'Unit', min: 70, max: 90, nominal: 80 },
      { id: 'stroke', name: 'Capillary Stroke', unit: 'k', type: 'Drift', min: 30, max: 50, nominal: 40 },
      { id: 'efo', name: 'EFO Voltage', unit: 'V', type: 'Process', min: 100, max: 120, nominal: 110 }
    ]
  },
  { id: 'mold', name: 'Mold', icon: Thermometer,
    params: [
      { id: 'pressure', name: 'Transfer Pressure', unit: 'MPa', type: 'Unit', min: 6, max: 10, nominal: 8 },
      { id: 'temp', name: 'Molding Temp', unit: '°C', type: 'Process', min: 165, max: 185, nominal: 175 }
    ]
  },
  { id: 'ball-attach', name: 'Ball Attach & Laser Mark', icon: Microscope,
    params: [
      { id: 'accuracy', name: 'Placement Acc.', unit: 'µm', type: 'Unit', min: 5, max: 15, nominal: 10 },
      { id: 'peak_temp', name: 'Reflow Peak', unit: '°C', type: 'Process', min: 235, max: 255, nominal: 245 }
    ]
  },
  { id: 'saw', name: 'Saw Singulation', icon: Scissors,
    params: [
      { id: 'vibration', name: 'Vibration', unit: 'G', type: 'Unit', min: 0.1, max: 0.2, nominal: 0.15 },
      { id: 'wear', name: 'Blade Wear', unit: '%', type: 'Drift', min: 20, max: 40, nominal: 30 }
    ]
  },
  { id: 'iol', name: 'IOL Prediction', icon: CheckCircle,
    params: [
      { id: 'confidence', name: 'AI Confidence', unit: '%', type: 'Process', min: 90, max: 100, nominal: 98 }
    ]
  }
];

const generateMockData = () => {
  const data = {};
  
  PROCESSES.forEach(p => {
    const prefix = p.id === 'wire-bond' ? 'WB' : p.id === 'die-bond' ? 'DB' : p.id === 'mold' ? 'MD' : p.id === 'ball-attach' ? 'BA' : p.id === 'saw' ? 'SW' : 'IOL';
    
    // Explicit requested examples for Wire Bond
    const specificNames = p.id === 'wire-bond' ? ['Alpha-01', 'Alpha-02', 'Beta-03', 'Gamma-04', 'Gamma-05'] : ['Unit-A1', 'Unit-A2', 'Unit-B1', 'Unit-B2', 'Unit-C1'];

    data[p.id] = specificNames.map((name, i) => {
      // Machine Personality: 0=Stable, 1=Drifting, 2=Erratic
      const personality = i % 3;
      
      const isHighRisk = personality === 1; // Drifting machines are high risk
      const risk = isHighRisk ? (7.5 + Math.random() * 2).toFixed(1) : (1.0 + Math.random() * 2).toFixed(1);
      
      const liveParams = {};
      p.params.forEach(param => {
         if (isHighRisk && Math.random() > 0.4) {
            liveParams[param.id] = (param.max + (Math.random() * param.max * 0.15)).toFixed(1);
         } else {
            const offset = (Math.random() - 0.5) * (param.max - param.min) * 0.5;
            liveParams[param.id] = (param.nominal + offset).toFixed(1);
         }
      });
      
      const currentUnit = `#MC-${Math.floor(80000 + Math.random()*19999)}-${['A','B','C'][i%3]}`;

      // Generate history
      const history = Array.from({length: 12}).map((_, j) => {
        let histRisk;
        if (personality === 0) histRisk = 1.0 + Math.random() * 2; // Stable
        else if (personality === 1) histRisk = 4.0 + (j * 0.5); // Drifting Up
        else histRisk = Math.random() * 9; // Erratic
        
        histRisk = Math.min(10, histRisk);
        const isHistHigh = histRisk >= 7;
        
        const snapshotStr = p.params.map(param => {
          const val = isHistHigh ? (param.max * 1.05).toFixed(1) : param.nominal.toFixed(1);
          return `${param.id.substring(0,3).toUpperCase()}:${val}${param.unit}`;
        }).join(' | ');

        const now = new Date();
        now.setMinutes(now.getMinutes() - (j * 20)); // 20 min increments

        return {
           id: `LOG-${Math.floor(Math.random()*900000)}`,
           time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           unit: j === 0 ? currentUnit : `#MC-${Math.floor(80000 + Math.random()*19999)}-${['A','B','C'][(i+j)%3]}`,
           risk: histRisk,
           snapshot: snapshotStr,
           action: isHistHigh ? 'Flagged for Inspection' : 'Passed',
           isHighRisk: isHistHigh
        }
      });

      // Generate 24-hour historical trend graph data
      const historicalChartData = Array.from({length: 24}).map((_, j) => {
         const pastTime = new Date();
         pastTime.setHours(pastTime.getHours() - (23 - j));
         
         let histRiskScore;
         if (personality === 0) histRiskScore = 1.5 + (Math.random() * 1); // Stable
         else if (personality === 1) histRiskScore = 2.0 + (j * 0.3); // Drifting Up
         else histRiskScore = Math.sin(j / 2) * 4 + 5; // Sine wave erratic
         
         histRiskScore = Math.max(0, Math.min(10, histRiskScore));
         
         return {
           time: pastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           riskScore: parseFloat(histRiskScore.toFixed(1))
         }
      });

      return {
        id: `${prefix}-${name}`,
        risk: parseFloat(risk),
        status: isHighRisk ? 'CRITICAL DRIFT' : parseFloat(risk) > 4 ? 'MARGINAL WARNING' : 'OPTIMAL',
        currentUnit,
        liveParams,
        history,
        historicalChartData
      };
    });
  });
  return data;
};

export const MOCK_FLEETS = generateMockData();
