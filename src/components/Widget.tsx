import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, ArrowRightLeft, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { CaptchaState, getApiUrl } from '../types';

interface WidgetProps {
  siteKey: string;
  theme: 'light' | 'dark' | 'auto';
  parentOrigin: string;
}

export function Widget({ siteKey, theme: initialTheme, parentOrigin }: WidgetProps) {
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState<CaptchaState>({
    isVerifying: false,
    isVerified: false,
    error: null,
    score: 100,
    token: null,
    challengeActive: false,
  });

  // Extract real parent page hostname from parentOrigin parameter rather than using iframe's local hostname
  const getParentHostname = () => {
    if (!parentOrigin || parentOrigin === '*') {
      return 'localhost';
    }
    try {
      const url = new URL(parentOrigin);
      return url.hostname;
    } catch (e) {
      // Fallback: If URL parsing fails, clean up protocol to isolate hostname
      const cleaned = parentOrigin.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
      return cleaned || 'localhost';
    }
  };

  // Extract custom backend API origin if passed as a query string parameter to support third-party CDN / Static Worker environments
  const getBackendOrigin = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const backend = params.get('backend');
      if (backend) {
        const clean = backend.replace(/\/$/, ''); // Remove trailing slash
        const lower = clean.toLowerCase();
        if (lower.includes('workers.dev') || lower.includes('humancheck')) {
          return 'https://ais-pre-kckrycxlhocj4lcjts6v3u-817894283024.asia-east1.run.app';
        }
        return clean;
      }
    } catch (e) {
      console.warn('Failed to parse backend origin parameter:', e);
    }
    return '';
  };

  // Behavioral metrics recording
  const mousePoints = useRef<{ x: number; y: number; t: number }[]>([]);
  const loadTime = useRef<number>(Date.now());
  const hasFocused = useRef<boolean>(true);
  const scrollActivites = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Puzzle State variables
  const [puzzleProgress, setPuzzleProgress] = useState<number>(0);
  const [puzzleTarget, setPuzzleTarget] = useState<number>(65); // target position percent
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const sliderPathLength = useRef<number>(0);
  const sliderPoints = useRef<{ x: number; t: number }[]>([]);

  // Setup theme styling
  useEffect(() => {
    if (initialTheme === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setActualTheme(isDark ? 'dark' : 'light');
    } else {
      setActualTheme(initialTheme === 'dark' ? 'dark' : 'light');
    }
  }, [initialTheme]);

  // Record mouse trace inside widget scope
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePoints.current.push({
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
      });
      // Limit to 400 points to avoid memory lag
      if (mousePoints.current.length > 400) {
        mousePoints.current.shift();
      }
    };

    const handleFocus = () => { hasFocused.current = true; };
    const handleBlur = () => { hasFocused.current = false; };
    
    // Track scroll events on parent/window when capturing focus
    const handleScroll = () => {
      scrollActivites.current += 1;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('scroll', handleScroll);

    // Randomize puzzle Target shape placement
    setPuzzleTarget(Math.floor(Math.random() * 45) + 35); // 35% to 80% range

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Post dynamic iframe container size update up to host
  const triggerResize = (height: number) => {
    if (window.parent) {
      window.parent.postMessage({ type: 'humancheck-resize', height }, parentOrigin || '*');
    }
  };

  // Analyze recorded points vectors to discover synthetic or straight trajectories
  const analyzeBehavior = () => {
    const points = mousePoints.current;
    const duration = Date.now() - loadTime.current;

    let totalLength = 0;
    let speedVariance = 0;
    let isLinear = true;
    let jitters = 0;

    if (points.length >= 3) {
      const velocities: number[] = [];
      const slopes: number[] = [];

      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = (points[i].t - points[i - 1].t) || 1;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        totalLength += dist;
        velocities.push(dist / dt);

        if (dx !== 0) {
          slopes.push(dy / dx);
        }
      }

      // 1. Linearity audit: check slope variance
      if (slopes.length > 1) {
        const meanSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
        const slopeVar = slopes.reduce((acc, s) => acc + Math.pow(s - meanSlope, 2), 0) / slopes.length;
        // Perfect line has zero/near-zero slope variance
        isLinear = slopeVar < 0.02;
      }

      // 2. Velocity fluctuations (Human cursor movements constantly accelerate/decelerate)
      if (velocities.length > 1) {
        const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
        speedVariance = velocities.reduce((acc, v) => acc + Math.pow(v - avgVel, 2), 0) / velocities.length;
      }

      // 3. Shake/Jitter calculation
      for (let i = 2; i < points.length; i++) {
        const d1 = { x: points[i-1].x - points[i-2].x, y: points[i-1].y - points[i-2].y };
        const d2 = { x: points[i].x - points[i-1].x, y: points[i].y - points[i-1].y };
        // Check dot product to find rapid sharp shifts in vector coordinates
        const dot = d1.x * d2.x + d1.y * d2.y;
        const mag1 = Math.sqrt(d1.x * d1.x + d1.y * d1.y);
        const mag2 = Math.sqrt(d2.x * d2.x + d2.y * d2.y);
        if (mag1 > 0 && mag2 > 0) {
          const cosTheta = dot / (mag1 * mag2);
          if (cosTheta < -0.6) { // sharp change of direction (>120 degrees)
            jitters++;
          }
        }
      }
    }

    return {
      mousePathLength: Math.round(totalLength),
      mousePointsCount: points.length,
      speedVariance: parseFloat(speedVariance.toFixed(4)),
      isLinear,
      mouseJitters: jitters,
      timeSpentMs: duration,
      hadFocus: hasFocused.current,
    };
  };

  // Send verification request to API and handle outcomes
  const verifyRequest = async (behaviorOverride?: any) => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));

    const metricsSnapshot = behaviorOverride || analyzeBehavior();

    try {
      const backendOrigin = getBackendOrigin();
      const fetchUrl = backendOrigin
        ? `${backendOrigin}/api/captcha/verify-behavior`
        : getApiUrl('/api/captcha/verify-behavior');

      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey,
          behaviorMetrics: metricsSnapshot,
          originHostname: getParentHostname(),
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        data = { error: text || 'Gagal memproses respons verifikasi CAPTCHA dari server.' };
      }

      if (!res.ok) {
        throw new Error(data.error || 'Autentikasi CAPTCHA gagal.');
      }

      // Evaluated score outcomes
      if (data.success) {
        // Direct Pass
        setState({
          isVerifying: false,
          isVerified: true,
          error: null,
          score: data.score,
          token: data.token,
          challengeActive: false,
        });
        
        // Notify Parent window of success
        if (window.parent) {
          window.parent.postMessage({
            type: 'humancheck-verified',
            token: data.token,
          }, parentOrigin || '*');
        }
        
        // Reset element height back to thin bar
        triggerResize(80);
      } else {
        // Fallback to interactive Sliding Jigsaw challenge if automatic score fails and challenge wasn't just solved
        if (metricsSnapshot.challengeType !== 'puzzle') {
          // Trigger Sliding Jigsaw interactive modal
          setState(prev => ({
            ...prev,
            isVerifying: false,
            score: data.score,
            challengeActive: true,
          }));
          triggerResize(300); // taller window for rendering puzzle challenge slider
        } else {
          // Complete fail after failed puzzle validation
          setState({
            isVerifying: false,
            isVerified: false,
            error: 'Verifikasi Gagal: Anda terdeteksi sebagai Bot.',
            score: data.score,
            token: null,
            challengeActive: false,
          });
          triggerResize(80);
        }
      }
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: err.message || 'Gagal tersambung ke server verifikasi.',
      }));
      triggerResize(80);
    }
  };

  const handleCheckboxClick = () => {
    if (state.isVerified || state.isVerifying || state.challengeActive) return;
    verifyRequest();
  };

  // Slider Mouse/Touch drag triggers
  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    setIsSliding(true);
    sliderPathLength.current = 0;
    sliderPoints.current = [];
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    sliderPoints.current.push({ x: clientX, t: Date.now() });
  };

  const handleDragUpdate = (e: MouseEvent | TouchEvent) => {
    if (!isSliding) return;
    
    // Find slider position container width
    const sliderBarWidth = 220; // approximate pixels
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    const startPoint = sliderPoints.current[0];
    if (!startPoint) return;

    const diff = clientX - startPoint.x;
    // Map to percentage (0 - 100)
    let percent = Math.max(0, Math.min(100, Math.round((diff / sliderBarWidth) * 100)));
    setPuzzleProgress(percent);

    sliderPoints.current.push({ x: clientX, t: Date.now() });
    sliderPathLength.current += Math.abs(clientX - (sliderPoints.current[sliderPoints.current.length - 2]?.x || clientX));
  };

  const handleEndDrag = () => {
    if (!isSliding) return;
    setIsSliding(false);

    // Validate slider trajectory heuristics & margin of error placement
    // Human standard precision offset vs puzzle slide circular lock key target
    const diffOffset = Math.abs(puzzleProgress - puzzleTarget);
    const passedAlignment = diffOffset <= 4; // 4% tolerance window

    // Analyze slider speed variation
    let isHumanVelocity = true;
    if (sliderPoints.current.length > 5) {
      const velocities: number[] = [];
      for (let i = 1; i < sliderPoints.current.length; i++) {
        const dx = Math.abs(sliderPoints.current[i].x - sliderPoints.current[i-1].x);
        const dt = (sliderPoints.current[i].t - sliderPoints.current[i-1].t) || 1;
        velocities.push(dx / dt);
      }
      const sum = velocities.reduce((a, b) => a + b, 0);
      const avg = sum / velocities.length;
      const variance = velocities.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / velocities.length;
      
      // If motion is mechanically continuous with zero acceleration shifts, flag bot
      if (variance < 0.005) {
        isHumanVelocity = false;
      }
    }

    const behaviorData = analyzeBehavior();

    // Re-verify payload with challenge outcome
    verifyRequest({
      ...behaviorData,
      challengeType: 'puzzle',
      challengePassed: passedAlignment && isHumanVelocity,
    });
  };

  // Register listener for global dragging
  useEffect(() => {
    if (isSliding) {
      window.addEventListener('mousemove', handleDragUpdate);
      window.addEventListener('mouseup', handleEndDrag);
      window.addEventListener('touchmove', handleDragUpdate, { passive: true });
      window.addEventListener('touchend', handleEndDrag);
    } else {
      window.removeEventListener('mousemove', handleDragUpdate);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleDragUpdate);
      window.removeEventListener('touchend', handleEndDrag);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragUpdate);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleDragUpdate);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, [isSliding, puzzleProgress]);

  // UI styling depending on theme settings
  const containerClasses = actualTheme === 'dark'
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-850';

  const checkboxBorder = state.isVerified
    ? 'border-emerald-500 bg-emerald-300/10'
    : state.error
      ? 'border-rose-500'
      : actualTheme === 'dark'
        ? 'border-slate-600 hover:border-slate-500 bg-slate-800'
        : 'border-slate-300 hover:border-blue-600 bg-slate-50';

  return (
    <div id="humancheck-widget-frame" ref={containerRef} className={`w-full max-w-[300px] select-none rounded-lg p-3 font-sans transition-all duration-300 border ${containerClasses}`}>
      
      {/* 1. Main Checkbox Row */}
      <div className="flex items-center justify-between h-[52px]">
        <div className="flex items-center gap-3">
          <div 
            id="hc-checkbox"
            onClick={handleCheckboxClick}
            className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition-all duration-200 shadow-xs ${checkboxBorder}`}
          >
            {state.isVerifying ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : state.isVerified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-scale-in" />
            ) : state.error ? (
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-transparent hover:bg-blue-600/50 transition-all" />
            )}
          </div>
          
          <div className="flex flex-col">
            <span 
              id="hc-status-text"
              onClick={handleCheckboxClick}
              className={`text-sm font-medium cursor-pointer ${
                state.isVerified ? 'text-emerald-500' : state.error ? 'text-rose-500' : ''
              }`}
            >
              {state.isVerified 
                ? 'Saya Manusia' 
                : state.isVerifying 
                  ? 'Menganalisis...' 
                  : state.error 
                    ? 'Gagal Verifikasi' 
                    : 'Saya bukan bot'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-tight leading-none mt-0.5">
              HumanCheck Behavioural Engine
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end justify-center pr-1 opacity-80">
          <div className="flex items-center gap-1">
            <ShieldCheck className={`w-4 h-4 ${state.isVerified ? 'text-emerald-500' : 'text-blue-600 animate-pulse'}`} />
            <span className="text-xs font-bold font-sans tracking-wide">HumanCheck</span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">Privasi Aman</span>
        </div>
      </div>

      {/* 2. Error Prompt */}
      {state.error && (
        <div className="mt-1 text-[11px] text-rose-500 font-medium px-1 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-rose-500" />
          {state.error}
        </div>
      )}

      {/* 3. Sliding Jigsaw Challenge overlay */}
      {state.challengeActive && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-705/30 flex flex-col items-center gap-2 animate-fade-in">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-bounce" /> Tantangan Perilaku Manusia:
            </span>
            <button 
              onClick={() => {
                setPuzzleTarget(Math.floor(Math.random() * 45) + 35);
                setPuzzleProgress(0);
              }}
              className="text-[10px] text-slate-400 hover:text-slate-650 flex items-center gap-0.5"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Acak
            </button>
          </div>
          
          <p className="text-[11px] text-slate-500 w-full text-left font-sans mt-[-4px]">
            Geser slider ke arah lingkaran target untuk mencocokkan bentuk.
          </p>

          {/* Canvas area representing puzzle slot */}
          <div className="w-full h-16 rounded-md relative bg-slate-100 border border-slate-200 overflow-hidden flex items-center">
            {/* Guide Grid backdrop */}
            <div className="absolute inset-0 grid grid-cols-12 opacity-5 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-slate-405 h-full" />
              ))}
            </div>

            {/* Target Ring */}
            <div 
              style={{ left: `${puzzleTarget}%` }}
              className="absolute w-8 h-8 rounded-full border-2 border-dashed border-blue-500/80 bg-blue-500/10 flex items-center justify-center transform -translate-x-1/2 transition-colors duration-200"
            >
              <div className="w-3 h-3 rounded-full bg-blue-500/20" />
            </div>

            {/* Draggable Circle Jigsaw Piece */}
            <div 
              style={{ left: `${puzzleProgress}%` }}
              className={`absolute w-8 h-8 rounded-full border-2 transform -translate-x-1/2 flex items-center justify-center shadow-md cursor-grab transition-transform duration-100 ${
                isSliding 
                  ? 'border-blue-500 bg-blue-600/35 scale-110 cursor-grabbing' 
                  : Math.abs(puzzleProgress - puzzleTarget) <= 4
                    ? 'border-emerald-500 bg-emerald-500/20'
                    : 'border-slate-400 bg-slate-200/50'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-600 opacity-80" />
            </div>
          </div>

          {/* Touch Draggable Sliding Handle bottom bar */}
          <div className="w-full mt-1">
            <div 
              onMouseDown={handleStartDrag}
              onTouchStart={handleStartDrag}
              className="w-full h-8 rounded-full bg-slate-100 border border-slate-200 relative cursor-grab flex items-center"
            >
              <div className="absolute inset-x-0 text-center pointer-events-none text-[10px] text-slate-400 font-medium">
                Sentuh &amp; Geser Kesini
              </div>
              <div 
                style={{ width: `${puzzleProgress}%` }}
                className="h-full rounded-l-full bg-blue-500/15 border-r border-blue-500/40 pointer-events-none"
              />
              <div 
                style={{ left: `calc(${puzzleProgress}% - 14px)` }}
                className="absolute w-7 h-7 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 border border-blue-400 shadow-sm flex items-center justify-center cursor-grab"
              >
                <div className="w-2.5 h-1 bg-white/70 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
