import express from 'express'

const app = express()
const port = 3001

app.use(express.json())

// Simple in-memory cache with TTL for restaurant data
const cache = {
  data: null,
  timestamp: null,
  ttlMs: 10 * 60 * 1000, // 10 minutes

  isValid() {
    return this.data && this.timestamp && Date.now() - this.timestamp < this.ttlMs
  },

  get() {
    return this.isValid() ? this.data : null
  },

  set(data) {
    this.data = data
    this.timestamp = Date.now()
  },

  clear() {
    this.data = null
    this.timestamp = null
  },
}

const HAMILTON_BOUNDS = {
  south: -37.95,
  west: 174.9,
  north: -37.55,
  east: 175.6,
}

// Hamilton city center coordinates
const HAMILTON_CENTER = {
  lat: -37.787,
  lon: 175.279,
}

// List of common franchise/chain names to deprioritize
const commonChains = [
  'pizza hut',
  'mcdonald',
  'subway',
  'kfc',
  'domino',
  'burger king',
  'wendy',
  'taco bell',
  'popeyes',
  'chipotle',
  'starbucks',
  'muffin break',
  'mi goreng',
  'nando',
  'the warehouse',
]

const isChainRestaurant = (name) => {
  const lowerName = (name || '').toLowerCase()
  return commonChains.some((chain) => lowerName.includes(chain))
}

const getQualityScore = (restaurant) => {
  let score = 0
  if (restaurant.website) score += 3
  if (restaurant.phone) score += 2
  if (restaurant.address && !restaurant.address.includes('Hamilton, New Zealand')) score += 1
  if (!isChainRestaurant(restaurant.name)) score += 5
  if (restaurant.menu_url) score += 1
  return score
}

// Calculate distance between two coordinates in kilometers using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Extract service type from restaurant tags (dine_in, takeaway, or both)
const getServiceTypes = (tags) => {
  const services = new Set()
  const dineIn = tags.dine_in
  const takeaway = tags.takeaway

  // If tags are explicitly set to yes/no, use them
  if (dineIn === 'yes') services.add('dine_in')
  if (takeaway === 'yes') services.add('takeaway')

  // If no explicit tags, assume both are available (most restaurants offer both)
  if (!dineIn && !takeaway) {
    services.add('dine_in')
    services.add('takeaway')
  }

  return services
}

// Calculate a star rating based on quality score (0-5 stars)
const calculateRating = (qualityScore) => {
  // Map quality score to a 5-star rating
  // Quality scores typically range from 0-12
  if (qualityScore >= 10) return 5
  if (qualityScore >= 8) return 4
  if (qualityScore >= 5) return 3
  if (qualityScore >= 2) return 2
  return 1
}

const cuisineAliases = {
  Italian: ['italian', 'pizza', 'pasta'],
  Indian: ['indian', 'curry', 'tandoori'],
  Mexican: ['mexican', 'taco', 'burrito'],
  Japanese: ['japanese', 'sushi', 'ramen'],
  Seafood: ['seafood', 'fish', 'fish_and_chips'],
  Healthy: ['healthy', 'salad', 'vegan', 'vegetarian', 'juice'],
  Chinese: ['chinese', 'dim_sum', 'noodle'],
  Vegetarian: ['vegetarian', 'vegan', 'veggie'],
  Thai: ['thai'],
  Mediterranean: ['mediterranean', 'greek', 'middle_eastern', 'turkish'],
  American: ['american', 'burger', 'bbq'],
}

const defaultMealCosts = {
  italian: 24,
  indian: 26,
  mexican: 20,
  japanese: 22,
  seafood: 33,
  healthy: 22,
  chinese: 18,
  vegetarian: 22,
  thai: 25,
  mediterranean: 28,
  american: 26,
}

const normalizeTag = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')

