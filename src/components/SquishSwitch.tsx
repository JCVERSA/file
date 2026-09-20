import React, { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';

import './SquishSwitch.css';

const DEFAULT_SPRING = { type: 'spring' as const, stiffness: 500, damping: 30 };
const FLICK = 0.15;
const SLOP = 4;
const RESIST = 14;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

export interface SquishSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  width?: number;
  height?: number;
  inset?: number;
  trackRadius?: number;
  thumbRadius?: number;
  trackColor?: string;
  trackOnColor?: string;
  thumbColor?: string;
  thumbOnColor?: string;
  maxSquish?: number;
  stretch?: number;
  stiffness?: number;
  damping?: number;
  disabled?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

export default function SquishSwitch({
  checked,
  defaultChecked = false,
  onChange,
  width = 64,
  height = 32,
  inset = 3,
  trackRadius,
  thumbRadius,
  trackColor = '#1e293b',
  trackOnColor = '#38bdf8',
  thumbColor = '#475569',
  thumbOnColor = '#0f172a',
  maxSquish = 0.28,
  stretch = 0.2,
  stiffness = 500,
  damping = 30,
  disabled = false,
  name,
  id: idProp,
  ariaLabel,
  className = '',
  children
}: SquishSwitchProps) {
  const reduce = useReducedMotion();
  const autoId = useId();
  const switchId = idProp ?? autoId;
  const isControlled = checked !== undefined;
  const [on, setOn] = useState(defaultChecked);
  const currentOn = isControlled ? checked : on;
  const onRef = useRef(currentOn);
  onRef.current = currentOn;

  const [held, setHeld] = useState(false);
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const skipClick = useRef(false);
  const animX = useRef<any>(null);
  const animW = useRef<any>(null);

  const thumbD = height - 2 * inset;
  const travel = width - 2 * inset - thumbD;
  const restX = (active: boolean) => inset + (active ? travel : 0);

  const x = useMotionValue(restX(currentOn));
  const w = useMotionValue(thumbD);

  const drag = useRef<{
    id: number;
    startX: number;
    originX: number;
    moved: boolean;
    hist: [number, number][];
  } | null>(null);

  const spring = stiffness === 500 && damping === 30 ? DEFAULT_SPRING : { type: 'spring' as const, stiffness, damping };

  const rest = (targetOn: boolean, v = 0) => {
    const targetX = restX(targetOn);
    if (reduce) {
      x.jump(targetX);
      w.jump(thumbD);
      return;
    }
    animX.current?.stop();
    animW.current?.stop();
    animX.current = animate(x, targetX, { ...spring, velocity: v });
    animW.current = animate(w, thumbD, spring);
  };

  useLayoutEffect(() => {
    if (!drag.current) rest(currentOn);
  }, [currentOn, width, height, inset]);

  const commit = (nextOn: boolean, v = 0) => {
    if (nextOn !== onRef.current) {
      if (!isControlled) setOn(nextOn);
      onChange?.(nextOn);
    }
    rest(nextOn, v);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || drag.current || e.button !== 0) return;
    animX.current?.stop();
    animW.current?.stop();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      originX: x.get(),
      moved: false,
      hist: [[performance.now(), x.get()]]
    };
    setHeld(true);
    if (!reduce) {
      const squished = thumbD * (1 - maxSquish);
      animate(w, squished, { duration: 0.1 });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > SLOP) d.moved = true;
    const raw = d.originX + dx;
    let clamped = clamp(raw, inset, inset + travel);
    let over = 0;
    if (raw < inset) over = raw - inset;
    else if (raw > inset + travel) over = raw - (inset + travel);
    if (over !== 0) {
      const pull = rubberband(over, RESIST);
      clamped += pull;
      if (!reduce) {
        const elong = thumbD * (1 + Math.min(stretch, Math.abs(pull) / 20));
        w.set(elong);
      }
    } else if (!reduce) {
      w.set(thumbD * (1 - maxSquish));
    }
    x.set(clamped);
    d.hist.push([performance.now(), clamped]);
    if (d.hist.length > 5) d.hist.shift();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setHeld(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (!d.moved) {
      skipClick.current = true;
      commit(!onRef.current);
      return;
    }
    skipClick.current = true;
    let v = 0;
    if (d.hist.length >= 2) {
      const [t0, x0] = d.hist[0];
      const [t1, x1] = d.hist[d.hist.length - 1];
      const dt = t1 - t0;
      if (dt > 0 && performance.now() - t1 < 80) v = ((x1 - x0) / dt) * 1000;
    }
    const mid = inset + travel / 2;
    const nowX = x.get();
    let nextOn: boolean;
    if (Math.abs(v) > FLICK * 1000) nextOn = v > 0;
    else nextOn = nowX > mid;
    commit(nextOn, v);
  };

  const onClick = () => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (!disabled) commit(!onRef.current);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      commit(!onRef.current);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      commit(false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      commit(true);
    }
  };

  return (
    <span className="squish-switch-root">
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={currentOn}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        data-on={currentOn ? '' : undefined}
        data-held={held ? '' : undefined}
        className={`squish-switch${className ? ` ${className}` : ''}`}
        style={{
          '--ss-w': `${width}px`,
          '--ss-h': `${height}px`,
          '--ss-inset': `${inset}px`,
          '--ss-thumb': `${thumbD}px`,
          '--ss-r': `${trackRadius ?? height / 2}px`,
          '--ss-thumb-r': `${thumbRadius ?? thumbD / 2}px`,
          '--ss-track': trackColor,
          '--ss-track-on': trackOnColor,
          '--ss-thumb-color': thumbColor,
          '--ss-thumb-on': thumbOnColor
        } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <span ref={trackRef} className="squish-switch__track">
          <motion.span
            ref={thumbRef}
            className="squish-switch__thumb"
            style={{
              x,
              width: w
            }}
          />
        </span>
      </button>
      {name ? <input type="hidden" name={name} value={currentOn ? 'on' : 'off'} /> : null}
      {children ? (
        <label htmlFor={switchId} className="squish-switch__label">
          {children}
        </label>
      ) : null}
    </span>
  );
}
