import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/tokens';
import { fetcher } from '../api/fetcher';

export interface OcrResult {
  content: string;
  confidence: number;
}

interface OcrCameraModalProps {
  visible: boolean;
  taskId?: string;
  colors: ThemeColors;
  onClose: () => void;
  onResult: (result: OcrResult) => void;
}

type Stage = 'idle' | 'capturing' | 'processing';

export function OcrCameraModal({
  visible,
  taskId,
  colors,
  onClose,
  onResult,
}: OcrCameraModalProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [lastResult, setLastResult] = useState<OcrResult | null>(null);

  const reset = () => {
    setStage('idle');
    setError(null);
    setLowConfidence(false);
    setLastResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const performOcr = async (base64: string | null) => {
    if (!base64) {
      setError('图片获取失败，请重试');
      setStage('idle');
      return;
    }
    setStage('processing');
    setError(null);
    try {
      console.log('[OcrCamera] submitting OCR taskId=', taskId ?? 'none');
      const res = await fetcher.submitOcr({ imageBase64: base64, taskId });
      if (res.success && res.data) {
        console.log(
          `[OcrCamera] OCR success confidence=${res.data.confidence} length=${res.data.content.length}`,
        );
        if (res.data.confidence < 0.7) {
          setLastResult(res.data);
          setLowConfidence(true);
          setStage('idle');
          return;
        }
        onResult(res.data);
        reset();
      } else {
        setError(res.error ?? 'OCR 识别失败');
        setStage('idle');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR 识别失败';
      setError(message);
      setStage('idle');
      console.error('[OcrCamera] error:', message);
    }
  };

  const handleCamera = async () => {
    setStage('capturing');
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('相机权限未授予，请在设置中开启');
        setStage('idle');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (result.canceled) {
        setStage('idle');
        return;
      }
      await performOcr(result.assets[0]?.base64 ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '拍照失败';
      setError(message);
      setStage('idle');
      console.error('[OcrCamera] camera error:', message);
    }
  };

  const handleGallery = async () => {
    setStage('capturing');
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('相册权限未授予，请在设置中开启');
        setStage('idle');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (result.canceled) {
        setStage('idle');
        return;
      }
      await performOcr(result.assets[0]?.base64 ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '选择图片失败';
      setError(message);
      setStage('idle');
      console.error('[OcrCamera] gallery error:', message);
    }
  };

  const handleUseAnyway = () => {
    if (lowConfidence) {
      onResult(lastResult ?? { content: '', confidence: 0 });
      reset();
    }
  };

  const isBusy = stage === 'capturing' || stage === 'processing';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.bgElevated }]}
          onStartShouldSetResponder={() => true}
        >
          {stage === 'processing' ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.processingText, { color: colors.textPrimary }]}>
                正在识别文字...
              </Text>
              <Text style={[styles.processingSub, { color: colors.textSecondary }]}>
                通常需要几秒到十几秒
              </Text>
            </View>
          ) : lowConfidence ? (
            <View style={styles.warningContainer}>
              <Text style={[styles.warningTitle, { color: colors.warning }]}>识别准确度较低</Text>
              <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                建议重新拍照或手动核对识别结果。也可以直接使用当前识别内容。
              </Text>
              <View style={styles.warningActions}>
                <Pressable
                  onPress={reset}
                  style={[styles.warningBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.warningBtnText, { color: colors.textPrimary }]}>
                    重新拍照
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleUseAnyway}
                  style={[styles.warningBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.warningBtnTextWhite}>使用结果</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>拍照识别作文</Text>
              <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
                拍摄手写作文或从相册选择，AI 将自动识别文字内容
              </Text>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: colors.accentLight }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleCamera}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.accent },
                  pressed && { opacity: 0.85 },
                  isBusy && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.actionBtnText}>拍照识别</Text>
              </Pressable>

              <Pressable
                onPress={handleGallery}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.bgSecondary, borderColor: colors.border },
                  pressed && { opacity: 0.85 },
                  isBusy && { opacity: 0.5 },
                ]}
              >
                <Text style={[styles.actionBtnTextSecondary, { color: colors.textPrimary }]}>
                  从相册选择
                </Text>
              </Pressable>

              <Pressable onPress={handleClose} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>取消</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetDesc: {
    fontSize: 14,
    marginBottom: 16,
  },
  errorBox: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBtnTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  processingSub: {
    fontSize: 13,
    marginTop: 4,
  },
  warningContainer: {
    paddingVertical: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 12,
  },
  warningBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  warningBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  warningBtnTextWhite: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
