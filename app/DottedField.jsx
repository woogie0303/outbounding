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
        for (let row = -4; row < height / 30 + 5; row++) {
          ctx.beginPath();
          for (let x = -3; x <= width + 5; x += 9) {
            const angle = x / Math.max(320, width) * 4 + row * .07;
            let y = row * 30 + Math.sin(angle + .14 * Math.sin(phase)) * 48 + Math.cos(x / 220 + phase) * 3;
            if (touch) {
              const distance = Math.hypot(x - touch.x, y - touch.y);
              const age = (time - touch.start) / 1400;
              y += Math.exp(-distance * distance / 14000) * Math.sin(age * 6 - distance / 55) * (1 - age) * 9;
            }
            ctx.moveTo(x + 1, y);
            ctx.arc(x, y, 1, 0, Math.PI * 2);
          }
          ctx.fillStyle = 'rgba(86,101,128,.26)';
          ctx.fill();
        }
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
