import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
          <StatusBar style="light" />
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
            <Stack.Screen name="share" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
        </ScanSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}