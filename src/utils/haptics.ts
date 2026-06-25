export function triggerSuccessHaptic() {
  try {
    uni.vibrateShort({ type: 'light' })
  } catch {
    // Haptics are optional on unsupported platforms.
  }
}
