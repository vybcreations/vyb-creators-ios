import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { colors as C, fonts as F } from '../theme';
import { normalizeFriendCode } from '../lib/friends';

/**
 * QRScannerScreen — camera-based scan of a VYB friend code QR.
 *
 * Returns the parsed 12-digit code to the previous screen via the route
 * param `onScanned`. Close UX:
 *   - Large circular X in the top-right (inside the safe area).
 *   - Bottom "Cancel" button as a secondary, easy-to-reach exit.
 *   - Hardware back on Android works via React Navigation default.
 */
export function QRScannerScreen({ route, navigation }: any) {
  const onScanned: (code: string) => void = route?.params?.onScanned;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const close = () => navigation?.goBack();

  const handle = (raw: string) => {
    if (scanned) return;
    const code = normalizeFriendCode(raw);
    if (code.length !== 12) return;
    setScanned(true);
    onScanned?.(code);
    navigation?.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Camera fills the screen edge-to-edge; overlays sit on top. */}
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => handle(data)}
        />
      ) : (
        <View style={{
          flex: 1, alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 24,
        }}>
          <Text style={{
            fontFamily: F.sans, fontSize: 14, color: '#fff',
            textAlign: 'center', lineHeight: 20,
          }}>
            Camera permission is required to scan a friend QR code.
          </Text>
          <Pressable onPress={requestPermission} style={{
            marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
            backgroundColor: C.goldFaint,
            borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
          }}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 12, color: C.gold, letterSpacing: 0.5,
            }}>
              ALLOW CAMERA
            </Text>
          </Pressable>
        </View>
      )}

      {/* Top-right close button — large touch target, inside safe area. */}
      <Pressable
        onPress={close}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          right: 20,
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: 'rgba(13,12,11,0.62)',
          borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
        <X size={20} color="#F4F0E8" />
      </Pressable>

      {/* Title label, centered at top */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: insets.top + 18, left: 0, right: 0,
        alignItems: 'center',
      }}>
        <Text style={{
          fontFamily: F.sansBold, fontSize: 12, color: '#F4F0E8',
          letterSpacing: 1.2, textTransform: 'uppercase',
        }}>
          Scan friend QR
        </Text>
      </View>

      {/* Scan frame overlay */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: 240, height: 240, borderRadius: 18,
          borderColor: 'rgba(255,255,255,0.55)', borderWidth: 2,
        }} />
        <Text style={{
          marginTop: 18, fontFamily: F.serifItalic, fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
        }}>
          Point your camera at a friend QR
        </Text>
      </View>

      {/* Bottom cancel button — secondary easy-to-reach exit. */}
      <View style={{
        position: 'absolute', left: 0, right: 0,
        bottom: insets.bottom + 18,
        alignItems: 'center',
      }}>
        <Pressable
          onPress={close}
          hitSlop={10}
          style={{
            paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999,
            backgroundColor: 'rgba(13,12,11,0.62)',
            borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
          }}>
          <Text style={{
            fontFamily: F.sansBold, fontSize: 12, color: '#F4F0E8',
            letterSpacing: 1.0, textTransform: 'uppercase',
          }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
