import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Animated,
  Image,
} from 'react-native';
import useAppStore from '../stores/appStore';
import apiService from '../services/api';

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
  route?: {
    params?: {
      imageUri?: string;
    };
  };
}

const SUGGESTION_CHIPS = [
  {
    label: "💪 Muscular",
    prompt: "with a muscular athletic build, toned arms, fitted athletic wear, in a modern gym"
  },
  {
    label: "👴 Elderly 70+",
    prompt: "as a 75 year old, deep wrinkles, grey hair, wise expression, cozy sweater, warm lighting"
  },
  {
    label: "🚀 Astronaut", 
    prompt: "holding a helmet, wearing an astronaut suit, inside a space station with Earth visible"
  },
  {
    label: "🎨 Renaissance painting",
    prompt: "as a classical oil painting, Renaissance style, rich colors, ornate frame, museum lighting"
  },
  {
    label: "🦸 Superhero",
    prompt: "wearing a superhero costume with cape, heroic pose, city skyline background, dramatic lighting"
  },
  {
    label: "📰 Magazine cover",
    prompt: "on a magazine cover, professional lighting, fashionable outfit, confident expression"
  },
  {
    label: "⚔️ Medieval knight",
    prompt: "wearing medieval armor with sword, castle courtyard, dramatic medieval lighting"
  },
  {
    label: "🌸 Studio Ghibli anime",
    prompt: "in Studio Ghibli animation style, soft colors, dreamy atmosphere, nature background"
  },
  {
    label: "💼 CEO giving a speech",
    prompt: "in a business suit, giving a presentation, corporate boardroom, confident posture"
  },
  {
    label: "👗 Red carpet gown",
    prompt: "wearing an elegant evening gown, red carpet event, photographers, glamorous lighting"
  },
  {
    label: "🏇 Horse riding on beach",
    prompt: "riding a horse on the beach at sunset, ocean waves, golden hour lighting"
  },
  {
    label: "🧛 Vampire",
    prompt: "as an elegant vampire with fangs, Victorian gothic clothing, dark mansion, moonlight"
  },
  {
    label: "👩‍🍳 Celebrity chef",
    prompt: "wearing chef whites in a professional kitchen, cooking show lighting, confident smile"
  }
];

