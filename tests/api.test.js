import { describe, expect, it } from 'vitest'
import { getRestaurants } from '../server/db.js'

describe('restaurant filtering', () => {
  it('returns only restaurants within the requested cuisine and max spend', () => {
    const restaurants = getRestaurants({ cuisine: 'Italian', maxPrice: 20, partySize: 2 })

    expect(restaurants.length).toBeGreaterThan(0)
    expect(restaurants.every((restaurant) => restaurant.cuisine === 'Italian')).toBe(true)
    expect(restaurants.every((restaurant) => restaurant.average_meal_cost <= 20)).toBe(true)
  })
})
