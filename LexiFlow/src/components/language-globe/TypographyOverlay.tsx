import React, { useEffect, useState } from 'react';

interface TypographyOverlayProps {
  parallaxX: number;
  parallaxY: number;
}

interface KeywordItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  floatPhase: number;
  floatPeriod: number;
}

export const TypographyOverlay: React.FC<TypographyOverlayProps> = ({ parallaxX, parallaxY }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animId: number;
    const start = performance.now();
    const tick = (now: number) => {
      setTime((now - start) / 1000);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Keywords defined by benchmark specification and reference calibration
  const keywords: KeywordItem[] = [
    {
      id: 'discover',
      text: 'discover',
      x: 398,
      y: 162,
      fontSize: 38,
      floatPhase: 0.0,
      floatPeriod: 8.5,
    },
    {
      id: 'perceive',
      text: 'perceive',
      x: 268,
      y: 390,
      fontSize: 38,
      floatPhase: 1.8,
      floatPeriod: 9.2,
    },
    {
      id: 'resonate',
      text: 'resonate',
      x: 396,
      y: 626,
      fontSize: 38,
      floatPhase: 3.4,
      floatPeriod: 7.8,
    },
    {
      id: 'articulate',
      text: 'articulate',
      x: 1306,
      y: 222,
      fontSize: 38,
      floatPhase: 2.1,
      floatPeriod: 10.0,
    },
    {
      id: 'transform',
      text: 'transform',
      x: 1414,
      y: 468,
      fontSize: 38,
      floatPhase: 4.2,
      floatPeriod: 8.8,
    },
    {
      id: 'transcend',
      text: 'transcend',
      x: 1272,
      y: 696,
      fontSize: 38,
      floatPhase: 5.5,
      floatPeriod: 9.6,
    },
  ];

  // Micro-floating (max ±3px, period 6~12s)
  const getFloatOffset = (phase: number, period: number) => {
    const angle = (time / period) * Math.PI * 2 + phase;
    return {
      x: Math.cos(angle * 0.8) * 2.5,
      y: Math.sin(angle) * 3.0,
    };
  };

  const centerFloat = getFloatOffset(0, 11.0);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
      }}
    >
      {/* Center Typography: Words Create A Wider You. */}
      <div
        style={{
          position: 'absolute',
          left: `${790 + centerFloat.x}px`,
          top: `${351 + centerFloat.y}px`,
          fontSize: '50px',
          fontWeight: 400,
          lineHeight: 1.18,
          color: 'rgba(255, 255, 255, 0.84)',
          letterSpacing: '0.012em',
          textShadow: '0 0 16px rgba(0, 0, 0, 0.95), 0 0 2px rgba(255, 255, 255, 0.1)',
          whiteSpace: 'pre',
          transform: 'translate(0, 0)',
        }}
      >
        <div>Words</div>
        <div>Create</div>
        <div>A Wider You.</div>
      </div>

      {/* Keywords */}
      {keywords.map((kw) => {
        const float = getFloatOffset(kw.floatPhase, kw.floatPeriod);
        const curX = kw.x + float.x;
        const curY = kw.y + float.y;

        return (
          <div
            key={kw.id}
            style={{
              position: 'absolute',
              left: `${curX}px`,
              top: `${curY}px`,
              fontSize: `${kw.fontSize}px`,
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.85)',
              letterSpacing: '0.015em',
              textShadow: '0 0 12px rgba(0, 0, 0, 0.9), 0 0 2px rgba(255, 255, 255, 0.1)',
              whiteSpace: 'nowrap',
              transform: 'translate(0, -50%)',
              transition: 'transform 0.15s ease-out',
            }}
          >
            {kw.text}
          </div>
        );
      })}
    </div>
  );
};
