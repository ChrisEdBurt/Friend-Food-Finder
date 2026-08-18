<script setup>
import { computed, ref } from 'vue';
import RestaurantModal from '../components/RestaurantModal.vue';
import RestaurantWheel from '../components/RestaurantWheel.vue';

let restaurantCache = null;
let restaurantCacheTimestamp = 0;

const CACHE_KEY = 'friend-food-finder-restaurants';
const CACHE_TTL = 10 * 60 * 1000;

const cuisines = [
  'Italian',
  'Indian',
  'Mexican',
  'Japanese',
  'Seafood',
  'Healthy',
  'Chinese',
  'Vegetarian',
  'Thai',
  'Mediterranean',
  'American',
];

const distanceOptions = [
  { label: 'Very Close (2km)', value: 2 },
  { label: 'Close (5km)', value: 5 },
  { label: 'Nearby (10km)', value: 10 },
  { label: 'Moderate (20km)', value: 20 },
  { label: 'Any Distance', value: 100 },
];

const serviceOptions = [
  { label: 'Any', value: 'any' },
  { label: 'Dine In', value: 'dine_in' },
  { label: 'Takeaway', value: 'takeaway' },
];

const ratingOptions = [
  { label: 'Any Rating', value: 0 },
  { label: '★★★★★ (5 stars)', value: 5 },
  { label: '★★★★ (4+ stars)', value: 4 },
  { label: '★★★ (3+ stars)', value: 3 },
];

const form = ref({
  people: 2,
  cuisine: 'Italian',
  budget: 25,
  distance: 10,
  service: 'any',
  minRating: 0,
});

const restaurants = ref([]);
const selectedRestaurant = ref(null);
const isLoading = ref(false);
const hasSearched = ref(false);

const noResults = computed(
  () => hasSearched.value && restaurants.value.length === 0,
);

// Hamilton bounding box
const HAMILTON_BOUNDS = {
  south: -37.95,
  west: 174.9,
  north: -37.55,
  east: 175.6,
};

// Hamilton city centre
const HAMILTON_CENTER = {
  lat: -37.787,
  lon: 175.279,
};

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
};

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
};

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
];

const normalizeTag = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

const isChainRestaurant = (name) => {
  const lowerName = (name || '').toLowerCase();

  return commonChains.some((chain) =>
    lowerName.includes(chain),
  );
};

const getQualityScore = (restaurant) => {
  let score = 0;

  if (restaurant.website) score += 3;
  if (restaurant.phone) score += 2;

  if (
    restaurant.address &&
    !restaurant.address.includes('Hamilton, New Zealand')
  ) {
    score += 1;
  }

  if (!isChainRestaurant(restaurant.name)) score += 5;
  if (restaurant.menu_url) score += 1;

  return score;
};

