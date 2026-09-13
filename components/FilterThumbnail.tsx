import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import * as SkiaNamespace from '@shopify/react-native-skia';
import { filterColorMatrix } from '@/lib/imageProcessing';
import { colors, radii, spacing, typography } from '@/constants/theme';
import type { FilterType } from '@/types/document';

// The package ships intact runtime exports but a subset of its type
// declarations are minified; recover the missing pieces at runtime.
const SkiaRuntime = SkiaNamespace as unknown as {
  Group: React.ComponentType<{ children?: React.ReactNode }>;
  ColorMatrix: React.ComponentType<{ matrix: number[]; children?: React.ReactNode }>;
};

const { Group, ColorMatrix } = SkiaRuntime;

interface FilterThumbnailProps {
  sourceUri: string;
  filter: FilterType;
  label: string;
  selected: boolean;
  size?: number;
  onSelect: (filter: FilterType) => void;
}

function FilterThumbnail({
  sourceUri,
  filter,
  label,
  selected,
  size = 56,
  onSelect,
}: FilterThumbnailProps) {
  const image = useImage(sourceUri);
  const matrix = filter === 'original' ? null : filterColorMatrix(filter);

  const handlePress = () => {
    void Haptics.selectionAsync();
    onSelect(filter);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.item, selected && styles.itemSelected]}
    >
      <Canvas style={{ width: size, height: size, borderRadius: radii.sm }}>
        {image ? (
          // A color filter must sit as a child of a Group (not wrap the
          // drawing): the Reanimated recorder treats a top-level filter
          // node's `matrix` prop as a CTM, so the wrapper form crashes with
          // "Expected array of length 9 or 16 for matrix, got 20".
          <Group>
            {matrix ? <ColorMatrix matrix={matrix} /> : null}
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={size}
              height={size}
              fit="cover"
            />
          </Group>
        ) : null}
      </Canvas>
      <View style={styles.labelRow}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {selected ? (
          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    padding: 4,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  itemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    maxWidth: 76,
  },
  label: {
    ...typography.badge,
    color: colors.textSecondary,
  },
});

export default memo(FilterThumbnail);