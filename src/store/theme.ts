import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'

function getInitialTheme(): ThemeMode {
  try {
    return uni.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const useThemeStore = defineStore(
  'theme',
  () => {
    const mode = ref<ThemeMode>(getInitialTheme())
    const isDark = computed(() => mode.value === 'dark')

    function setMode(nextMode: ThemeMode) {
      mode.value = nextMode
    }

    return {
      mode,
      isDark,
      setMode,
    }
  },
  {
    persist: true,
  },
)
