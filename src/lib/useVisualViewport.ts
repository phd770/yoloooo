import { useEffect } from 'react';

// Mobile keyboards resize the visual viewport, while 100dvh can still describe
// the area behind the keyboard. Keep the composer inside the visible area.
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    let fullHeight = Math.max(window.innerHeight, viewport.height);
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Pinch zoom must magnify the existing layout, not rebuild it at the
        // smaller visual viewport size. Focus zoom is prevented by input CSS.
        if (Math.abs(viewport.scale - 1) > 0.01) return;
        const active = document.activeElement;
        const editing = active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLInputElement && !["checkbox", "radio", "file", "button"].includes(active.type)) ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (!editing) fullHeight = Math.max(fullHeight, viewport.height);
        document.documentElement.toggleAttribute('data-keyboard-open', editing && fullHeight - viewport.height > 140);
        document.documentElement.toggleAttribute('data-compact-height', viewport.height <= 500);
        document.documentElement.style.setProperty('--app-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--app-top', `${viewport.offsetTop}px`);
      });
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('pageshow', apply);
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    document.addEventListener('focusin', apply);
    document.addEventListener('focusout', apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', apply);
      window.removeEventListener('pageshow', apply);
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      document.removeEventListener('focusin', apply);
      document.removeEventListener('focusout', apply);
      document.documentElement.removeAttribute('data-keyboard-open');
      document.documentElement.removeAttribute('data-compact-height');
      document.documentElement.style.removeProperty('--app-height');
      document.documentElement.style.removeProperty('--app-top');
    };
  }, []);
}
