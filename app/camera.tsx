import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CameraOverlay from '@/components/CameraOverlay';
import { useScanSession } from '@/hooks/useScanSession';
import { normalizeToJpeg } from '@/lib/imageProcessing';
import { colors, spacing, typography } from '@/constants/theme';

type FlashOption = 'auto' | 'on' | 'off';

const FLASH_CYCLE: FlashOption[] = ['auto', 'on', 'off'];

const FLASH_ICON: Record<FlashOption, keyof typeof Ionicons.glyphMap> = {
  auto: 'flash-outline',
  on: 'flash',
  off: 'flash-off-outline',
};

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const { pages, isActive, addPage, clearSession } = useScanSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashOption>('auto');
  const [capturing, setCapturing] = useState(false);

  const goBackWithConfirm = useCallback(() => {
    if (isActive) {
      Alert.alert(
        'Discard scan session?',
        `${pages.length} captured page${pages.length === 1 ? '' : 's'} will be discarded.`,
        [
          { text: 'Keep Scanning', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              clearSession();
              router.back();
            },
          },
        ],
      );
    } else {
      router.back();
    }
  }, [isActive, pages.length, clearSession, router]);

  const cycleFlash = () => {
    setFlash((prev) => {
      const i = FLASH_CYCLE.indexOf(prev);
      return FLASH_CYCLE[(i + 1) % FLASH_CYCLE.length];
    });
  };

  const finishCapture = useCallback(
    (uris: string[], hadPagesBefore: boolean) => {
      for (const uri of uris) {
        addPage(uri);
      }
      if (hadPagesBefore) {
        router.back();
      } else {
        router.push('/editor');
      }
    },
    [addPage, router],
  );

  const shutter = async () => {
    if (!cameraRef.current || capturing) {
      return;
    }
    setCapturing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hadPages = isActive;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        finishCapture([photo.uri], hadPages);
      }
    } catch {
      Alert.alert('Capture failed', 'Could not take a photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access to import images from your gallery.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const hadPages = isActive;
      const normalizedUris = await Promise.all(
        result.assets.map((a) => normalizeToJpeg(a.uri)),
      );
      finishCapture(normalizedUris, hadPages);
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionWrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          QuickScan PDF uses your camera to scan documents and receipts.
        </Text>
        <View style={styles.permissionActions}>
          <Pressable
            onPress={() => {
              if (permission.canAskAgain) {
                requestPermission();
              } else {
                Linking.openSettings();
              }
            }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {permission.canAskAgain ? 'Allow Camera' : 'Open Settings'}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        onMountError={() => {
          Alert.alert(
            'Camera error',
            'The camera could not be started on this device.',
          );
        }}
      />
      <CameraOverlay />

      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable
          hitSlop={8}
          onPress={goBackWithConfirm}
          style={styles.iconBtn}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={cycleFlash}
          style={styles.iconBtn}
          accessibilityLabel={`Flash ${flash}`}
        >
          <Ionicons name={FLASH_ICON[flash]} size={22} color={colors.white} />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.bottomRow}>
          <Pressable
            onPress={openGallery}
            style={styles.galleryBtn}
            accessibilityLabel="Import from gallery"
          >
            <Ionicons name="images-outline" size={26} color={colors.white} />
            <Text style={styles.galleryLabel}>Gallery</Text>
          </Pressable>

          <Pressable
            onPress={shutter}
            disabled={capturing}
            accessibilityLabel="Take photo"
            style={({ pressed }) => [
              styles.shutterOuter,
              pressed && styles.shutterPressed,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable
            disabled={!isActive}
            onPress={() => router.push('/editor')}
            style={styles.counterBtn}
            accessibilityLabel="Open editor"
          >
            <Text style={styles.counterText}>{pages.length}</Text>
            <Text style={styles.counterLabel}>pages</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  galleryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    rowGap: 4,
  },
  galleryLabel: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '500',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
  },
  counterBtn: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 2,
  },
  counterText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  counterLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  permissionWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    rowGap: spacing.md,
  },
  permissionTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  permissionText: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionActions: {
    flexDirection: 'row',
    columnGap: spacing.md,
    marginTop: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});