const calculateRating = (qualityScore) => {
  if (qualityScore >= 10) return 5;
  if (qualityScore >= 8) return 4;
  if (qualityScore >= 5) return 3;
  if (qualityScore >= 2) return 2;

  return 1;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const getServiceTypes = (tags) => {
  const services = new Set();

  const dineIn = tags.dine_in;
  const takeaway = tags.takeaway;

  if (dineIn === 'yes') {
    services.add('dine_in');
  }

  if (takeaway === 'yes') {
    services.add('takeaway');
  }

  if (!dineIn && !takeaway) {
    services.add('dine_in');
    services.add('takeaway');
  }

  return services;
};

const matchesCuisine = (selected, restaurantCuisine) => {
  const normalizedSelected = normalizeTag(selected);

  if (!normalizedSelected) {
    return true;
  }

  const aliases =
    cuisineAliases[selected] ?? [normalizedSelected];

  const normalizedRestaurantCuisine =
    normalizeTag(restaurantCuisine || '');

  return aliases.some((alias) =>
    normalizedRestaurantCuisine.includes(alias),
  );
};

const estimateMealCost = (tags, restaurantCuisine) => {
  const rawPrice =
    tags?.price ??
    tags?.['price:currency'] ??
    tags?.['payment:cash'];

  const parsedNumber = Number.parseFloat(
    String(rawPrice || '').replace(/[^0-9.]/g, ''),
  );

  if (Number.isFinite(parsedNumber)) {
    return parsedNumber;
  }

  const normalizedCuisine =
    normalizeTag(restaurantCuisine);

  return defaultMealCosts[normalizedCuisine] ?? 25;
};

const fetchOverpassData = async () => {
  const query = `
    [out:json][timeout:25];

    (
      node["amenity"="restaurant"](
        ${HAMILTON_BOUNDS.south},
        ${HAMILTON_BOUNDS.west},
        ${HAMILTON_BOUNDS.north},
        ${HAMILTON_BOUNDS.east}
      );

      way["amenity"="restaurant"](
        ${HAMILTON_BOUNDS.south},
        ${HAMILTON_BOUNDS.west},
        ${HAMILTON_BOUNDS.north},
        ${HAMILTON_BOUNDS.east}
      );

      relation["amenity"="restaurant"](
        ${HAMILTON_BOUNDS.south},
        ${HAMILTON_BOUNDS.west},
        ${HAMILTON_BOUNDS.north},
        ${HAMILTON_BOUNDS.east}
      );
    );

    out center tags 200;
  `;

  const url = 'https://overpass-api.de/api/interpreter';

  const params = new URLSearchParams({
    data: query,
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(
        `${url}?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (response.status === 429 || response.status === 503) {
        if (attempt === 4) {
          throw new Error(
            `Overpass API rate limited (${response.status})`,
          );
        }

        const waitMs = Math.min(
          1000 * Math.pow(2, attempt),
          15000,
        );

        await new Promise((resolve) =>
          setTimeout(resolve, waitMs),
        );

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Overpass request failed with status ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }

      const waitMs = Math.min(
        1500 * Math.pow(1.5, attempt),
        10000,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, waitMs),
      );
    }
  }

  throw new Error('Unable to load restaurant data.');
};

const getCachedRestaurants = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);

    if (
      !parsed.timestamp ||
      !Array.isArray(parsed.data)
    ) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (
      Date.now() - parsed.timestamp > CACHE_TTL
    ) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn(
      'Unable to read restaurant cache:',
      error,
    );

    return null;
  }
};

const loadRestaurants = async () => {
  const now = Date.now();

  // Check in-memory cache first
  if (
    restaurantCache &&
    now - restaurantCacheTimestamp < CACHE_TTL
  ) {
    return restaurantCache;
  }

  // Check localStorage cache
  const cached = getCachedRestaurants();

  if (cached) {
    restaurantCache = cached;
    restaurantCacheTimestamp = now;

    return cached;
  }

  // Fetch fresh data from Overpass
  const data = await fetchOverpassData();

  const restaurants = (data.elements || [])
    .map((element) => {
      const tags = element.tags || {};

      const latitude = Number(
        element.lat ?? element.center?.lat,
      );

      const longitude = Number(
        element.lon ?? element.center?.lon,
      );

      const cuisineTag =
        tags.cuisine ||
        tags['cuisine:en'] ||
        tags.amenity ||
        'restaurant';

      const website =
        tags.website ||
        tags['contact:website'] ||
        '';

      const menuUrl =
        tags.menu ||
        tags['contact:menu'] ||
        '';

      const phone =
        tags.phone ||
        tags['contact:phone'] ||
        '';

      const name =
        tags.name ||
        'Local Restaurant';

      const address = [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:city'],
      ]
        .filter(Boolean)
        .join(' ') || 'Hamilton, New Zealand';

      const qualityScore = getQualityScore({
        website,
        phone,
        address,
        name,
        menu_url: menuUrl,
      });

      const serviceTypes = getServiceTypes(tags);

      return {
        id: `osm:${element.type}:${element.id}`,
        name,
        cuisine: cuisineTag,

        average_meal_cost: estimateMealCost(
          tags,
          cuisineTag,
        ),

        phone,
        website,
        menu_url: menuUrl,
        address,

        description:
          tags.description ||
          `${name} is a local dining option in Hamilton, New Zealand.`,

        lat: Number.isFinite(latitude)
          ? latitude
          : null,

        lon: Number.isFinite(longitude)
          ? longitude
          : null,

        dine_in: serviceTypes.has('dine_in'),
        takeaway: serviceTypes.has('takeaway'),

        rating: calculateRating(qualityScore),
      };
    })
    .filter(
      (restaurant) =>
        restaurant.name &&
        restaurant.address,
    );

  // Save to in-memory cache
  restaurantCache = restaurants;
  restaurantCacheTimestamp = now;

  // Save to localStorage
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: now,
        data: restaurants,
      }),
    );
  } catch (error) {
    console.warn(
      'Unable to save restaurant cache:',
      error,
    );
  }

  return restaurants;
};

const filterRestaurants = (restaurants) => {
  const {
    cuisine,
    budget,
    people,
    distance,
    service,
    minRating,
  } = form.value;

  return restaurants
    .filter((restaurant) => {
      const cuisineMatches = matchesCuisine(
        cuisine,
        restaurant.cuisine,
      );

      const underBudget =
        restaurant.average_meal_cost <= budget;

      let withinDistance = true;

      if (
        restaurant.lat !== null &&
        restaurant.lon !== null
      ) {
        const restaurantDistance =
          calculateDistance(
            HAMILTON_CENTER.lat,
            HAMILTON_CENTER.lon,
            restaurant.lat,
            restaurant.lon,
          );

        withinDistance =
          restaurantDistance <= distance;
      }

      let serviceMatches = true;

      if (service === 'dine_in') {
        serviceMatches = restaurant.dine_in;
      } else if (service === 'takeaway') {
        serviceMatches = restaurant.takeaway;
      }

      const ratingMatches =
        restaurant.rating >= minRating;

      return (
        cuisineMatches &&
        underBudget &&
        groupBudgetFits &&
        withinDistance &&
        serviceMatches &&
        ratingMatches
      );
    })
    .sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }

      return (
        getQualityScore(b) -
        getQualityScore(a)
      );
    })
    .slice(0, 25);
};

const fetchRestaurants = async () => {
  isLoading.value = true;
  selectedRestaurant.value = null;

  try {
    const allRestaurants =
      await loadRestaurants();

    restaurants.value =
      filterRestaurants(allRestaurants);

    hasSearched.value = true;
  } catch (error) {
    restaurants.value = [];
    hasSearched.value = true;

    console.error(
      'Unable to load restaurants:',
      error,
    );
  } finally {
    isLoading.value = false;
  }
};

const handleSpinComplete = (restaurant) => {
  selectedRestaurant.value = restaurant;
};

const openRestaurantDetails = (restaurant) => {
  selectedRestaurant.value = restaurant;
};
</script>

<template>
  <main class="home-page">
    <!-- Landing Form State -->
    <section v-if="!hasSearched" class="hero-panel centered">
      <div class="form-container">
        <p class="eyebrow">Friend Food Finder</p>
        <h1>Pick the place, not the argument.</h1>
        <p class="subtitle">
          Decide together in seconds with a quick food match based on your group size, budget, and cuisine mood.
        </p>

        <form class="question-form" @submit.prevent="fetchRestaurants">
          <label>
            <span>How many people?</span>
            <input v-model.number="form.people" type="number" min="1" max="12" />
          </label>

          <label>
            <span>What kind of food?</span>
            <select v-model="form.cuisine">
              <option v-for="cuisine in cuisines" :key="cuisine" :value="cuisine">
                {{ cuisine }}
              </option>
            </select>
          </label>

          <label>
            <span>Budget per person</span>
            <input v-model.number="form.budget" type="number" min="10" step="5" />
          </label>

          <label>
            <span>How far to travel?</span>
            <select v-model.number="form.distance">
              <option v-for="opt in distanceOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </label>

          <label>
            <span>Service type</span>
            <select v-model="form.service">
              <option v-for="opt in serviceOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </label>

          <label>
            <span>Minimum rating</span>
            <select v-model.number="form.minRating">
              <option v-for="opt in ratingOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </label>

          <button type="submit" class="primary-button" :disabled="isLoading">
            {{ isLoading ? 'Finding places...' : 'Find my food' }}
          </button>
        </form>
      </div>
    </section>

    <!-- Wheel & Results State -->
    <section v-else class="results-panel">
      <div v-if="noResults" class="empty-state">
        <h2>No restaurants match</h2>
        <p>Try a wider budget or a different cuisine to see more options.</p>
        <button class="secondary-button" @click="hasSearched = false">Back to form</button>
      </div>

      <div v-else class="wheel-and-list">
        <div class="wheel-container">
          <RestaurantWheel :restaurants="restaurants" @spin-complete="handleSpinComplete" />
        </div>

        <div class="restaurant-list">
          <h2>Options</h2>
          <ul>
            <li v-for="restaurant in restaurants" :key="restaurant.id" class="restaurant-item" @click="openRestaurantDetails(restaurant)">
              <div class="item-name">{{ restaurant.name }}</div>
              <div class="item-cuisine">{{ restaurant.cuisine }}</div>
            </li>
          </ul>
          <button class="secondary-button" @click="hasSearched = false">New search</button>
        </div>
      </div>
    </section>
  </main>

  <RestaurantModal :restaurant="selectedRestaurant" @close="selectedRestaurant = null" />
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem;
}

/* Landing Form State */
.hero-panel.centered {
  width: min(600px, 100%);
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.08);
  border-radius: 32px;
  padding: 3rem 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-container {
  width: 100%;
}

.eyebrow {
  margin: 0 0 0.65rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #f97316;
  font-size: 0.72rem;
}

h1 {
  margin: 0;
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 1.05;
  color: #0f172a;
}

.subtitle {
  margin-top: 1rem;
  font-size: 1.08rem;
  color: #475569;
  line-height: 1.6;
}

.question-form {
  margin-top: 2rem;
  display: grid;
  gap: 1rem;
}

.question-form label {
  display: grid;
  gap: 0.45rem;
  font-weight: 600;
  color: #334155;
}

.question-form input,
.question-form select {
  width: 100%;
  border: 1px solid #dbe2f0;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  background: #fff;
  color: #0f172a;
}

.primary-button,
.secondary-button {
  border: none;
  border-radius: 14px;
  padding: 0.9rem 1.2rem;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-button {
  margin-top: 0.5rem;
  background: linear-gradient(135deg, #f97316, #f59e0b);
  color: white;
  box-shadow: 0 12px 24px rgba(249, 115, 22, 0.22);
}

.primary-button:disabled {
  opacity: 0.75;
  cursor: wait;
}

.secondary-button {
  background: rgba(100, 116, 139, 0.1);
  color: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.3);
  margin-top: 1rem;
}

.secondary-button:hover {
  background: rgba(100, 116, 139, 0.2);
}

/* Results State */
.results-panel {
  width: 100%;
  max-width: 1400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.08);
  border-radius: 32px;
  padding: 3rem 2rem;
  text-align: center;
  color: #475569;
  max-width: 500px;
}

.empty-state h2 {
  margin-bottom: 0.5rem;
  color: #0f172a;
}

.wheel-and-list {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  width: 100%;
  align-items: start;
}

.wheel-container {
  display: flex;
  justify-content: center;
}

.restaurant-list {
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 24px;
  padding: 1.5rem;
  max-height: 600px;
  overflow-y: auto;
}

.restaurant-list h2 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  color: #0f172a;
  font-weight: 700;
}

.restaurant-list ul {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.restaurant-item {
  padding: 0.75rem;
  background: rgba(249, 115, 22, 0.05);
  border-radius: 12px;
  border-left: 3px solid #f97316;
  cursor: pointer;
  transition: all 0.2s ease;
}

.restaurant-item:hover {
  background: rgba(249, 115, 22, 0.1);
  transform: translateX(4px);
}

.item-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.9rem;
}

.item-cuisine {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
  text-transform: capitalize;
}

@media (max-width: 1024px) {
  .wheel-and-list {
    grid-template-columns: 1fr;
  }

  .restaurant-list {
    max-height: 300px;
  }
}

@media (max-width: 768px) {
  .home-page {
    padding: 1rem;
  }

  .hero-panel.centered {
    padding: 2rem 1.5rem;
  }
}
</style>
