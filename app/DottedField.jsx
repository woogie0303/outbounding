'use client';
import { useEffect, useRef } from 'react';

export default function DottedField() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const host = canvas.parentElement;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let width, height, frame, touch, last = -Infinity;
    function draw(time) {
      cancelAnimationFrame(frame);
      if (document.hidden) return;
      if (time - last >= 32 || preference.matches) {
        last = time;
        ctx.clearRect(0, 0, width, height);
        const phase = preference.matches ? 0 : time / 6500;
        if (touch && time - touch.start > 1400) touch = null;
        // Match the original lower-right elliptical gradient and its 35px repeats.
        const fieldWidth = width * .99;
        const fieldHeight = height * 1.15;
        const angle = -16 * Math.PI / 180;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        ctx.fillStyle = 'rgba(255,255,255,.94)';
        ctx.beginPath();
        for (let radius = 22; radius < fieldWidth * 1.2; radius += 35) {
          const ry = radius * fieldHeight / (.68 * fieldWidth);
          const step = 7 / Math.max(radius, ry);
          for (let t = Math.PI; t <= Math.PI * 2; t += step) {
            const u = fieldWidth * .18 + radius * Math.cos(t);
            const v = fieldHeight * .5 + ry * Math.sin(t);
            if (Math.abs(u) > fieldWidth / 2 || Math.abs(v) > fieldHeight / 2) continue;
            const x = width * .705 + u * cos - v * sin;
            let y = height * 1.125 + u * sin + v * cos;
            if (x < -2 || x > width + 2 || y < -10 || y > height + 10) continue;
            y += 1.8 * Math.sin(phase + t * 3 + radius / 160);
            if (touch) {
              const distance = Math.hypot(x - touch.x, y - touch.y);
              const age = (time - touch.start) / 1400;
              y += Math.exp(-distance * distance / 10000) * Math.sin(age * 6) * (1 - age) * 8;
            }
            ctx.moveTo(x + .95, y);
            ctx.arc(x, y, .95, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }
      if (!preference.matches) frame = requestAnimationFrame(draw);
    }
    function resize() {
      width = host.clientWidth;
      height = host.clientHeight;
      const scale = Math.min(devicePixelRatio, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      last = -Infinity;
      draw(performance.now());
    }
    function press(event) {
      if (preference.matches || event.target.closest('form,button,a,dialog')) return;
      const box = canvas.getBoundingClientRect();
      touch = { x: event.clientX - box.left, y: event.clientY - box.top, start: performance.now() };
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    preference.addEventListener('change', resize);
    document.addEventListener('visibilitychange', resize);
    host.addEventListener('pointerdown', press);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      preference.removeEventListener('change', resize);
      document.removeEventListener('visibilitychange', resize);
      host.removeEventListener('pointerdown', press);
    };
  }, []);
  return <canvas className="dotted-field" ref={ref} aria-hidden="true" />;
}
