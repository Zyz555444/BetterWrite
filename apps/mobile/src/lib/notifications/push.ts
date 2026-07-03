import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fetcher } from '../api/fetcher';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Push] Must use physical device for push notifications');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted');
    return null;
  }

  try {
    const easProjectId = (Constants.expoConfig?.extra as { easProjectId?: string } | undefined)
      ?.easProjectId;
    if (!easProjectId) {
      console.warn(
        '[Push] Missing EAS projectId in app.json extra.easProjectId — push tokens will not be generated',
      );
      return null;
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId,
    });
    const token = tokenResponse.data;
    console.log(`[Push] obtained token length=${token.length}`);

    const result = await fetcher.registerDeviceToken({ token, platform: Platform.OS });
    if (result.success) {
      console.log(`[Push] registered to backend platform=${Platform.OS}`);
    } else {
      console.warn(`[Push] backend register failed: ${result.error ?? 'unknown'}`);
    }
    return token;
  } catch (err) {
    console.error('[Push] registerForPushNotifications error:', err);
    return null;
  }
}

export async function sendTestNotification(): Promise<void> {
  const result = await fetcher.sendTestNotification();
  if (result.success) {
    console.log(`[Push] test sent count=${result.data?.sent ?? 0}`);
  } else {
    console.warn(`[Push] test send failed: ${result.error ?? 'unknown'}`);
  }
}

let receivedSubscription: Notifications.EventSubscription | null = null;
let responseSubscription: Notifications.EventSubscription | null = null;

export function setupNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onOpened?: (response: Notifications.NotificationResponse) => void,
): void {
  clearNotificationListeners();

  if (onReceived) {
    receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] notification received in foreground');
      onReceived(notification);
    });
  }

  if (onOpened) {
    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Push] notification opened by user');
      onOpened(response);
    });
  }

  console.log('[Push] listeners set up');
}

export function clearNotificationListeners(): void {
  if (receivedSubscription) {
    receivedSubscription.remove();
    receivedSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
  console.log('[Push] listeners cleared');
}
