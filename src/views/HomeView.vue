<script setup>
import { computed, ref } from 'vue';
import RestaurantModal from '../components/RestaurantModal.vue';
import RestaurantWheel from '../components/RestaurantWheel.vue';

const cuisines = ['Italian', 'Indian', 'Mexican', 'Japanese', 'Seafood', 'Healthy', 'Chinese', 'Vegetarian', 'Thai', 'Mediterranean', 'American'];
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
const noResults = computed(() => hasSearched.value && restaurants.value.length === 0);

const fetchRestaurants = async () => {
  isLoading.value = true;
  selectedRestaurant.value = null;

  try {
    const params = new URLSearchParams({
      cuisine: form.value.cuisine,
      maxPrice: String(form.value.budget),
      partySize: String(form.value.people),
      maxDistance: String(form.value.distance),
      service: form.value.service,
      minRating: String(form.value.minRating),
    });

    const response = await fetch(`/api/restaurants?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Unable to load restaurants.');
    }

    restaurants.value = await response.json();
    hasSearched.value = true;
  } catch (error) {
    restaurants.value = [];
    hasSearched.value = true;
    console.error(error);
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