export default function EditorScreen({ navigation, route }: Props) {
  const { 
    hasTrainedModel, 
    isGenerating,
    setGenerating,
    setGenerationResult,
    setGenerationError,
    addToHistory,
    getActiveModel,
  } = useAppStore();

  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  const handleCustomPromptChange = (text: string) => {
    setCustomPrompt(text);
    setSelectedChip(null); // Clear chip selection when user manually types
  };

  const handleSuggestionChip = (chipData: { label: string; prompt: string }) => {
    setCustomPrompt(chipData.prompt);
    setSelectedChip(chipData.label);
  };

  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnimation, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  const handleGenerate = async () => {
    console.log('🎬 Generate button pressed!', { customPrompt: customPrompt.trim(), length: customPrompt.trim().length });
    
    if (!customPrompt.trim()) {
      shakeInput();
      Alert.alert('Error', 'Describe what you want to see');
      return;
    }

    if (customPrompt.trim().length < 10) {
      shakeInput();
      Alert.alert('Error', 'Please provide more details - at least 10 characters');
      return;
    }

    if (!hasTrainedModel()) {
      Alert.alert('Error', 'No trained face model found. Please train your face first.');
      navigation.navigate('Home');
      return;
    }

    console.log('🚀 Starting generation with loading state...');
    setGenerating(true);
    setGenerationError(null);
    startPulseAnimation();
    console.log('✅ Loading state should now be visible!');

    try {
      // Get the active model
      const activeModel = getActiveModel();
      if (!activeModel) {
        Alert.alert('Error', 'No active model found. Please select a model in Settings.');
        setGenerating(false);
        stopPulseAnimation();
        return;
      }

      const result = await apiService.generateTransformation(
        activeModel.modelVersion,
        'custom',
        customPrompt.trim(),
        activeModel.triggerWord
      );

      const historyItem = {
        type: 'custom' as any,
        localUri: result.localUri || result.imageUrl,
        imageUrl: result.imageUrl,
        seed: result.seed,
      };

      addToHistory(historyItem);
      setGenerationResult({
        imageUrl: result.imageUrl,
        localUri: result.localUri || result.imageUrl,
        type: result.type,
        seed: result.seed,
      });

      navigation.navigate('Results', {
        imageUrl: result.imageUrl,
        type: 'custom',
        seed: result.seed,
        requestId: result.requestId,
        localUri: result.localUri,
        prompt: result.prompt,
      });
    } catch (error: any) {
      console.error('Generation error:', error);
      setGenerationError(error.message || 'Failed to generate transformation');
      Alert.alert(
        'Generation Failed',
        error.message || 'Failed to generate transformation. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setGenerating(false);
      stopPulseAnimation();
    }
  };

  const activeModel = getActiveModel();

  console.log('🔄 EditorScreen render - isGenerating:', isGenerating);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Transformation</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Active Model Indicator */}
        {activeModel && (
          <TouchableOpacity 
            style={styles.activeModelBar} 
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.activeModelText}>Using: {activeModel.name} ✓</Text>
            {activeModel.trainingPhotos.length > 0 && (
              <Image 
                source={{ uri: activeModel.trainingPhotos[0] }} 
                style={styles.modelThumbnail} 
              />
            )}
          </TouchableOpacity>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Prompt Input Section - Main Focus */}
          <View style={styles.promptSection}>
            <Text style={styles.promptLabel}>✨ Describe your transformation</Text>
            <Animated.View style={[{ transform: [{ translateX: shakeAnimation }] }]}>
              <TextInput
                style={styles.mainPromptInput}
                multiline
                numberOfLines={3}
                maxLength={250}
                placeholder="e.g., riding a horse on the beach at sunset"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={customPrompt}
                onChangeText={handleCustomPromptChange}
              />
            </Animated.View>
            <View style={styles.promptFooter}>
              <Text style={styles.characterCount}>{customPrompt.length}/250</Text>
            </View>
          </View>

          {/* Suggestion Chips */}
          <View style={styles.chipsSection}>
            <Text style={styles.chipsLabel}>Quick picks</Text>
            <View style={styles.chipsGrid}>
              {SUGGESTION_CHIPS.map((chip, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.suggestionChip,
                    selectedChip === chip.label && styles.suggestionChipSelected
                  ]}
                  onPress={() => handleSuggestionChip(chip)}
                >
                  <Text style={[
                    styles.chipText,
                    selectedChip === chip.label && styles.chipTextSelected
                  ]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!hasTrainedModel() && (
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>No Face Model</Text>
                <Text style={styles.warningText}>
                  You need to train your face model first to generate transformations.
                </Text>
                <TouchableOpacity 
                  style={styles.warningButton}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.warningButtonText}>Train Face Model</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Generate button */}
        <View style={styles.bottomBar}>
          <Animated.View style={isGenerating ? { transform: [{ scale: pulseAnimation }] } : {}}>
            <TouchableOpacity
              style={[
                styles.generateButton, 
                isGenerating && styles.generatingButton,
                (!hasTrainedModel() || !customPrompt.trim()) && !isGenerating && styles.disabledButton
              ]}
              onPress={handleGenerate}
              disabled={isGenerating || !hasTrainedModel() || !customPrompt.trim()}
              activeOpacity={isGenerating ? 1 : 0.8}
            >
              {isGenerating ? (
                <View style={styles.generatingContent}>
                  <ActivityIndicator color="white" size="small" style={styles.loadingSpinner} />
                  <Text style={styles.generatingText}>Generating...</Text>
                </View>
              ) : (
                <Text style={styles.generateButtonText}>Generate Transformation</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1629',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  activeModelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  activeModelText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  modelThumbnail: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF4D6D',
  },
  promptSection: {
    marginTop: 20,
    marginBottom: 32,
  },
  promptLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  mainPromptInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
    color: '#FFFFFF',
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    lineHeight: 22,
  },
  chipsSection: {
    marginBottom: 24,
  },
  chipsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.2)',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  warningButton: {
    backgroundColor: '#FF4D6D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  generateButton: {
    backgroundColor: '#FF4D6D',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  generatingButton: {
    backgroundColor: '#FF6B6D',
    opacity: 0.8,
  },
  generatingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginRight: 12,
  },
  generatingText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 77, 109, 0.4)',
  },
  promptFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 8,
  },
  suggestionChipSelected: {
    backgroundColor: 'rgba(255, 77, 109, 0.2)',
    borderColor: 'rgba(255, 77, 109, 0.6)',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
