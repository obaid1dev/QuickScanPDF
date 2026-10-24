import React from 'react';
import { Tabs } from 'expo-router';
import TabBar from '@/components/TabBar';

/**
 * The three-tab root: Home, Tools, Settings. Headers are rendered inside the
 * screens themselves and the whole bar is our custom themed component - the
 * navigator only supplies routing, state and the Home/Tools/Settings order.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tools" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
