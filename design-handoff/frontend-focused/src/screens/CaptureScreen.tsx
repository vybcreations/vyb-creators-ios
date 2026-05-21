import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Link as LinkIcon, BookOpen, Users } from 'lucide-react-native';
import { Pill, GoldButton, IconButton, SectionLabel } from '../components/primitives';
import { colors as C, fonts as F, KEYBOARD_GAP } from '../theme';
import { useIsTablet } from '../lib/layout';

type Tag = 'product' | 'writing' | 'business';

export function CaptureScreen({ navigation }: any) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState<Tag>('product');
  // iPad keeps the software keyboard hidden with a hardware keyboard; add
  // extra bottom room so the input clears the system language indicator.
  const isTablet = useIsTablet();

  const save = () => {
    // Phase 2 will persist this. For now just dismiss.
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(6,6,10,0.7)' }}>
      <Pressable onPress={() => navigation.goBack()} style={{ flex: 1 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={-KEYBOARD_GAP}>
        <SafeAreaView edges={['bottom']} style={{
          backgroundColor: C.bgElevated,
          borderTopLeftRadius: 36, borderTopRightRadius: 36,
          borderColor: C.borderMid, borderWidth: 1,
          paddingHorizontal: 20, paddingTop: 18, paddingBottom: isTablet ? 28 : 20,
          shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 60, shadowOffset: { width: 0, height: 30 },
        }}>
          {/* Drag handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderMid, alignSelf: 'center' }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontFamily: F.serifItalic, fontSize: 22, color: C.textPrimary, letterSpacing: -0.4 }}>
              Capture an idea
            </Text>
            <IconButton size={32} onPress={() => navigation.goBack()}>
              <X size={15} color={C.textPrimary} />
            </IconButton>
          </View>

          {/* Input */}
          <View style={{
            marginTop: 14, padding: 16, backgroundColor: C.bgOverlay,
            borderRadius: 20, borderColor: C.borderSubtle, borderWidth: 1, minHeight: 140,
          }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder='"what if newsletters had a read-with-a-friend mode?"'
              placeholderTextColor={C.textMuted}
              multiline
              autoFocus
              style={{
                fontFamily: F.serifItalic, fontSize: 15, color: C.textPrimary, lineHeight: 22,
                minHeight: 100, textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Tags */}
          <View style={{ marginTop: 14 }}>
            <SectionLabel style={{ marginBottom: 8 }}>tag</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['product', 'writing', 'business'] as const).map(t => (
                <Pill key={t} selected={tag === t} color="gold" size="md" onPress={() => setTag(t)}>
                  {t}
                </Pill>
              ))}
              <Pill size="md">+ new</Pill>
            </View>
          </View>

          {/* Attach row */}
          <View style={{
            flexDirection: 'row', gap: 14, alignItems: 'center',
            paddingTop: 14, marginTop: 14,
            borderTopColor: C.borderSubtle, borderTopWidth: 1,
          }}>
            <IconButton size={36} variant="ghost"><LinkIcon size={16} color={C.textPrimary} /></IconButton>
            <IconButton size={36} variant="ghost"><BookOpen size={16} color={C.textPrimary} /></IconButton>
            <IconButton size={36} variant="ghost"><Users size={16} color={C.textPrimary} /></IconButton>
            <View style={{ flex: 1 }} />
            <GoldButton variant="complete" size="md" onPress={save}>Save</GoldButton>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
