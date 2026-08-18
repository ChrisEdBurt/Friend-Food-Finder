<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  restaurants: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['spin-complete']);

const rotation = ref(0);
const isSpinning = ref(false);
const selectedRestaurant = ref(null);

const segmentColors = ['#ff7a59', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5', '#f15bb5', '#00bbf9', '#f4d35e', '#80ed99', '#ff9f1c'];

const wheelBackground = computed(() => {
  const segments = props.restaurants.length;
  if (!segments) return 'transparent';

  const anglePerSegment = 360 / segments;
  const stops = props.restaurants.map((_, index) => {
    const start = index * anglePerSegment;
    const end = (index + 1) * anglePerSegment;
    const color = segmentColors[index % segmentColors.length];
    return `${color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(from -90deg, ${stops.join(', ')})`;
});

const wheelLabelStyle = (index) => {
  const segmentAngle = 360 / props.restaurants.length;
  const midAngle = index * segmentAngle + segmentAngle / 2;
  const labelAngle = midAngle + 90;
  const flipText = midAngle > 90 && midAngle < 270 ? 180 : 0;
  const radius = props.restaurants.length > 10 ? 150 : 180;

  return {
    transform: `translate(-50%, -50%) rotate(${labelAngle}deg) translateY(-${radius}px) rotate(${flipText}deg)`,
  };
};

const spinWheel = () => {
  if (!props.restaurants.length || isSpinning.value) return;

  isSpinning.value = true;
  const chosenIndex = Math.floor(Math.random() * props.restaurants.length);
  const segmentSize = 360 / props.restaurants.length;
  const segmentCenter = (chosenIndex + 0.5) * segmentSize;
  const finalRotation = rotation.value + 360 * 5 + (360 - segmentCenter);

  rotation.value = finalRotation;
  const timeout = window.setTimeout(() => {
    selectedRestaurant.value = props.restaurants[chosenIndex];
    emit('spin-complete', selectedRestaurant.value);
    isSpinning.value = false;
  }, 4500);

  return () => window.clearTimeout(timeout);
};

const wheelStyle = computed(() => ({
  background: wheelBackground.value,
  transform: `rotate(${rotation.value}deg)`,
  transition: isSpinning.value ? 'transform 4.5s cubic-bezier(0.18, 0.8, 0.2, 1)' : 'none',
}));

defineExpose({ spinWheel });
</script>

<template>
  <div class="wheel-wrapper">
    <div class="wheel-stage">
      <div class="wheel-pointer" aria-hidden="true" />
      <div class="wheel" :style="wheelStyle">
        <div v-for="(restaurant, index) in restaurants" :key="restaurant.id" class="wheel-label" :style="wheelLabelStyle(index)">
          <span>{{ restaurant.name }}</span>
        </div>
      </div>
      <button class="spin-button" :disabled="isSpinning" @click="spinWheel">
        {{ isSpinning ? 'Spinning...' : 'Spin Me' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.wheel-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem 0 0.5rem;
}

.wheel-stage {
  position: relative;
  width: min(80vw, 640px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.wheel {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 14px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.wheel-label {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 104px;
  text-align: center;
  font-size: 0.62rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.wheel-label span {
  display: inline-block;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  padding: 0.25rem 0.45rem;
  backdrop-filter: blur(6px);
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.wheel-pointer {
  position: absolute;
  top: -12px;
  left: 50%;
  width: 0;
  height: 0;
  border-left: 18px solid transparent;
  border-right: 18px solid transparent;
  border-top: 32px solid #f97316;
  transform: translateX(-50%);
  z-index: 3;
  filter: drop-shadow(0 8px 16px rgba(249, 115, 22, 0.5));
}

.spin-button {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  border: none;
  border-radius: 50%;
  width: 128px;
  height: 128px;
  background: linear-gradient(135deg, #f97316, #fbbf24);
  color: #fff;
  font-size: 1.15rem;
  font-weight: 700;
  box-shadow: 0 14px 32px rgba(249, 115, 22, 0.35);
  cursor: pointer;
}

.spin-button:disabled {
  cursor: wait;
  opacity: 0.85;
}
</style>
