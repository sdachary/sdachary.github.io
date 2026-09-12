import { describe, it, expect } from 'vitest'
import { layout, zoneSize, gridFor } from './layout'
import type { ManacitraData } from './types'
import dataJson from '../../public/manacitra/data.json'

const data = dataJson as unknown as ManacitraData

describe('layout geometry', () => {
  it('gridFor wraps rows correctly', () => {
    expect(gridFor(1)).toEqual({ cols: 1, rows: 1 })
    expect(gridFor(4)).toEqual({ cols: 2, rows: 2 })
    expect(gridFor(12)).toEqual({ cols: 4, rows: 3 })
    expect(gridFor(0)).toEqual({ cols: 1, rows: 0 })
  })

  it('zoneSize fits n tiles without overlap (needs room for 1 tile + row headroom)', () => {
    for (const n of [1, 2, 3, 4, 5, 12]) {
      const { w, h } = zoneSize(n)
      expect(w).toBeGreaterThanOrEqual(260)
      expect(h).toBeGreaterThan(58 + 26 + gridFor(n).rows * 120)
    }
  })

  it('places every tile fully inside its zone card', () => {
    const { cards } = layout(data)
    for (const card of cards) {
      for (const tile of card.tiles) {
        expect(tile.x).toBeGreaterThanOrEqual(card.x + 3)
        expect(tile.y).toBeGreaterThanOrEqual(card.y + 3)
        expect(tile.x + tile.w).toBeLessThanOrEqual(card.x + card.w)
        expect(tile.y + tile.h).toBeLessThanOrEqual(card.y + card.h)
      }
    }
  })

  it('never overlaps tiles within the same zone card', () => {
    const { cards } = layout(data)
    for (const card of cards) {
      for (let i = 0; i < card.tiles.length; i++) {
        for (let j = i + 1; j < card.tiles.length; j++) {
          const a = card.tiles[i]
          const b = card.tiles[j]
          const overlapX = a.x < b.x + b.w && b.x < a.x + a.w
          const overlapY = a.y < b.y + b.h && b.y < a.y + a.h
          expect(overlapX && overlapY).toBe(false)
        }
      }
    }
  })

  it('covers every service with exactly one tile', () => {
    const { cards } = layout(data)
    const counts = new Map<string, number>()
    for (const card of cards) {
      for (const tile of card.tiles) {
        counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1)
      }
    }
    const svcIds = data.zones.flatMap(z => z.services.map(s => s.id))
    expect([...counts.keys()].sort()).toEqual([...svcIds].sort())
    expect([...counts.values()].every(n => n === 1)).toBe(true)
  })
})