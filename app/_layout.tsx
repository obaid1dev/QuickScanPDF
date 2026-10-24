import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScanSessionProvider } from '@/hooks/useScanSession';
import { ThemeProvider, useAppTheme } from '@/hooks/useAppTheme';
import { AppOpenAdController } from '@/hooks/useAppOpenAd';
import { initializeAds } from '@/lib/ads';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ScanSessionProvider>
            <RootNavigator />
          </ScanSessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { colors, resolved } = useAppTheme();

  useEffect(() => {
    void initializeAds();
  }, []);

  return (
    <>
      {/* Hidden system-wide so the app is fully immersive top-to-bottom. With
          edge-to-edge enabled, RN's Android status-bar hide uses the modern
          WindowInsetsController with BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
          (same behavior expo-navigation-bar applies), so a top-edge swipe
          temporarily reveals the clock/battery and it auto-hides again.
          style follows the theme so briefly revealed icons stay readable on
          either background (light theme -> dark icons). */}
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} hidden />
      {/* Android only: hidden until a bottom-edge swipe temporarily reveals
          it (the system's immersive-sticky behavior). The button style follows
          the theme so the transient bar reads correctly in both themes. */}
      {Platform.OS === 'android' ? (
        <NavigationBar hidden style={resolved === 'light' ? 'light' : 'dark'} />
      ) : null}
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="camera"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="folder/[id]"
          options={{ headerShown: false, gestureEnabled: true }}
        />
        <Stack.Screen
          name="add-scans"
          options={{ headerShown: false, gestureEnabled: true }}
        />
        <Stack.Screen name="editor" options={{ title: 'Edit Scan' }} />
        <Stack.Screen name="share" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="viewer" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <AppOpenAdController />
    </>
  );
}
