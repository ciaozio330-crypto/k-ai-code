import { useEffect, useRef } from 'react';

export interface VoxelTopographyGridProps {
  tileSize?: number;
  maxHeight?: number;
  primaryColor?: string; // Hex color (e.g., #6366f1)
  wireColor?: string;
  speed?: number;
  className?: string;
  /** Colore di fondo del canvas; va accordato al tema per evitare bande scure. */
  bgColor?: string;
  /** Disattiva il rilievo che segue il cursore (per sfondi puramente decorativi). */
  interactive?: boolean;
  /**
   * Dove cade l'origine della griglia, come frazione dell'altezza.
   *
   * Il valore di partenza (~0.31) tiene il terreno sospeso a metà schermo,
   * e letto in una hero sembra una lastra che galleggia. Spingendo l'origine
   * verso il basso (o oltre 1) la griglia esce dall'inquadratura e restano
   * visibili solo le cime delle colonne che spuntano dal bordo inferiore:
   * si legge come un orizzonte, dà profondità e libera la parte alta per il
   * titolo.
   */
  horizon?: number;
}

export function VoxelTopographyGrid({
  tileSize = 28,
  maxHeight = 70,
  primaryColor = '#6366f1',
  wireColor = 'rgba(129, 140, 248, 0.4)',
  speed = 0.015,
  className = '',
  bgColor = '#020617',
  interactive = true,
  horizon = 1 / 3.2,
}: VoxelTopographyGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Immediate and smooth target coordinates for ultra-low latency tracking
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let time = 0;
    // Ratio between the internal (possibly downscaled) render resolution and the
    // real on-screen CSS size, used to map cursor coordinates into grid space.
    let renderScale = 1;

    // Fast Hex to RGB conversion
    const hexToRgb = (hex: string) => {
      const cleanHex = hex.replace('#', '');
      const bigint = parseInt(
        cleanHex.length === 3
          ? cleanHex.split('').map((c) => c + c).join('')
          : cleanHex,
        16
      );
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
      };
    };

    const baseRgb = hexToRgb(primaryColor);

    // Pre-computed constant side face colors (0 allocations per frame)
    const leftFaceColor = `rgba(${Math.floor(baseRgb.r * 0.45)}, ${Math.floor(baseRgb.g * 0.45)}, ${Math.floor(baseRgb.b * 0.45)}, 0.85)`;
    const rightFaceColor = `rgba(${Math.floor(baseRgb.r * 0.65)}, ${Math.floor(baseRgb.g * 0.65)}, ${Math.floor(baseRgb.b * 0.65)}, 0.85)`;

    // Pre-computed Lookup Table (LUT) for Top Face elevation lighting
    const topColorLUT: string[] = new Array(101);
    for (let i = 0; i <= 100; i++) {
      const ratio = i / 100;
      const r = Math.floor(baseRgb.r * (0.55 + ratio * 0.45));
      const g = Math.floor(baseRgb.g * (0.55 + ratio * 0.45));
      const b = Math.floor(baseRgb.b * (0.55 + ratio * 0.45));
      topColorLUT[i] = `rgb(${r},${g},${b})`;
    }

    // Ambient background: cap the logical render resolution and let the canvas
    // stretch via CSS. Tile count (and thus per-frame draw-call count) scales
    // with width*height, so this keeps cost flat on large/4K/ultrawide screens
    // instead of scaling with the viewport.
    const MAX_RENDER_WIDTH = 1280;
    const MAX_RENDER_HEIGHT = 800;

    // True una volta che `draw` esiste ed è stato eseguito almeno una volta.
    // Serve perché handleResize gira anche prima che `draw` sia definita.
    let started = false;

    const handleResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      renderScale = Math.min(1, MAX_RENDER_WIDTH / cw, MAX_RENDER_HEIGHT / ch);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      width = cw * renderScale;
      height = ch * renderScale;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;

      // setTransform (not scale) so repeated resizes don't compound the scale factor
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Assegnare canvas.width/height azzera la superficie. Se il loop è in
      // pausa — tab in background, canvas fuori schermo, o preferenza
      // "riduci animazioni" — nessuno ridisegnerebbe e resterebbe un
      // rettangolo nero. ResizeObserver scatta sempre una volta al mount,
      // quindi senza questo ridisegno il caso reduced-motion non vedrebbe
      // mai il terreno.
      if (started && !running) draw(performance.now());
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // Event listeners attached to window for smooth off-canvas pointer tracking
    const updatePointerPos = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.targetX = clientX - rect.left;
      mouseRef.current.targetY = clientY - rect.top;
    };

    const handlePointerMove = (e: PointerEvent) => {
      updatePointerPos(e.clientX, e.clientY);
    };

    const handlePointerLeave = () => {
      mouseRef.current.targetX = -1000;
      mouseRef.current.targetY = -1000;
    };

    if (interactive) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      container.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    }

    // Sospende il loop quando il canvas non è visibile.
    //
    // Su una pagina lunga più sfondi voxel coesistono: senza questo, ognuno
    // continuerebbe a disegnare a 30fps anche a schermate di distanza dallo
    // scroll corrente, bruciando CPU e batteria per pixel che nessuno vede.
    // Stesso discorso per la tab in background.
    let onScreen = true;
    let running = false;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        syncLoop();
      },
      { rootMargin: '120px' }
    );
    intersectionObserver.observe(container);

    const handleVisibility = () => syncLoop();
    document.addEventListener('visibilitychange', handleVisibility);

    // Constants for grid iteration
    const tileW = tileSize * 0.866025; // cos(30 deg)
    const tileH = tileSize * 0.5;      // sin(30 deg)
    const maxRadiusSq = 220 * 220;
    const invMaxHeight = 1 / (maxHeight + 55);

    // Respect the user's motion preference: render one static frame instead of looping
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Cap to ~30fps regardless of monitor refresh rate (120Hz+ displays were
    // driving this at 2-3x the intended workload since rAF tracks the display's
    // native rate, not a fixed 60fps).
    const FRAME_INTERVAL = 1000 / 30;
    let lastFrameTime = -Infinity; // ensures the very first frame always draws immediately

    const draw = (now: number) => {
      if (running) {
        animationFrameId = requestAnimationFrame(draw);
        if (now - lastFrameTime < FRAME_INTERVAL) return;
        lastFrameTime = now;
        time += speed;
        // Responsive, smooth lerping cursor tracking
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.32;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.32;
      }

      // mouseRef is tracked in real screen-pixel space (from getBoundingClientRect),
      // but the grid is laid out in the internal (possibly downscaled) render space —
      // rescale so the raised hotspot actually sits under the cursor.
      const mx = mouseRef.current.x * renderScale;
      const my = mouseRef.current.y * renderScale;

      // Background clear
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      const gridCols = Math.ceil(width / tileW) + 4;
      const gridRows = Math.ceil(height / tileH) + 8;

      const originX = width * 0.5;
      const originY = height * horizon;

      const startR = -Math.floor(gridRows / 2);
      const endR = Math.ceil(gridRows / 2);
      const startC = -Math.floor(gridCols / 2);
      const endC = Math.ceil(gridCols / 2);

      // Render loop with Back-to-Front Painter's Algorithm
      for (let r = startR; r < endR; r++) {
        for (let c = startC; c < endC; c++) {
          const isoX = originX + (c - r) * tileW;
          const isoY = originY + (c + r) * tileH;

          // Distance check to mouse target
          const dx = isoX - mx;
          const dy = isoY - my;
          const distSq = dx * dx + dy * dy;

          // Trigonometric Height Wave
          const wave1 = Math.sin(time * 2 + c * 0.25 + r * 0.25);
          const wave2 = Math.cos(time * 1.5 + c * 0.15 - r * 0.3);
          let h = (wave1 + wave2 + 2) * 0.25 * maxHeight;

          if (distSq < maxRadiusSq) {
            const dist = Math.sqrt(distSq);
            const influence = 1 - dist / 220;
            h += influence * influence * 55;
          }

          const py = isoY - h;

          // Fast Screen-Space Culling: Skip rendering voxels completely out of bounds
          if (
            isoX + tileW < 0 ||
            isoX - tileW > width ||
            py + h + 15 < 0 ||
            py - tileH > height
          ) {
            continue;
          }

          // Top Face Vertices
          const topP1Y = py - tileH;
          const topP2X = isoX + tileW;
          const topP3Y = py + tileH;
          const topP4X = isoX - tileW;

          const sideBottomShift = h + 15;

          // --- 1. Left Side Face ---
          ctx.beginPath();
          ctx.moveTo(topP4X, py);
          ctx.lineTo(isoX, topP3Y);
          ctx.lineTo(isoX, topP3Y + sideBottomShift);
          ctx.lineTo(topP4X, py + sideBottomShift);
          ctx.closePath();
          ctx.fillStyle = leftFaceColor;
          ctx.fill();

          // --- 2. Right Side Face ---
          ctx.beginPath();
          ctx.moveTo(isoX, topP3Y);
          ctx.lineTo(topP2X, py);
          ctx.lineTo(topP2X, py + sideBottomShift);
          ctx.lineTo(isoX, topP3Y + sideBottomShift);
          ctx.closePath();
          ctx.fillStyle = rightFaceColor;
          ctx.fill();

          // --- 3. Top Face ---
          ctx.beginPath();
          ctx.moveTo(isoX, topP1Y);
          ctx.lineTo(topP2X, py);
          ctx.lineTo(isoX, topP3Y);
          ctx.lineTo(topP4X, py);
          ctx.closePath();

          // Fast LUT Color Lookup
          const rawLight = h * invMaxHeight;
          const lightRatio = rawLight > 1 ? 1 : rawLight < 0.1 ? 0.1 : rawLight;
          const lutIdx = (lightRatio * 100) | 0;

          ctx.fillStyle = topColorLUT[lutIdx];
          ctx.fill();

          // Wireframe Overlay
          ctx.strokeStyle = wireColor;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    };

    // Avvia o ferma il loop in base a visibilità della tab e del canvas.
    // Definita qui (function declaration) perché viene richiamata dagli
    // observer registrati più sopra, prima di questo punto.
    function syncLoop() {
      const shouldRun = onScreen && !document.hidden && !reduceMotion;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) {
        // Riparte dal frame corrente: senza questo il primo frame dopo una
        // pausa lunga verrebbe scartato dal throttle e la ripresa sembrerebbe
        // bloccata per una frazione di secondo.
        lastFrameTime = -Infinity;
        animationFrameId = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    }

    // Primo frame sempre disegnato, anche con reduced-motion attivo:
    // lo sfondo deve comunque esistere, semplicemente resta statico.
    started = true;
    draw(0);
    syncLoop();

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [tileSize, maxHeight, primaryColor, wireColor, speed, bgColor, interactive, horizon]);

  return (
    <div
      ref={containerRef}
      // Non-interattivo => `pointer-events-none`, altrimenti un canvas di sfondo
      // a tutto schermo intercetterebbe lo scroll touch e i click sui contenuti
      // che gli stanno sopra.
      className={
        'relative w-full h-full overflow-hidden ' +
        (interactive ? 'cursor-pointer ' : 'pointer-events-none ') +
        className
      }
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

export default VoxelTopographyGrid;
