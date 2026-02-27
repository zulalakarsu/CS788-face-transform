import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  Dimensions,
  Image,
  ScrollView,
  FlatList,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
// Note: Face detection removed for Expo Go compatibility
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import useAppStore from '../stores/appStore';

const { width } = Dimensions.get('window');
const GUIDE_SIZE = width * 0.65;

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
  route?: {
    params?: {
      transformType?: string;
    };
  };
}

const MIN_PHOTOS = 5;
const MAX_PHOTOS = 10;

// Guidance texts for each photo
const GUIDANCE_TEXTS = [
  'Look straight at the camera',
  'Turn your head slightly left',  
  'Turn your head slightly right',
  'Tilt your head up slightly',
  'Tilt your head down slightly'
];

export default function CameraScreen({ navigation }: Props) {
  const { setFacePhotos, setTrainingStatus } = useAppStore();
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const canContinue = capturedPhotos.length >= MIN_PHOTOS;
  const currentPhotoIndex = capturedPhotos.length;
  const canCapture = !isProcessing && capturedPhotos.length < MAX_PHOTOS;

  // Reset camera state when screen comes into focus to prevent text overlap
  useFocusEffect(
    useCallback(() => {
      // Reset processing state
      setIsProcessing(false);
      
      // Clear any stale state that might cause overlaps
      // Note: We don't clear capturedPhotos here because user might navigate back
      // after starting training and want to see their photos still
      
      return () => {
        // Cleanup when screen loses focus
        setIsProcessing(false);
      };
    }, [])
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.permissionText}>
            Camera access is needed to take your selfie
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const processPhoto = async (photoUri: string): Promise<string> => {
    try {
      // Get image dimensions using a Promise-based approach with Image component
      const getImageDimensions = (): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
          Image.getSize(
            photoUri,
            (width, height) => resolve({ width, height }),
            (error) => {
              console.warn('Could not get image dimensions:', error);
              // Fallback to common camera ratios
              resolve({ width: 3000, height: 4000 }); // Assume 3:4 portrait ratio
            }
          );
        });
      };

      const { width, height } = await getImageDimensions();
      
      // Calculate square crop from center
      const size = Math.min(width, height);
      const originX = (width - size) / 2;
      const originY = (height - size) / 2;
      
      const actions = [];
      
      // First crop to square
      actions.push({
        crop: {
          originX,
          originY,
          width: size,
          height: size
        }
      });
      
      // Then resize to final size
      actions.push({ resize: { width: 512, height: 512 } });
      
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photoUri,
        actions,
        {
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.95
        }
      );
      
      return manipulatedImage.uri;
    } catch (error) {
      console.error('Photo processing error:', error);
      return photoUri; // Return original if processing fails
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !canCapture) return;
    
    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      
      if (photo) {
        const processedUri = await processPhoto(photo.uri);
        const newPhotos = [...capturedPhotos, processedUri];
        setCapturedPhotos(newPhotos);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
    setIsProcessing(false);
  };

  const handleDeletePhoto = (index: number) => {
    const newPhotos = capturedPhotos.filter((_, i) => i !== index);
    setCapturedPhotos(newPhotos);
  };

  // Removed direct face detection from camera - will validate after capture

  const validatePhotoForFace = async (uri: string): Promise<boolean> => {
    // Face detection removed for Expo Go compatibility
    // In a production app, you would implement face detection in a development build
    console.log('Face validation skipped for Expo Go compatibility');
    return true; // Accept all photos
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Photo library permission is needed'
      );
      return;
    }

    const remainingSlots = MAX_PHOTOS - capturedPhotos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets.length > 0) {
      setIsProcessing(true);
      
      const validPhotos = [];
      for (const asset of result.assets) {
        const hasFace = await validatePhotoForFace(asset.uri);
        if (hasFace) {
          const processedUri = await processPhoto(asset.uri);
          validPhotos.push(processedUri);
        }
      }
      
      if (validPhotos.length === 0) {
        Alert.alert('No faces detected', 'Please select photos with clear faces visible.');
      } else if (validPhotos.length < result.assets.length) {
        Alert.alert(
          'Some photos rejected', 
          `${validPhotos.length} of ${result.assets.length} photos had detectable faces.`
        );
      }
      
      const newPhotos = [...capturedPhotos, ...validPhotos].slice(0, MAX_PHOTOS);
      setCapturedPhotos(newPhotos);
      setIsProcessing(false);
    }
  };

  const handleContinueToTraining = () => {
    if (capturedPhotos.length < MIN_PHOTOS) {
      Alert.alert('Not enough photos', `Please capture at least ${MIN_PHOTOS} photos of your face`);
      return;
    }

    setFacePhotos(capturedPhotos);
    setTrainingStatus('capturing');
    navigation.navigate('Training');
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const getCurrentGuidanceText = () => {
    if (currentPhotoIndex < GUIDANCE_TEXTS.length) {
      return GUIDANCE_TEXTS[currentPhotoIndex];
    }
    return 'Take more for even better results! (optional)';
  };

  const getFaceGuideColor = () => {
    if (isProcessing) return 'rgba(255, 193, 7, 0.8)';
    if (!canCapture) return 'rgba(255, 255, 255, 0.3)';
    return 'rgba(76, 175, 80, 0.8)';
  };

  const getStatusText = () => {
    if (isProcessing) return 'Processing...';
    if (capturedPhotos.length >= MAX_PHOTOS) return 'Maximum photos reached';
    return 'Position your face in the frame and tap to capture';
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing={facing} 
        ref={cameraRef}
      />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Capture Your Face</Text>
            <Text style={styles.headerSubtitle}>
              Take 5 photos from different angles for best results
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={handlePickFromLibrary}
            disabled={isProcessing}
          >
            <Text style={styles.galleryText}>📁</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.photoCounter}>
          <Text style={styles.counterText}>
            {capturedPhotos.length} of {MIN_PHOTOS} minimum
          </Text>
          {capturedPhotos.length > MIN_PHOTOS && (
            <Text style={styles.optionalText}>
              (up to {MAX_PHOTOS} total)
            </Text>
          )}
        </View>
      </SafeAreaView>

      {/* Face guide with dynamic guidance */}
      <View style={styles.guideContainer}>
        <View 
          style={[
            styles.faceGuide, 
            { borderColor: getFaceGuideColor() }
          ]} 
        />
        <Text style={styles.guidanceText}>
          {getCurrentGuidanceText()}
        </Text>
        <Text style={styles.statusText}>
          {getStatusText()}
        </Text>
      </View>

      {/* Photo strip */}
      {capturedPhotos.length > 0 && (
        <View style={styles.photoStrip}>
          <FlatList
            data={capturedPhotos}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `photo-${index}`}
            renderItem={({ item, index }) => (
              <View style={styles.photoThumbnailContainer}>
                <Image 
                  source={{ uri: item }} 
                  style={styles.photoThumbnail}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePhoto(index)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.photoStripContent}
            scrollEnabled={true}
            bounces={true}
            pagingEnabled={false}
            decelerationRate="normal"
          />
        </View>
      )}

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomSection}>
        {/* Continue button */}
        {canContinue && (
          <TouchableOpacity
            style={styles.continueButtonWrapper}
            onPress={handleContinueToTraining}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF4D6D', '#FF758C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>Continue to Training →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {/* 3-column control layout */}
        <View style={styles.bottomControls}>
          {/* Left: Gallery button */}
          <View style={styles.controlColumn}>
            <TouchableOpacity
              style={styles.galleryButtonBottom}
              onPress={handlePickFromLibrary}
              disabled={isProcessing}
            >
              <Text style={styles.galleryText}>📁</Text>
            </TouchableOpacity>
          </View>
          
          {/* Center: Capture button */}
          <View style={styles.controlColumn}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                !canCapture && styles.captureButtonDisabled
              ]}
              onPress={handleCapture}
              disabled={!canCapture}
            >
              <View style={[
                styles.captureInner,
                !canCapture && styles.captureInnerDisabled
              ]} />
            </TouchableOpacity>
          </View>
          
          {/* Right: Camera flip button */}
          <View style={styles.controlColumn}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={toggleCameraFacing}
            >
              <Text style={styles.flipIcon}>↻</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F1629',
  },
  permissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#FF4D6D',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  camera: {
    flex: 1,
  },
  // Header styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  galleryButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  galleryText: {
    fontSize: 18,
  },
  photoCounter: {
    alignItems: 'center',
  },
  counterText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  optionalText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  // Face guide styles
  guideContainer: {
    position: 'absolute',
    top: 120, // Below header
    bottom: 180, // Above bottom controls  
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 5, // Lower than photo strip
  },
  faceGuide: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE * 1.25,
    borderRadius: GUIDE_SIZE * 0.35,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  guidanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  // Photo strip styles
  photoStrip: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10, // Ensure it's above the camera overlay
  },
  photoStripContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    flexGrow: 0, // Prevent flex grow that might interfere with scrolling
  },
  photoThumbnailContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
    position: 'relative',
    zIndex: 15, // Higher than photo strip
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF4D6D',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20, // Highest z-index to ensure it's clickable
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8, // Android shadow
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  deleteIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 16,
  },
  // Bottom section styles
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  controlColumn: {
    flex: 1,
    alignItems: 'center',
  },
  galleryButtonBottom: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonWrapper: {
    position: 'absolute',
    top: -60,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  captureInnerDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  recommendationText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 12,
  },
});
