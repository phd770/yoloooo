export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, options);
    } catch (e) {
      console.error("Error sending notification", e);
    }
  }
};

export const requestNotificationPermission = async () => {
  if (typeof Notification !== "undefined" && Notification.permission !== "granted" && Notification.permission !== "denied") {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.error("Error requesting notification permission", e);
    }
  }
};
