<script setup>
const props = defineProps({
  restaurant: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['close']);

const closeModal = () => emit('close');
</script>

<template>
  <div v-if="restaurant" class="modal-backdrop" @click.self="closeModal">
    <div class="modal-card" role="dialog" aria-modal="true">
      <button class="close-button" type="button" aria-label="Close restaurant details" @click="closeModal">
        ×
      </button>

      <div class="modal-header">
        <p class="eyebrow">Recommended Restaurant</p>
        <h2>{{ restaurant.name }}</h2>
      </div>

      <div class="info-grid">
        <div class="detail-block">
          <span class="label">Price</span>
          <strong>${{ restaurant.average_meal_cost }} per person</strong>
        </div>
        <div class="detail-block">
          <span class="label">Cuisine</span>
          <strong>{{ restaurant.cuisine }}</strong>
        </div>
        <div class="detail-block">
          <span class="label">Phone</span>
          <a :href="`tel:${restaurant.phone}`">{{ restaurant.phone }}</a>
        </div>
        <div class="detail-block">
          <span class="label">Address</span>
          <strong>{{ restaurant.address }}</strong>
        </div>
      </div>

      <p class="description">{{ restaurant.description }}</p>

      <div class="links">
        <a v-if="restaurant.website" :href="restaurant.website" target="_blank" rel="noreferrer">Visit Website</a>
        <a v-if="restaurant.menu_url" :href="restaurant.menu_url" target="_blank" rel="noreferrer">View Menu</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.55);
  z-index: 30;
  padding: 1.5rem;
}

.modal-card {
  position: relative;
  width: min(100%, 540px);
  background: #fff;
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 25px 80px rgba(15, 23, 42, 0.25);
}

.close-button {
  position: absolute;
  right: 1rem;
  top: 1rem;
  border: none;
  background: rgba(148, 163, 184, 0.15);
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
}

.modal-header h2 {
  margin: 0.25rem 0 1.25rem;
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  color: #0f172a;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
  font-size: 0.7rem;
  color: #f97316;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.detail-block {
  padding: 0.9rem 1rem;
  background: #f8fafc;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.detail-block strong,
.detail-block a {
  color: #0f172a;
  font-size: 0.95rem;
}

.description {
  margin: 1.25rem 0;
  color: #475569;
  line-height: 1.6;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.links a {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #f97316, #f59e0b);
  color: white;
  font-weight: 700;
  text-decoration: none;
}
</style>
