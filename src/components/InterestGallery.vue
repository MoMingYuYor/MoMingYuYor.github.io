<script setup lang="ts">
import { site } from '../content/site'
import GallerySection from './GallerySection.vue'

defineProps<{ number: string }>()
</script>

<template>
  <GallerySection
    section-id="interests"
    :number="number"
    :heading="site.galleries.interests.heading"
    :intro="site.galleries.interests.intro"
    :aside="site.galleries.interests.aside"
    :items="site.interests"
    variant="interest"
  />
</template>
