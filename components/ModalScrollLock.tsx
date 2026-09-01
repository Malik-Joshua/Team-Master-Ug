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
 * Uses the `position: fixed` body technique rather than `overflow: hidden`,
 * because iOS Safari ignores `overflow: hidden` on the body — which is
 * exactly where the problem was reported.
 */
const MODAL_SELECTORS = [
  '.fixed.inset-0.z-50',      // the common modal overlay
  '.fixed.inset-0.z-40',      // mobile sidebar backdrop
  '.fixed.inset-0[class*="z-["]', // arbitrary z values, e.g. z-[9999]
].join(', ')

export default function ModalScrollLock() {
  useEffect(() => {
    let locked = false
    let savedScrollY = 0
    // Track the scroll position continuously while unlocked rather than
    // reading it at lock time. Once the body goes `position: fixed` the
    // document collapses to viewport height and the browser clamps
    // window.scrollY to 0, so a value read during that transition can come
    // back as 0 and we'd "restore" the user to the top of the page.
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0
    const trackScroll = () => { if (!locked) lastScrollY = window.scrollY }
    window.addEventListener('scroll', trackScroll, { passive: true })

    const lock = () => {
      if (locked) return
      savedScrollY = lastScrollY
      const body = document.body
      body.style.position = 'fixed'
      body.style.top = `-${savedScrollY}px`
      body.style.left = '0'
      body.style.right = '0'
      body.style.width = '100%'
      body.style.overflow = 'hidden'
      locked = true
    }

    const unlock = () => {
      if (!locked) return
      const body = document.body
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.width = ''
      body.style.overflow = ''
      locked = false
      // While the body was fixed the document collapsed to viewport height, so
      // the browser needs to lay it back out at full height before it will
      // accept the old scroll offset — otherwise the restore clamps to 0 and
      // the user gets thrown back to the top. Reading offsetHeight forces that
      // reflow synchronously; the rAF is a belt-and-braces retry for engines
      // that still haven't settled.
      void body.offsetHeight
      window.scrollTo(0, savedScrollY)
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollY)
        lastScrollY = savedScrollY
      })
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
      window.removeEventListener('scroll', trackScroll)
      unlock()
    }
  }, [])

  return null
}
