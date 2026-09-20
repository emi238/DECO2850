// The REAL live camera + YOLO detector. Runs ONLY in a development build on a
// physical phone (react-native-vision-camera + react-native-fast-tflite). Never
// imported in Expo Go — LiveScanScreen guards it.
//
// ⚠️ Reference implementation: the camera + frame-processor + model wiring below
// can only be verified on-device (the Simulator has no real camera and no native
// modules). The decode/mapping it calls (src/live/yolo.ts, coco.ts) ARE unit-tested.
// On first device run, the things most likely to need tuning are the model's input
// size and output layout — see src/live/yolo.ts. Put a YOLOv8 .tflite model where
// MODEL_URL points (see docs/BUILD_DEV_CLIENT.md).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { useRunOnJS } from 'react-native-worklets-core';

import { TopBar, PrimaryButton } from '../components/kit';
import { colors, fonts } from '../theme';
import { decodeYolo } from './yolo';
import { mapDetection, type MappedDetection } from './coco';
import { useSession } from '../store/session';
import { CATEGORY_LABELS } from '../ai/categories';
import type { Assessment, Hazard } from '../types';
import type { ScreenProps } from '../navigation';

// A YOLOv8 model exported to TFLite (COCO, 640×640 input). Bundle it as an asset
// or host it and set the path/URL here (docs/BUILD_DEV_CLIENT.md).
const MODEL_URL = ''; // e.g. require('../../assets/models/yolov8n.tflite') or a https URL
const INPUT_SIZE = 640;
const CONF = 0.4;

