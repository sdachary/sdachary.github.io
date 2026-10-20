import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
// `?raw` is unusable here (vitest `css: false` strips the module), so read from
// disk. vitest runs with cwd = project root.
const css = readFileSync(resolve(cwd(), 'src/index.css'), 'utf8')

// Guards the rubric-level fixes that nothing else would catch. Each assertion
// traces to a specific defect: instant anchor jumps, arbitrary z-index values,
// and the iOS-viewport full-screen bug.
describe('frontend audit invariants', () => {
  it('smooth-scrolls anchor navigation', () => {
    expect(css).toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/)
  })

  it('uses the z-index scale instead of arbitrary values', () => {
    expect(css).toMatch(/--z-nav:/)
    expect(css).not.toMatch(/z-index:\s*(9999|100000)\b/)
  })

  it('never sizes a full-screen element with 100vh', () => {
    expect(css).not.toContain('100vh')
  })

  it('keeps the reduced-motion escape hatch for smooth scrolling', () => {
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*scroll-behavior:\s*auto/)
  })
})
