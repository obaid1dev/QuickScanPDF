import React, { memo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import type { ScanPage } from '@/types/document';

interface PageThumbnailStripProps {
  pages: ScanPage[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onDeletePage: (id: string) => void;
}

function PageThumbnailStrip({
  pages,
  currentPageId,
  onSelectPage,
  onDeletePage,
}: PageThumbnailStripProps) {
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
                  resizeMode="cover"
                />
                <View style={styles.indexBadge}>
                  <View style={styles.indexCircle}>
                    <Ionicons name="document" size={9} color={colors.white} />
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
                <Ionicons name="close" size={10} color={colors.white} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const THUMB = 46;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.secondary,
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
    borderColor: colors.secondary,
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
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    borderRadius: radii.round,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  indexCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndex: {
    color: colors.white,
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
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
  },
});

export default memo(PageThumbnailStrip);