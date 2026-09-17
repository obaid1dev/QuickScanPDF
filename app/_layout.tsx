import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScanSessionProvider } from '@/hooks/useScanSession';
import { initializeAds } from '@/lib/ads';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  useEffect(() => {
    void initializeAds();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ScanSessionProvider>
          {/* Hidden system-wide so the app is fully immersive top-to-bottom. With
              edge-to-edge enabled, RN's Android status-bar hide uses the modern
              WindowInsetsController with BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
              (same behavior expo-navigation-bar applies), so a top-edge swipe
              temporarily reveals the clock/battery and it auto-hides again.
              style="light" keeps the icons light if/when revealed. */}
          <StatusBar style="light" hidden />
          {/* Android only: hidden until a bottom-edge swipe temporarily reveals
              it (the system's immersive-sticky behavior), with dark icons that
              read as light content against the app's near-black background. */}
          {Platform.OS === 'android' ? <NavigationBar hidden style="dark" /> : null}
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.textPrimary,
              headerShadowVisible: false,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="camera"
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen name="editor" options={{ title: 'Edit Scan' }} />
            <Stack.Screen name="share" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="viewer" options={{ headerShown: false, gestureEnabled: false }} />
          </Stack>
        </ScanSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}