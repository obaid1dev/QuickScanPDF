import React, { memo, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, type Palette } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ScanPage } from '@/types/document';

interface PageThumbnailStripProps {
  pages: ScanPage[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onDeletePage: (id: string) => void;
}

const THUMB = 46;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    slot: {
      position: 'relative',
    },
    thumbWrap: {
      width: THUMB,
      height: THUMB,
      borderRadius: radii.sm,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceLighter,
    },
    thumbSelected: {
      borderColor: colors.primary,
    },
    thumbPressed: {
      opacity: 0.85,
    },
    thumb: {
      width: '100%',
      height: '100%',
    },
    indexBadge: {
      position: 'absolute',
      left: 1,
      bottom: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.scrim,
      borderRadius: radii.round,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    indexCircle: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageIndex: {
      color: colors.onScrim,
      fontSize: 9,
      fontWeight: '700',
    },
    deleteBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.dangerDeep,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.surface,
    },
  });

function PageThumbnailStrip({
  pages,
  currentPageId,
  onSelectPage,
  onDeletePage,
}: PageThumbnailStripProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {pages.map((page, index) => {
          const selected = page.id === currentPageId;
          return (
            <View key={page.id} style={styles.slot}>
              <Pressable
                onPress={() => onSelectPage(page.id)}
                style={({ pressed }) => [
                  styles.thumbWrap,
                  selected && styles.thumbSelected,
                  pressed && styles.thumbPressed,
                ]}
                accessibilityLabel={`Page ${index + 1}`}
              >
                <Image
                  source={{ uri: page.processedUri }}
                  style={styles.thumb}
                  contentFit="cover"
                  recyclingKey={page.id}
                  transition={100}
                />
                <View style={styles.indexBadge}>
                  <View style={styles.indexCircle}>
                    <Ionicons name="document" size={9} color={colors.onScrim} />
                  </View>
                  <Text style={styles.pageIndex}>{index + 1}</Text>
                </View>
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() => onDeletePage(page.id)}
                style={styles.deleteBtn}
                accessibilityLabel={`Delete page ${index + 1}`}
              >
                <Ionicons name="close" size={10} color={colors.onScrim} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(PageThumbnailStrip);
