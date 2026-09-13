import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Pure-visual document alignment guide rendered over the camera preview:
 * a semi-transparent bounding box with four corner markers. No real edge
 * detection — guidance only.
 */
export default function CameraOverlay() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.box}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
    </View>
  );
}

const CORNER_SIZE = 22;
const BORDER = 3;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  box: {
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: -BORDER,
    left: -BORDER,
    borderTopWidth: BORDER,
    borderLeftWidth: BORDER,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: -BORDER,
    right: -BORDER,
    borderTopWidth: BORDER,
    borderRightWidth: BORDER,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: -BORDER,
    left: -BORDER,
    borderBottomWidth: BORDER,
    borderLeftWidth: BORDER,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: -BORDER,
    right: -BORDER,
    borderBottomWidth: BORDER,
    borderRightWidth: BORDER,
    borderBottomRightRadius: 6,
  },
});