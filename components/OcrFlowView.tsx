import React from 'react';
import OcrSheet from '@/components/OcrSheet';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { OcrFlow } from '@/hooks/useOcrFlow';

interface OcrFlowViewProps {
  flow: OcrFlow;
}

/**
 * Renders both the result sheet and the "watch a short ad" cap-exceeded prompt
 * for a given `OcrFlow` instance. Present on any screen that can trigger OCR.
 */
export default function OcrFlowView({ flow }: OcrFlowViewProps) {
  return (
    <>
      <OcrSheet state={flow.sheet} onClose={flow.dismissSheet} />
      <ConfirmDialog
        visible={flow.promptVisible}
        icon="videocam-outline"
        title="Watch a short ad to extract more text today"
        message="You've used your free text extractions today. Watch a short ad to extract more text."
        confirmLabel="Watch ad"
        danger={false}
        onConfirm={flow.watchAd}
        onCancel={flow.cancelWatchAd}
      />
    </>
  );
}
