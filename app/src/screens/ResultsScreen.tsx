import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import useAppStore from '../stores/appStore';
import apiService from '../services/api';

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
    popToTop: () => void;
  };
  route: {
    params: {
      imageUrl: string;
      type: string;
      seed: number;
      requestId?: string;
      prompt?: string;
      localUri?: string;
    };
  };
}

const { width } = Dimensions.get('window');

const TRANSFORM_LABELS: Record<string, string> = {
  muscular: '💪 Muscular',
  slim: '✂️ Slim', 
  heavy: '🍔 Heavy',
  youthful: '👶 Youthful',
  elderly: '👴 Elderly',
  custom: '✨ Custom',
};

const TRANSFORM_DESCRIPTIONS: Record<string, string> = {
  muscular: 'Strong, athletic build with defined muscles',
  slim: 'Lean, slender figure',
  heavy: 'Fuller, heavier build',
  youthful: 'Younger appearance with smooth skin',
  elderly: 'Mature appearance with wisdom lines',
  custom: 'Custom transformation',
};

export default function ResultsScreen({ navigation, route }: Props) {
  const {
    imageUrl,
    type,
    seed,
    requestId,
    prompt,
    localUri,
  } = route.params;

  const {
    facePhotos,
    trainedModelVersion,
    selectedType,
    generationResult,
    addToHistory,
  } = useAppStore();

  const [showBefore, setShowBefore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(localUri || null);

  const originalImage = facePhotos[0] || null; // Use first training photo as "before"
  const displayImage = localImageUri || imageUrl;

  // Debug logging
  useEffect(() => {
    console.log('ResultsScreen params:', { imageUrl, type, seed, requestId, localUri });
    console.log('Display image:', displayImage);
    console.log('Original image:', originalImage);
  }, []);

  // Save to history and cache image locally
  useEffect(() => {
    const saveResult = async () => {
      try {
        // Add to history via store (which persists automatically)
        const historyItem = {
          id: requestId || `result-${Date.now()}`,
          type: type as any,
          localUri: localImageUri || imageUrl,
          imageUrl,
          seed,
          createdAt: new Date().toISOString(),
        };
        
        addToHistory(historyItem);
        
        // Cache image locally if not already cached
        if (!localImageUri && imageUrl) {
          try {
            const filename = `generated_${seed}_${Date.now()}.jpg`;
            const localPath = `${FileSystem.documentDirectory}${filename}`;
            
            const downloadResult = await FileSystem.downloadAsync(imageUrl, localPath);
            if (downloadResult.status === 200) {
              setLocalImageUri(downloadResult.uri);
              // Update history with local URI
              addToHistory({
                ...historyItem,
                localUri: downloadResult.uri,
              });
            }
          } catch (error) {
            console.warn('Failed to cache image locally:', error);
          }
        }
      } catch (error) {
        console.error('Failed to save result:', error);
      }
    };
    
    saveResult();
  }, [imageUrl, type, seed, requestId, localImageUri]);

  const handleSaveToPhotos = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photos permission is needed to save images to your gallery.'
        );
        setIsSaving(false);
        return;
      }

      await MediaLibrary.saveToLibraryAsync(displayImage);
      Alert.alert('✨ Saved!', 'Your transformation has been saved to your photo library!');
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Failed to save image to photos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(displayImage, {
          dialogTitle: 'Share your transformation',
        });
      } else {
        Alert.alert(
          'Sharing Unavailable',
          'Sharing is not available on this device.'
        );
      }
    } catch (error: any) {
      Alert.alert('Share Failed', error.message || 'Failed to share image.');
    }
  };


  const handleTryDifferent = () => {
    navigation.navigate('Editor');
  };

  
  const handleViewHistory = () => {
    navigation.navigate('History');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Transformation</Text>
          <TouchableOpacity onPress={handleViewHistory}>
            <Text style={styles.historyButton}>📅</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Success celebration */}
          <Animatable.View animation="fadeInUp" delay={200}>
            <View style={styles.celebrationContainer}>
              <Text style={styles.celebrationIcon}>🎉</Text>
              <Text style={styles.celebrationText}>Transformation Complete!</Text>
              <Text style={styles.celebrationSubtext}>Your AI-powered transformation is ready</Text>
            </View>
          </Animatable.View>

          {/* Image */}
          <Animatable.View animation="zoomIn" delay={400} style={styles.imageContainer}>
            <Image
              source={{ uri: showBefore && originalImage ? originalImage : displayImage }}
              style={styles.image}
              resizeMode="contain"
              onError={(error) => {
                console.error('Image load error:', error.nativeEvent.error);
                console.error('Failed to load image URL:', showBefore && originalImage ? originalImage : displayImage);
              }}
              onLoad={() => {
                console.log('Image loaded successfully:', showBefore && originalImage ? originalImage : displayImage);
              }}
            />

            {/* Before/After toggle - only show if we have original image */}
            {originalImage && (
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, !showBefore && styles.activeToggle]}
                  onPress={() => setShowBefore(false)}
                >
                  <Text style={[styles.toggleText, !showBefore && styles.activeToggleText]}>
                    After
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, showBefore && styles.activeToggle]}
                  onPress={() => setShowBefore(true)}
                >
                  <Text style={[styles.toggleText, showBefore && styles.activeToggleText]}>
                    Before
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quality badge */}
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityText}>AI Enhanced</Text>
            </View>
          </Animatable.View>

          {/* Transformation details */}
          <Animatable.View animation="fadeInUp" delay={600}>
            <View style={styles.detailsCard}>
              <Text style={styles.detailsTitle}>Transformation Details</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {TRANSFORM_LABELS[type] || type}
                </Text>
              </View>
              
              {TRANSFORM_DESCRIPTIONS[type] && (
                <Text style={styles.detailDescription}>
                  {TRANSFORM_DESCRIPTIONS[type]}
                </Text>
              )}
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Seed</Text>
                <Text style={styles.detailValue}>#{seed}</Text>
              </View>
              
              {prompt && (
                <View style={styles.promptContainer}>
                  <Text style={styles.promptLabel}>AI Prompt</Text>
                  <Text style={styles.promptText}>{prompt}</Text>
                </View>
              )}

            </View>
          </Animatable.View>

          {/* Action buttons */}
          <Animatable.View animation="fadeInUp" delay={800}>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[styles.actionButton, isSaving && styles.actionButtonDisabled]}
                onPress={handleSaveToPhotos}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FF4D6D" />
                ) : (
                  <Text style={styles.actionIcon}>💾</Text>
                )}
                <Text style={styles.actionLabel}>Save to Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Text style={styles.actionIcon}>📤</Text>
                <Text style={styles.actionLabel}>Share</Text>
              </TouchableOpacity>


            </View>
          </Animatable.View>

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Bottom action bar */}
        <Animatable.View animation="slideInUp" delay={1000}>
          <LinearGradient
            colors={['transparent', 'rgba(15, 22, 41, 0.9)', '#0F1629']}
            style={styles.bottomBar}
          >
            <TouchableOpacity
              style={styles.newPhotoButton}
              onPress={handleTryDifferent}
              activeOpacity={0.8}
            >
              <Text style={styles.newPhotoIcon}>✨</Text>
              <Text style={styles.newPhotoText}>Try Different</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animatable.View>
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
  historyButton: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  celebrationContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  celebrationIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  celebrationText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  celebrationSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  imageContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: width - 40,
    height: width - 40,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 3,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 17,
  },
  activeToggle: {
    backgroundColor: '#FF4D6D',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  qualityBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 77, 109, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailsCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  detailDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 18,
    marginBottom: 12,
  },
  promptContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  promptLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    marginBottom: 6,
  },
  promptText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    width: (width - 64) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bottomSpacing: {
    height: 100,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  newPhotoButton: {
    flexDirection: 'row',
    backgroundColor: '#FF4D6D',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newPhotoIcon: {
    fontSize: 16,
  },
  newPhotoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
