<template>
  <nav class="admin-nav" aria-label="Administration">
    <RouterLink class="secondary-button" active-class="active" to="/admin/videos">Videos</RouterLink>
    <RouterLink class="secondary-button" active-class="active" to="/admin/tags">Tags</RouterLink>
  </nav>
</template>

<style scoped>
.admin-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.secondary-button.active {
  background: #1a73e8;
  color: #fff;
}
</style>