const matchesCuisine = (selected, restaurantCuisine) => {
  const normalizedSelected = normalizeTag(selected)
  if (!normalizedSelected) return true

  const aliases = cuisineAliases[selected] ?? [normalizedSelected]
  const normalizedRestaurantCuisine = normalizeTag(restaurantCuisine || '')

  return aliases.some((alias) => normalizedRestaurantCuisine.includes(alias))
}

const estimateMealCost = (tags, restaurantCuisine) => {
  const rawPrice = tags?.price ?? tags?.['price:currency'] ?? tags?.['payment:cash']
  const parsedNumber = Number.parseFloat(String(rawPrice || '').replace(/[^0-9.]/g, ''))

  if (Number.isFinite(parsedNumber)) {
    return parsedNumber
  }

  const normalizedCuisine = normalizeTag(restaurantCuisine)
  return defaultMealCosts[normalizedCuisine] ?? 25
}

const fetchOverpassData = async (queryText) => {
  const url = 'https://overpass-api.de/api/interpreter'
  const params = new URLSearchParams({ data: queryText })

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'User-Agent': 'FriendFoodFinder/1.0',
          Accept: 'application/json',
        },
      })

      // Check for rate limit response
      if (response.status === 429 || response.status === 503) {
        if (attempt === 4) {
          throw new Error(
            `API rate limited (${response.status}). Please try again in a few moments.`,
          )
        }
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 15000)
        console.warn(`Rate limited on attempt ${attempt}, waiting ${waitMs}ms...`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }

      if (!response.ok) {
        throw new Error(`Overpass request failed with status ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      if (attempt === 4) {
        throw error
      }

      const waitMs = Math.min(1500 * Math.pow(1.5, attempt), 10000)
      console.warn(`Fetch attempt ${attempt} failed, retrying in ${waitMs}ms...`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
}

const fetchRestaurantsFromApi = async () => {
  // Check cache first
  const cachedData = cache.get()
  if (cachedData) {
    console.log('Using cached restaurant data')
    return cachedData
  }

  const queryText = `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"](${HAMILTON_BOUNDS.south},${HAMILTON_BOUNDS.west},${HAMILTON_BOUNDS.north},${HAMILTON_BOUNDS.east});
      way["amenity"="restaurant"](${HAMILTON_BOUNDS.south},${HAMILTON_BOUNDS.west},${HAMILTON_BOUNDS.north},${HAMILTON_BOUNDS.east});
      relation["amenity"="restaurant"](${HAMILTON_BOUNDS.south},${HAMILTON_BOUNDS.west},${HAMILTON_BOUNDS.north},${HAMILTON_BOUNDS.east});
    );
    out center tags 200;
  `

  const data = await fetchOverpassData(queryText)

  const restaurants = (data.elements || [])
    .map((element) => {
      const tags = element.tags || {}
      const latitude = Number(element.lat ?? element.center?.lat)
      const longitude = Number(element.lon ?? element.center?.lon)
      const cuisineTag = tags.cuisine || tags['cuisine:en'] || tags.amenity || 'restaurant'
      const website = tags.website || tags['contact:website'] || ''
      const menuUrl = tags.menu || tags['contact:menu'] || ''
      const phone = tags.phone || tags['contact:phone'] || ''
      const name = tags.name || 'Local Restaurant'
      const qualityScore = getQualityScore({
        website,
        phone,
        address:
          [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
            .filter(Boolean)
            .join(' ') || 'Hamilton, New Zealand',
        name,
        menu_url: menuUrl,
      })
      const serviceTypes = getServiceTypes(tags)
      const rating = calculateRating(qualityScore)

      return {
        id: `osm:${element.type}:${element.id}`,
        name,
        cuisine: cuisineTag,
        average_meal_cost: estimateMealCost(tags, cuisineTag),
        phone,
        website,
        menu_url: menuUrl,
        address:
          [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
            .filter(Boolean)
            .join(' ') || 'Hamilton, New Zealand',
        description:
          tags.description || `${name} is a local dining option in Hamilton, New Zealand.`,
        lat: Number.isFinite(latitude) ? latitude : null,
        lon: Number.isFinite(longitude) ? longitude : null,
        dine_in: serviceTypes.has('dine_in'),
        takeaway: serviceTypes.has('takeaway'),
        rating: rating,
      }
    })
    .filter((restaurant) => restaurant.name && restaurant.address)
    // Sort by rating first, then by quality score
    .sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating
      }
      return getQualityScore(b) - getQualityScore(a)
    })

  // Cache the results
  cache.set(restaurants)

  return restaurants
}

app.get('/api/restaurants', async (req, res) => {
  const cuisine = String(req.query.cuisine || '')
  const maxPrice = Number(req.query.maxPrice ?? 100)
  const partySize = Number(req.query.partySize ?? 2)
  const maxDistance = Number(req.query.maxDistance ?? 100)
  const service = String(req.query.service || 'any')
  const minRating = Number(req.query.minRating ?? 0)

  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    return res.status(400).json({ error: 'A valid maxPrice is required.' })
  }

  try {
    const restaurants = await fetchRestaurantsFromApi()
    const filteredRestaurants = restaurants.filter((restaurant) => {
      const cuisineMatches = matchesCuisine(cuisine, restaurant.cuisine)
      const underBudget = restaurant.average_meal_cost <= maxPrice
      const groupBudgetFits = restaurant.average_meal_cost * partySize <= maxPrice * partySize

      // Check distance if coordinates are available
      let withinDistance = true
      if (restaurant.lat && restaurant.lon) {
        const distance = calculateDistance(
          HAMILTON_CENTER.lat,
          HAMILTON_CENTER.lon,
          restaurant.lat,
          restaurant.lon,
        )
        withinDistance = distance <= maxDistance
      }

      // Check service type
      let serviceMatches = true
      if (service === 'dine_in') {
        serviceMatches = restaurant.dine_in
      } else if (service === 'takeaway') {
        serviceMatches = restaurant.takeaway
      }

      // Check rating
      const ratingMatches = restaurant.rating >= minRating

      return (
        cuisineMatches &&
        underBudget &&
        groupBudgetFits &&
        withinDistance &&
        serviceMatches &&
        ratingMatches
      )
    })

    return res.json(filteredRestaurants.slice(0, 25))
  } catch (error) {
    console.error('Error fetching restaurants:', error.message)

    // Fallback: try to use stale cache if available
    const staleData = cache.data
    if (staleData) {
      console.warn('API failed, using stale cached data as fallback')
      const filteredRestaurants = staleData.filter((restaurant) => {
        const cuisineMatches = matchesCuisine(cuisine, restaurant.cuisine)
        const underBudget = restaurant.average_meal_cost <= maxPrice
        const groupBudgetFits = restaurant.average_meal_cost * partySize <= maxPrice * partySize

        // Check distance if coordinates are available
        let withinDistance = true
        if (restaurant.lat && restaurant.lon) {
          const distance = calculateDistance(
            HAMILTON_CENTER.lat,
            HAMILTON_CENTER.lon,
            restaurant.lat,
            restaurant.lon,
          )
          withinDistance = distance <= maxDistance
        }

        // Check service type
        let serviceMatches = true
        if (service === 'dine_in') {
          serviceMatches = restaurant.dine_in
        } else if (service === 'takeaway') {
          serviceMatches = restaurant.takeaway
        }

        // Check rating
        const ratingMatches = restaurant.rating >= minRating

        return (
          cuisineMatches &&
          underBudget &&
          groupBudgetFits &&
          withinDistance &&
          serviceMatches &&
          ratingMatches
        )
      })

      return res.json(filteredRestaurants.slice(0, 25))
    }

    return res.status(503).json({
      error: 'Live restaurant data temporarily unavailable. Please try again shortly.',
    })
  }
})

app.listen(port, () => {
  console.log(`Friend Food Finder API listening on http://localhost:${port}`)
})
