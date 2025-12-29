<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
import { useAuthStore } from './stores/auth'; // Import Store

const route = useRoute();
const auth = useAuthStore();

// 🔥 RESTORE SESSION ON REFRESH
onMounted(() => {
  if (!auth.user) {
    auth.initializeAuth();
  }
});
</script>

<template>
  <div v-if="route.meta.hideSidebar" class="min-h-screen bg-gray-50">
     <RouterView />
  </div>

  <div v-else class="flex min-h-screen bg-gray-50">
    <Sidebar />

    <main class="flex-1 ml-64 p-8">
      <RouterView />
    </main>
  </div>
</template>