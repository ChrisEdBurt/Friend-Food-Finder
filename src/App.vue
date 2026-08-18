<script setup>
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="page-shell">
    <RouterView />
  </div>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem clamp(1rem, 4vw, 3rem);
  background:
    radial-gradient(circle at top, rgba(251, 146, 60, 0.18), transparent 35%),
    linear-gradient(90deg, rgba(255, 247, 237, 0.96) 0%, rgba(255, 255, 255, 0.9) 16%, rgba(255, 255, 255, 0.96) 50%, rgba(238, 242, 255, 0.92) 84%, rgba(255, 247, 237, 0.96) 100%);
}
</style>
