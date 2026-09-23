"use client"

import React, { useState, useEffect, useRef } from 'react';
import { GlobeCanvas } from './GlobeCanvas';
import { TypographyOverlay } from './TypographyOverlay';
import { FilmGrain } from './FilmGrain';

interface LanguageGlobeProps {
  className?: string;
  style?: React.CSSProperties;
  showComparison?: boolean;
  comparisonOpacity?: number;
  translateX?: string | number;
}

export const LanguageGlobe: React.FC<LanguageGlobeProps> = ({
  className,
  style,
  showComparison = false,
  comparisonOpacity = 0.5,
  translateX = '70px',
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.38);

  const txValue = typeof translateX === 'number' ? `${translateX}px` : translateX;

  // Benchmark canvas resolution
  const BENCHMARK_WIDTH = 1774;
  const BENCHMARK_HEIGHT = 887;

  // Responsive scaling to fit wrapper container: scaled up (+34%) and shifted right towards boundary
  useEffect(() => {
    const handleResize = () => {
      const el = wrapperRef.current;
      const curW = el ? el.clientWidth : window.innerWidth;
      const curH = el ? el.clientHeight : window.innerHeight;
      if (curW > 0 && curH > 0) {
        const scaleW = curW / BENCHMARK_WIDTH;
        const scaleH = curH / BENCHMARK_HEIGHT;
        // 放大 34%，让球体更具质感与视觉冲击力
        const fitScale = Math.min(scaleW, scaleH) * 1.34;
        setScale(fitScale);
      }
    };

    handleResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && wrapperRef.current) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(wrapperRef.current);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        position: 'relative',
        zIndex: 30,
        ...style,
      }}
    >
      {/* Scaled Benchmark Container: 居中偏右平移 (translateX)，使右侧关键词 transform 紧贴卡片边界仅留呼吸距离 */}
      <div
        ref={containerRef}
        style={{
          width: `${BENCHMARK_WIDTH}px`,
          height: `${BENCHMARK_HEIGHT}px`,
          position: 'relative',
          transform: `scale(${scale}) translateX(${txValue})`,
          transformOrigin: 'center center',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
          flexShrink: 0,
        }}
      >
        {/* Layer 1-8: Three.js WebGL Canvas (parallax 固定为 0，鼠标接触不再晃动) */}
        <GlobeCanvas parallaxX={0} parallaxY={0} />

        {/* Layer 9-11: Typography Overlay (Keywords + Center Text，固定无晃动) */}
        <TypographyOverlay parallaxX={0} parallaxY={0} />

        {/* Layer 12: Photographic Film Grain (低透明度柔和质感) */}
        <FilmGrain />

        {/* Comparison Overlay with Reference Image */}
        {showComparison && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 90,
              opacity: comparisonOpacity,
              mixBlendMode: 'difference',
            }}
          >
            <img
              src="/reference.png"
              alt="Reference Comparison"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