export default function LiveScanNative({ navigation }: ScreenProps<'LiveScan'>) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [model, setModel] = useState<TensorflowModel | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [dets, setDets] = useState<MappedDetection[]>([]);

  const setResult = useSession((s) => s.setResult);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Load the detection model once.
  useEffect(() => {
    let alive = true;
    if (!MODEL_URL) {
      setModelError('No detection model configured yet. Add a YOLOv8 .tflite and set MODEL_URL (see docs/BUILD_DEV_CLIENT.md).');
      return;
    }
    loadTensorflowModel(MODEL_URL as any, []) // [] = default delegate; ['core-ml'] on iOS for speed
      .then((m) => alive && setModel(m))
      .catch((e) => alive && setModelError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);

  const { resize } = useResizePlugin();

  // Runs on the JS thread with each frame's raw model output → decode → map.
  const onOutput = useRunOnJS((output: number[]) => {
    const decoded = decodeYolo(output, { inputSize: INPUT_SIZE, confThreshold: CONF });
    setDets(decoded.map(mapDetection));
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (model == null) return;
      // Resize + normalise the frame to the model's input, run inference, hand the
      // raw output to JS for decoding. (Per-frame decode on the worklet is possible
      // later for speed; JS-thread decode is simpler and fine for a prototype.)
      const resized = resize(frame, {
        scale: { width: INPUT_SIZE, height: INPUT_SIZE },
        pixelFormat: 'rgb',
        dataType: 'float32',
      });
      const outputs = model.runSync([resized as any]); // typed-array input; exact type varies by model
      // outputs[0] is the flat detection tensor (see src/live/yolo.ts).
      onOutput(outputs[0] as unknown as number[]);
    },
    [model, onOutput]
  );

  const hazards = useMemo(() => dets.filter((d) => d.isHazard), [dets]);

  // Turn the current detections into an Assessment and open the analysis for them.
  const useFindings = () => {
    const hz: Hazard[] = hazards.map((d, i) => ({
      id: `live-${i}-${d.label}`,
      category: d.category,
      title: d.label.replace(/\b\w/g, (c) => c.toUpperCase()),
      scope: 'object',
      location: { frame_index: 0, x: d.x + d.w / 2, y: d.y + d.h / 2 },
      risk_to: 'animal',
      severity: d.severity,
      evidence: `Detected live (${Math.round(d.confidence * 100)}% confidence).`,
      why_it_matters: d.why,
      recommendation: d.fix,
    }));
    const assessment: Assessment = {
      mode: 'pet_in_mind',
      space_summary: `Live scan detected ${hz.length} object${hz.length === 1 ? '' : 's'} to check.`,
      confidence: 'medium',
      hazards: hz,
      improvements: [],
      suitability: null,
      recommended_pets: [],
      notes: 'Captured with the live AR scan (on-device detection).',
    };
    setResult(assessment, 'ai', 'Live AR scan (on-device detection).');
    navigation.navigate('Analysis');
  };

  if (!hasPermission) {
    return (
      <Info title="Camera access needed" body="PawSpace needs the camera to scan the room." action="Grant access" onAction={requestPermission} onBack={() => navigation.goBack()} />
    );
  }
  if (!device) {
    return <Info title="No camera found" body="This device has no usable back camera." onBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.root}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive frameProcessor={model ? frameProcessor : undefined} />

      {/* Detection boxes + labels, drawn over the live camera. */}
      {dets.map((d, i) => (
        <View key={i} style={[styles.box, d.isHazard && styles.boxHazard, { left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${d.w * 100}%`, height: `${d.h * 100}%` }]}>
          <Text style={[styles.boxLabel, d.isHazard && styles.boxLabelHazard]} numberOfLines={1}>
            {d.isHazard ? CATEGORY_LABELS[d.category] : d.label} {Math.round(d.confidence * 100)}%
          </Text>
        </View>
      ))}

      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <TopBar onBack={() => navigation.goBack()} style={styles.topBar} />
        <View style={styles.hud}>
          <Text style={styles.hudTxt}>
            {modelError ? 'Detection model not loaded' : !model ? 'Loading detector…' : `${hazards.length} hazard${hazards.length === 1 ? '' : 's'} in view`}
          </Text>
        </View>
      </SafeAreaView>

      {modelError && (
        <View style={styles.modelErr}>
          <Text style={styles.modelErrTxt}>{modelError}</Text>
          <Pressable onPress={() => Linking.openURL('https://github.com/mrousavy/react-native-fast-tflite')}>
            <Text style={styles.modelErrLink}>fast-tflite docs</Text>
          </Pressable>
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.footer} pointerEvents="box-none">
        <PrimaryButton label={`Use ${hazards.length} finding${hazards.length === 1 ? '' : 's'}`} onPress={useFindings} disabled={hazards.length === 0} />
      </SafeAreaView>
    </View>
  );
}

function Info({ title, body, action, onAction, onBack }: { title: string; body: string; action?: string; onAction?: () => void; onBack: () => void }) {
  return (
    <View style={[styles.root, { backgroundColor: colors.bg2 }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TopBar onBack={onBack} style={styles.topBar} />
        <View style={styles.infoBody}>
          <Text style={styles.infoTitle}>{title}</Text>
          <Text style={styles.infoTxt}>{body}</Text>
          {action && onAction && <PrimaryButton label={action} onPress={onAction} style={{ marginTop: 20, alignSelf: 'stretch' }} />}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  hud: { alignSelf: 'center', backgroundColor: 'rgba(20,20,22,0.7)', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  hudTxt: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  box: { position: 'absolute', borderWidth: 2, borderColor: colors.orange, borderRadius: 6 },
  boxHazard: { borderColor: '#E4572E' },
  boxLabel: { position: 'absolute', top: -20, left: 0, fontFamily: fonts.semibold, fontSize: 11, color: '#fff', backgroundColor: colors.orange, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  boxLabelHazard: { backgroundColor: '#E4572E' },
  footer: { position: 'absolute', left: 22, right: 22, bottom: 8 },
  modelErr: { position: 'absolute', left: 22, right: 22, bottom: 90, backgroundColor: 'rgba(20,20,22,0.85)', borderRadius: 12, padding: 12 },
  modelErrTxt: { fontFamily: fonts.regular, fontSize: 12.5, color: '#fff', lineHeight: 18 },
  modelErrLink: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.orange, marginTop: 6 },
  infoBody: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  infoTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, textAlign: 'center' },
  infoTxt: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center', marginTop: 10 },
});
