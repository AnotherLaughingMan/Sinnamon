import { useEffect, useRef, useState, type ReactNode } from 'react';

type TooltipProps = {
  label: string;
  children: ReactNode;
};

export function Tooltip({ label, children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateTooltipPosition = () => {
      const wrap = wrapRef.current;
      const tooltip = tooltipRef.current;
      if (!wrap || !tooltip) {
        return;
      }

      const spacing = 8;
      const viewportPadding = 12;
      const wrapRect = wrap.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const rightSpace = window.innerWidth - wrapRect.right - viewportPadding;
      const leftSpace = wrapRect.left - viewportPadding;
      const requiredWidth = tooltipRect.width + spacing;

      const nextSide: 'left' | 'right' =
        rightSpace < requiredWidth && leftSpace >= requiredWidth ? 'left' : 'right';
      setSide(nextSide);

      const preferredLeft = nextSide === 'left'
        ? wrapRect.left - tooltipRect.width - spacing
        : wrapRect.right + spacing;
      const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
      const clampedLeft = Math.min(Math.max(preferredLeft, viewportPadding), maxLeft);

      const preferredTop = wrapRect.top + (wrapRect.height / 2) - (tooltipRect.height / 2);
      const maxTop = window.innerHeight - tooltipRect.height - viewportPadding;
      const clampedTop = Math.min(Math.max(preferredTop, viewportPadding), maxTop);

      setTooltipPosition({
        top: clampedTop,
        left: clampedLeft,
      });
    };

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [isOpen, label]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const hideTooltip = () => setIsOpen(false);

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!wrapRef.current?.contains(target)) {
        hideTooltip();
      }
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideTooltip();
      }
    };

    window.addEventListener('pointerdown', handleDocumentPointerDown, true);
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('blur', hideTooltip);
    document.addEventListener('visibilitychange', hideTooltip);
    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      window.removeEventListener('scroll', hideTooltip, true);
      window.removeEventListener('blur', hideTooltip);
      document.removeEventListener('visibilitychange', hideTooltip);
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [isOpen]);

  const canHover = typeof window !== 'undefined'
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : true;

  return (
    <span
      ref={wrapRef}
      className="tooltip-wrap"
      onMouseEnter={() => {
        if (canHover) {
          setIsOpen(true);
        }
      }}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !wrapRef.current?.contains(nextTarget)) {
          setIsOpen(false);
        }
      }}
      onClick={() => setIsOpen(false)}
    >
      {children}
      <span
        ref={tooltipRef}
        className={`tooltip tooltip--${side} ${isOpen ? 'tooltip--open' : ''}`}
        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
        role="tooltip"
        aria-hidden={!isOpen}
      >
        {label}
      </span>
    </span>
  );
}