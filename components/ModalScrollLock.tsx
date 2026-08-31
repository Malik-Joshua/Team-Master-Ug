'use client'

import { useEffect } from 'react'

/**
 * Locks background scrolling while any modal overlay is on screen.
 *
 * Without this, tapping or dragging outside a modal on a phone scrolls the
 * page *behind* it, so closing the modal leaves you somewhere completely
 * different from where you started — the "sudden shift" that makes the app
 * feel unstable on mobile.
 *
 * Implemented globally (mounted once in Layout) rather than per-modal because
 * the app has ~30 modals across 15 files that all share the same overlay
 * shape; a MutationObserver catches every one of them, including any added
 * later, with no per-modal wiring to forget.
 *
 * ── Scroll container ──────────────────────────────────────────────────────
 * The page used to scroll at the `<body>` level, which is why this used to
 * lock via the `position: fixed` body technique (iOS Safari ignores
 * `overflow: hidden` on the body itself, so a plain overflow lock didn't
 * work there). Layout.tsx now keeps the header still and scrolls only the
 * `<main data-tm-scroll-root>` region beneath it — the window/body never
 * scrolls anymore. So this locks that element directly instead. A plain
 * `overflow: hidden` on a normal (non-body) element works fine on iOS, so
 * the position-fixed workaround is no longer needed at all.
 */
const MODAL_SELECTORS = [
  '.fixed.inset-0.z-50',      // the common modal overlay
  '.fixed.inset-0.z-40',      // mobile sidebar backdrop
  '.fixed.inset-0[class*="z-["]', // arbitrary z values, e.g. z-[9999]
].join(', ')

export default function ModalScrollLock() {
  useEffect(() => {
    let locked = false

    const getScrollRoot = () => document.querySelector<HTMLElement>('[data-tm-scroll-root]')

    const lock = () => {
      if (locked) return
      const root = getScrollRoot()
      if (!root) return
      root.style.overflow = 'hidden'
      locked = true
    }

    const unlock = () => {
      if (!locked) return
      const root = getScrollRoot()
      if (root) root.style.overflow = ''
      locked = false
    }

    const sync = () => {
      if (document.querySelector(MODAL_SELECTORS)) lock()
      else unlock()
    }

    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      observer.disconnect()
      unlock()
    }
  }, [])

  return null
}
