import type { AchievementSeriesProgress } from '@/api/achievements'
import { getAchievements } from '@/api/achievements'
import type { UnlockedAchievement } from '@/utils/achievement-unlock'
import { findNewUnlockedAchievements, getCompletedAchievementKeys } from '@/utils/achievement-unlock'
import { computed, ref } from 'vue'

const completedAchievementKeys = ref<Set<string> | null>(null)
const unlockedAchievementQueue = ref<UnlockedAchievement[]>([])
const activeUnlockedAchievement = computed(() => unlockedAchievementQueue.value[0] || null)

export function useAchievementUnlockFeedback() {
  async function syncAchievementUnlocks(shouldNotify: boolean, achievementSnapshot?: AchievementSeriesProgress[]) {
    try {
      const achievements = achievementSnapshot || (await getAchievements())
      const nextKeys = getCompletedAchievementKeys(achievements)
      const previousKeys = completedAchievementKeys.value
      let unlockedCount = 0

      if (shouldNotify && previousKeys) {
        const newUnlockedAchievements = findNewUnlockedAchievements(previousKeys, achievements)
        unlockedCount = newUnlockedAchievements.length
        if (newUnlockedAchievements.length > 0) {
          unlockedAchievementQueue.value = [...unlockedAchievementQueue.value, ...newUnlockedAchievements]
        }
      }

      completedAchievementKeys.value = nextKeys
      return unlockedCount
    } catch {
      return 0
    }
  }

  function closeAchievementUnlock() {
    unlockedAchievementQueue.value = unlockedAchievementQueue.value.slice(1)
  }

  return {
    activeUnlockedAchievement,
    closeAchievementUnlock,
    syncAchievementUnlocks,
    unlockedAchievementQueue,
  }
}
