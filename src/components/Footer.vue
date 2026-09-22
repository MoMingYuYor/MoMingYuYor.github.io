<script setup lang="ts">
import { site } from '../content/site'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-inner">
      <p class="footer-copy">© {{ year }} {{ site.identity.displayName }}. ALL RIGHTS RESERVED.</p>
      <p v-if="site.status === 'demo'" class="footer-note">内容与图片为示意</p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--border);
  padding-block: 32px;
}

.footer-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.footer-copy {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}
</style>
