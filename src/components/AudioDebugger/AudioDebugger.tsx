import React, { useEffect, useRef, useState } from 'react';
import './AudioDebugger.css';
import { engine } from '../../lib/AudioEngine';
import { readTriggerSettingsStorage, writeTriggerSettingsStorage } from '../../lib/triggerSettings';

interface AudioDebuggerProps {
  onClose: () => void;
}

const BANDS = [
  { name: 'SubBass', start: 0, end: 1, color: '#ff3366', key: 'subBass' },
  { name: 'Bass', start: 2, end: 3, color: '#ff6633', key: 'bass' },
  { name: 'LowMid', start: 4, end: 7, color: '#ffcc00', key: 'lowMid' },
  { name: 'Mid', start: 8, end: 18, color: '#33cc33', key: 'mid' },
  { name: 'HighMid', start: 19, end: 46, color: '#33cccc', key: 'highMid' },
  { name: 'Presence', start: 47, end: 93, color: '#3366ff', key: 'presence' },
  { name: 'Brilliance', start: 94, end: 186, color: '#9933ff', key: 'brilliance' },
  { name: 'Air', start: 187, end: 372, color: '#ff33cc', key: 'air' }
];

export function AudioDebugger({ onClose }: AudioDebuggerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // DOM Refs for direct updates to avoid React rendering overhead
  const bandBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const bandValuesRef = useRef<(HTMLDivElement | null)[]>([]);
  const triggerBarsEnergyRef = useRef<(HTMLDivElement | null)[]>([]);
  const triggerBarsThreshRef = useRef<(HTMLDivElement | null)[]>([]);

  const isRecordingRef = useRef<boolean>(false);
  const recordingStartTimeRef = useRef<number>(0);
  const recordedDataRef = useRef<number[][]>([]);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'done'>('idle');

  const startRecording = () => {
    setRecordingStatus('recording');
    isRecordingRef.current = true;
    recordedDataRef.current = [];
    recordingStartTimeRef.current = performance.now();
  };

  const lastUpdateTime = useRef<number>(0);

  const [pulseConfig, setPulseConfig] = useState({
    sensitivity: engine.pulseTrigger.sensitivity,
    start: engine.pulseTrigger.bandStart,
    end: engine.pulseTrigger.bandEnd
  });

  const [snareConfig, setSnareConfig] = useState({
    sensitivity: engine.snareTrigger.sensitivity,
    start: engine.snareTrigger.bandStart,
    end: engine.snareTrigger.bandEnd
  });

  const updatePulse = (key: 'sensitivity' | 'start' | 'end' | 'autoTrack', val: number | boolean) => {
    setPulseConfig(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'start' && next.start > next.end) next.end = next.start;
      if (key === 'end' && next.end < next.start) next.start = next.end;
      
      // Update engine immediately
      if (typeof val === 'number') {
        if (key === 'sensitivity') engine.pulseTrigger.sensitivity = val;
        if (key === 'start') engine.pulseTrigger.bandStart = next.start;
        if (key === 'end') engine.pulseTrigger.bandEnd = next.end;
      } else if (key === 'autoTrack') {
        engine.pulseTrigger.autoTrack = val;
      }
      
      // Persist UI manual settings to localStorage
      const settings = readTriggerSettingsStorage();
      settings.Pulse = {
          ...settings.Pulse,
          enabled: engine.pulseTrigger.enabled,
          sensitivity: engine.pulseTrigger.sensitivity,
          bandStart: engine.pulseTrigger.bandStart,
          bandEnd: engine.pulseTrigger.bandEnd,
          pulseStrength: engine.pulseTrigger.pulseStrength,
          autoTrack: engine.pulseTrigger.autoTrack
      };
      writeTriggerSettingsStorage(settings);
      return next;
    });
  };

  const updateSnare = (key: 'sensitivity' | 'start' | 'end', val: number) => {
    setSnareConfig(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'start' && next.start > next.end) next.end = next.start;
      if (key === 'end' && next.end < next.start) next.start = next.end;
      engine.snareTrigger.sensitivity = next.sensitivity;
      engine.snareTrigger.bandStart = next.start;
      engine.snareTrigger.bandEnd = next.end;
      return next;
    });
  };

  useEffect(() => {
    // Listen for Auto-Track updates from AudioEngine
    engine.onAutoTrackUpdate = (start, end, sensitivity) => {
        setPulseConfig(prev => ({ ...prev, start, end, sensitivity }));
    };

    let animationId: number;

    const renderLoop = () => {
      const rawData = engine.getRawFrequencyData();
      const audioData = engine.getAudioData();
      const now = performance.now();
      
      if (!lastUpdateTime.current || now - lastUpdateTime.current > 30) {
         // Direct DOM updates (30fps)
         const vals = [
            audioData.subBass, audioData.bass, audioData.lowMid, audioData.mid,
            audioData.highMid, audioData.presence, audioData.brilliance, audioData.air
         ];
         
         for (let i = 0; i < BANDS.length; i++) {
             const val = vals[i] || 0;
             const widthPercent = Math.min(100, val * 100);
             if (bandBarsRef.current[i]) bandBarsRef.current[i]!.style.width = `${widthPercent}%`;
             if (bandValuesRef.current[i]) bandValuesRef.current[i]!.innerText = val.toFixed(2);
         }

         // Pulse trigger
         const pulseE = Math.min(100, engine.pulseTrigger.lastEvalEnergy * 100);
         const pulseT = Math.min(100, engine.pulseTrigger.lastEvalThresh * 100);
         if (triggerBarsEnergyRef.current[0]) triggerBarsEnergyRef.current[0]!.style.width = `${pulseE}%`;
         if (triggerBarsThreshRef.current[0]) triggerBarsThreshRef.current[0]!.style.left = `${pulseT}%`;

         // Snare trigger
         const snareE = Math.min(100, engine.snareTrigger.lastEvalEnergy * 100);
         const snareT = Math.min(100, engine.snareTrigger.lastEvalThresh * 100);
         if (triggerBarsEnergyRef.current[1]) triggerBarsEnergyRef.current[1]!.style.width = `${snareE}%`;
         if (triggerBarsThreshRef.current[1]) triggerBarsThreshRef.current[1]!.style.left = `${snareT}%`;
         
         lastUpdateTime.current = now;
      }

      // Render canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          
          ctx.clearRect(0, 0, width, height);
          
          // Draw raw bins
          const totalBins = 373; // We only care up to 372 for the defined bands
          const barWidth = width / totalBins;
          
          for (let i = 0; i < totalBins; i++) {
            const value = rawData[i] / 255.0; // 0 to 1
            const barHeight = value * height;
            
            // Find which band this bin belongs to, to color it
            let barColor = 'rgba(255, 255, 255, 0.2)';
            for (const band of BANDS) {
              if (i >= band.start && i <= band.end) {
                barColor = band.color;
                break;
              }
            }
            
            ctx.fillStyle = barColor;
            ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 0.5), barHeight);
          }
        }
      }

      animationId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => { cancelAnimationFrame(animationId); };
  }, []);

  return (
    <div className="audio-debugger-container">
      <div className="audio-debugger-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h3>Audio Frequency Debugger</h3>
            <button 
                onClick={() => updatePulse('autoTrack', !engine.pulseTrigger.autoTrack)} 
                style={{
                   padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                   backgroundColor: engine.pulseTrigger.autoTrack ? '#33cc33' : '#444',
                   color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px',
                   transition: 'background-color 0.3s', fontSize: '12px'
                }}
            >
                {engine.pulseTrigger.autoTrack ? '⚡ 自动鼓点追踪 (开)' : '⚡ 开启自动追踪'}
            </button>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="audio-debugger-canvas-container">
        <canvas 
          ref={canvasRef} 
          width={500} 
          height={120} 
          className="audio-debugger-canvas" 
        />
      </div>
      
      <div className="audio-debugger-bands">
        {BANDS.map((band, i) => {
          return (
            <div key={band.key} className="band-item">
              <div className="band-label" style={{ color: band.color }}>{band.name}</div>
              <div className="band-bar-container">
                <div 
                  ref={el => { bandBarsRef.current[i] = el; }}
                  className="band-bar" 
                  style={{ width: '0%', backgroundColor: band.color }} 
                />
              </div>
              <div ref={el => { bandValuesRef.current[i] = el; }} className="band-value">0.00</div>
            </div>
          )
        })}
      </div>

      <div className="audio-debugger-triggers">
        <h4 style={{ margin: '4px 0', fontSize: '12px', color: '#888' }}>Beat Triggers (Energy vs Threshold)</h4>
        
        <div className="trigger-item">
          <div className="trigger-header">
            <div className="band-label" style={{ color: '#ff3366', width: '90px' }}>Kick ({pulseConfig.start}-{pulseConfig.end})</div>
            <div className="trigger-bar-container">
               <div ref={el => { triggerBarsEnergyRef.current[0] = el; }} className="trigger-bar-energy" style={{ width: '0%' }} />
               <div ref={el => { triggerBarsThreshRef.current[0] = el; }} className="trigger-bar-thresh" style={{ left: '0%' }} />
            </div>
          </div>
          <div className="trigger-controls">
             <label>Sens: <input type="range" min="0.1" max="1.0" step="0.05" value={pulseConfig.sensitivity} onChange={(e) => updatePulse('sensitivity', parseFloat(e.target.value))} /></label>
             <label>Start: <input type="range" min="0" max="372" step="1" value={pulseConfig.start} onChange={(e) => updatePulse('start', parseInt(e.target.value))} /></label>
             <label>End: <input type="range" min="0" max="372" step="1" value={pulseConfig.end} onChange={(e) => updatePulse('end', parseInt(e.target.value))} /></label>
          </div>
        </div>

        <div className="trigger-item">
          <div className="trigger-header">
            <div className="band-label" style={{ color: '#3366ff', width: '90px' }}>Snare ({snareConfig.start}-{snareConfig.end})</div>
            <div className="trigger-bar-container">
               <div ref={el => { triggerBarsEnergyRef.current[1] = el; }} className="trigger-bar-energy" style={{ width: '0%', backgroundColor: '#3366ff' }} />
               <div ref={el => { triggerBarsThreshRef.current[1] = el; }} className="trigger-bar-thresh" style={{ left: '0%' }} />
            </div>
          </div>
          <div className="trigger-controls">
             <label>Sens: <input type="range" min="0.1" max="1.0" step="0.05" value={snareConfig.sensitivity} onChange={(e) => updateSnare('sensitivity', parseFloat(e.target.value))} /></label>
             <label>Start: <input type="range" min="0" max="372" step="1" value={snareConfig.start} onChange={(e) => updateSnare('start', parseInt(e.target.value))} /></label>
             <label>End: <input type="range" min="0" max="372" step="1" value={snareConfig.end} onChange={(e) => updateSnare('end', parseInt(e.target.value))} /></label>
          </div>
        </div>
      </div>
      
      <div className="debugger-hint">
        Press \`~\` key to toggle this panel. The bars show raw FFT (0-372 bins).
      </div>
    </div>
  );
}
