/** Shows a system notification, preferring the service worker registration —
 *  required on Android Chrome, where the page-level `Notification` constructor
 *  throws — and falling back to that constructor when no service worker is
 *  registered (e.g. desktop Safari, or the app running outside a PWA install).
 *  Caller is responsible for checking `Notification.permission` first. */
export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, options)
      return
    } catch {
      // fall through to the page-level constructor below
    }
  }
  try {
    new Notification(title, options)
  } catch {
    // platforms without the page-level constructor (Android Chrome) and no
    // service worker to fall back to — nothing more we can do
  }
}
