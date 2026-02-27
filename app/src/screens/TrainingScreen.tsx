import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  AppState,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import useAppStore from '../stores/appStore';
import apiService from '../services/api';

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

// Training stages with progress ranges
const TRAINING_STAGES = {
  UPLOADING: { min: 0, max: 10, title: 'Uploading Photos', message: 'Uploading your photos...' },
  PREPARING: { min: 10, max: 20, title: 'Preparing Data', message: 'Preparing training data...' },
  TRAINING: { min: 20, max: 90, title: 'Training AI', message: 'Teaching AI your face...' },
  FINALIZING: { min: 90, max: 100, title: 'Finalizing', message: 'Finalizing your model...' },
  COMPLETE: { min: 100, max: 100, title: 'Complete', message: 'Your AI model is ready! 🎉' }
};

export default function TrainingScreen({ navigation }: Props) {
  const {
    facePhotos,
    trainingJobId,
    trainingStatus,
    setTrainingStatus,
    setTrainingJobId,
    setTrainedModel,
    setTrainingError,
    addModel,
    setFacePhotos,
  } = useAppStore();

  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<keyof typeof TRAINING_STAGES>('UPLOADING');
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState(3);
  const [lastResponse, setLastResponse] = useState<string>('');
  const [trainingMetadata, setTrainingMetadata] = useState<{triggerWord: string, modelName: string} | null>(null);
  const [localFacePhotos, setLocalFacePhotos] = useState<string[]>(facePhotos);
  
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize local photos
  useEffect(() => {
    setLocalFacePhotos(facePhotos);
  }, [facePhotos]);

  // Initialize training when screen loads with photos
  useEffect(() => {
    if (localFacePhotos.length > 0 && trainingStatus === 'capturing') {
      startTraining();
    }
  }, [localFacePhotos, trainingStatus]);

  // Handle background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - resume training status check
        if (trainingJobId && trainingStatus === 'training') {
          checkTrainingStatus();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [trainingJobId, trainingStatus]);

  // Training status polling
  useEffect(() => {
    if (trainingJobId && trainingStatus === 'training') {
      intervalRef.current = setInterval(checkTrainingStatus, 3000); // Check every 3 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [trainingJobId, trainingStatus]);

  // Elapsed time counter
  useEffect(() => {
    if (trainingStatus === 'training' && currentStage === 'TRAINING') {
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [trainingStatus, currentStage]);

  // Resume training check on component mount
  useEffect(() => {
    if (trainingJobId && trainingStatus === 'training') {
      // Resume from existing training
      checkTrainingStatus();
    }
  }, []);

  const updateProgress = (newProgress: number, stage: keyof typeof TRAINING_STAGES) => {
    setProgress(newProgress);
    setCurrentStage(stage);
  };

  const calculateUploadSpeed = (bytesUploaded: number, timeElapsed: number) => {
    if (timeElapsed > 0) {
      const mbps = (bytesUploaded / (1024 * 1024)) / (timeElapsed / 1000);
      setUploadSpeed(mbps);
    }
  };

  const startTraining = async () => {
    try {
      setTrainingStatus('uploading');
      updateProgress(0, 'UPLOADING');
      setUploadStartTime(Date.now());
      setElapsedTime(0);

      // Simulate upload progress
      const uploadProgressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 3, TRAINING_STAGES.UPLOADING.max);
          if (uploadStartTime) {
            const elapsed = Date.now() - uploadStartTime;
            calculateUploadSpeed(localFacePhotos.length * 1024 * 1024, elapsed); // Estimate file sizes
          }
          return newProgress;
        });
      }, 200);

      const response = await apiService.uploadPhotosForTraining(localFacePhotos);
      clearInterval(uploadProgressInterval);
      
      // Capture response for debug display
      setLastResponse(JSON.stringify(response, null, 2));
      
      // Store training metadata for later use
      if (response.triggerWord && response.modelName) {
        setTrainingMetadata({
          triggerWord: response.triggerWord,
          modelName: response.modelName
        });
      }
      
      updateProgress(TRAINING_STAGES.PREPARING.min, 'PREPARING');
      
      // Simulate data preparation
      setTimeout(() => {
        updateProgress(TRAINING_STAGES.PREPARING.max, 'TRAINING');
      }, 1000);

      setTrainingJobId(response.jobId);
      setTrainingStatus('training');
      setEstimatedMinutes(response.estimated_minutes || 3);

    } catch (error: any) {
      console.error('Training start error:', error);
      setTrainingError(error.message || 'Failed to start training');
      setTrainingStatus('failed');
      Alert.alert('Training Failed', error.message || 'Failed to start training');
    }
  };

  const parseTrainingProgress = (logs: string): number => {
    // Look for "step X/1200" pattern in logs
    const stepMatch = logs.match(/step (\d+)\/(\d+)/i);
    if (stepMatch) {
      const currentStep = parseInt(stepMatch[1]);
      const totalSteps = parseInt(stepMatch[2]);
      const percentage = (currentStep / totalSteps) * 100;
      // Map to training stage range (20-90%)
      return TRAINING_STAGES.TRAINING.min + (percentage * 0.7);
    }
    return progress;
  };

  const checkTrainingStatus = async () => {
    if (!trainingJobId) return;

    try {
      const status = await apiService.getTrainingStatus(trainingJobId);
      
      // Capture status response for debug display
      setLastResponse(JSON.stringify(status, null, 2));
      
      switch (status.status) {
        case 'starting':
          updateProgress(TRAINING_STAGES.PREPARING.max, 'TRAINING');
          break;
          
        case 'processing':
          const trainingProgress = status.progress || parseTrainingProgress(status.logs || '');
          const newProgress = Math.max(progress, trainingProgress);
          
          if (newProgress >= TRAINING_STAGES.FINALIZING.min) {
            updateProgress(newProgress, 'FINALIZING');
          } else {
            updateProgress(newProgress, 'TRAINING');
          }
          break;
          
        case 'succeeded':
          updateProgress(TRAINING_STAGES.COMPLETE.min, 'COMPLETE');
          setTrainingStatus('ready');
          
          // Add model to the new models list (for SettingsScreen)
          if (trainingMetadata && status.model_version) {
            addModel({
              name: trainingMetadata.modelName,
              modelVersion: status.model_version,
              triggerWord: trainingMetadata.triggerWord,
              trainingPhotos: localFacePhotos,
              createdAt: new Date().toISOString(),
              isActive: true,
            });
          }
          
          // Also update legacy fields for backward compatibility
          setTrainedModel(status.model_version!, new Date().toISOString());
          
          // Clear intervals
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
          
          // Navigate after success animation
          setTimeout(() => {
            navigation.navigate('Editor'); // Go directly to transformation selection
          }, 3000);
          break;
          
        case 'failed':
          setTrainingError(status.error || 'Training failed');
          setTrainingStatus('failed');
          
          // Clear intervals
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
          break;
          
        case 'canceled':
          setTrainingError('Training was canceled');
          setTrainingStatus('failed');
          break;
      }
    } catch (error: any) {
      console.error('Status check error:', error);
      setTrainingError(error.message || 'Failed to check training status');
      setTrainingStatus('failed');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Training',
      'Are you sure you want to cancel the training? You will need to start over.',
      [
        { text: 'Continue Training', style: 'cancel' },
        {
          text: 'Cancel Training',
          style: 'destructive',
          onPress: async () => {
            // Clear intervals
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
            
            // Try to cancel remote training job if possible
            try {
              if (trainingJobId) {
                // Add API call to cancel training job
                // await apiService.cancelTraining(trainingJobId);
              }
            } catch (error) {
              console.log('Could not cancel remote training:', error);
            }
            
            setTrainingStatus('idle');
            setTrainingJobId(null);
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  const handleRetry = () => {
    setTrainingStatus('idle');
    setTrainingJobId(null);
    setTrainingError(null);
    setProgress(0);
    setCurrentStage('UPLOADING');
    setElapsedTime(0);
    setUploadSpeed(0);
    
    if (localFacePhotos.length > 0) {
      startTraining();
    } else {
      navigation.navigate('Camera');
    }
  };

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatUploadSpeed = (mbps: number): string => {
    if (mbps < 1) return `${(mbps * 1000).toFixed(0)} KB/s`;
    return `${mbps.toFixed(1)} MB/s`;
  };

  const isTrainingComplete = trainingStatus === 'ready' && currentStage === 'COMPLETE';
  const isTrainingFailed = trainingStatus === 'failed';
  const isTrainingInProgress = ['uploading', 'training'].includes(trainingStatus);

  const getCurrentStageInfo = () => TRAINING_STAGES[currentStage];

  const handleDeletePhoto = (index: number) => {
    if (isTrainingInProgress) {
      Alert.alert('Cannot delete', 'Cannot delete photos during training');
      return;
    }
    
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newPhotos = localFacePhotos.filter((_, i) => i !== index);
            setLocalFacePhotos(newPhotos);
            setFacePhotos(newPhotos); // Update store as well
            
            if (newPhotos.length < 5) {
              Alert.alert(
                'Not enough photos',
                'You need at least 5 photos to train. Would you like to go back and add more?',
                [
                  { text: 'Continue anyway', style: 'cancel' },
                  {
                    text: 'Add more photos',
                    onPress: () => navigation.navigate('Camera')
                  }
                ]
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header - No back button to prevent user from leaving during training */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Training Your AI Model</Text>
            {!isTrainingComplete && !isTrainingFailed && (
              <Text style={styles.headerSubtitle}>
                Please don't close the app during training
              </Text>
            )}
          </View>
        </View>

        {/* Photo Preview Section */}
        {localFacePhotos.length > 0 && (
          <Animatable.View 
            animation={isTrainingInProgress ? "pulse" : undefined}
            iterationCount="infinite"
            duration={2000}
            style={styles.photoPreviewSection}
          >
            <Text style={styles.photoPreviewTitle}>Your Photos ({localFacePhotos.length})</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoPreviewContent}
              style={styles.photoPreviewScrollView}
            >
              {localFacePhotos.map((item, index) => (
                <View 
                  key={`training-photo-${index}`}
                  style={[
                    styles.photoPreviewContainer,
                    isTrainingInProgress && styles.photoPreviewGlow
                  ]}
                >
                  <Image 
                    source={{ uri: item }} 
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <Text style={styles.photoIndex}>{index + 1}</Text>
                  {!isTrainingInProgress && (
                    <TouchableOpacity
                      style={styles.deletePhotoButton}
                      onPress={() => handleDeletePhoto(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.deletePhotoIcon}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </Animatable.View>
        )}

        {/* Progress Section */}
        <View style={styles.progressSection}>
          {/* Stage Indicator */}
          <View style={styles.stageContainer}>
            <Text style={styles.stageTitle}>{getCurrentStageInfo().title}</Text>
            <Text style={styles.stageMessage}>{getCurrentStageInfo().message}</Text>
          </View>

          {/* Main Status Icon */}
          <View style={styles.statusIconContainer}>
            {isTrainingComplete ? (
              <Animatable.View animation="bounceIn" duration={1000}>
                <Text style={styles.successIcon}>🎉</Text>
              </Animatable.View>
            ) : isTrainingFailed ? (
              <Animatable.View animation="shake" duration={1000}>
                <Text style={styles.errorIcon}>❌</Text>
              </Animatable.View>
            ) : (
              <Animatable.View animation="rotate" iterationCount="infinite" duration={2000}>
                {currentStage === 'TRAINING' ? (
                  <Text style={styles.brainIcon}>🧠</Text>
                ) : (
                  <ActivityIndicator size="large" color="#FF4D6D" />
                )}
              </Animatable.View>
            )}
          </View>

          {/* Progress Bar */}
          {!isTrainingFailed && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animatable.View
                  animation="slideInLeft"
                  duration={500}
                  style={[
                    styles.progressFillWrapper,
                    { width: `${progress}%` }
                  ]}
                >
                  <LinearGradient
                    colors={['#FF4D6D', '#FF758C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.progressFill}
                  />
                </Animatable.View>
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}% complete</Text>
            </View>
          )}

          {/* Stage-specific information */}
          {currentStage === 'UPLOADING' && uploadSpeed > 0 && (
            <Text style={styles.uploadInfo}>
              Upload speed: {formatUploadSpeed(uploadSpeed)}
            </Text>
          )}

          {currentStage === 'TRAINING' && elapsedTime > 0 && (
            <View style={styles.trainingInfo}>
              <Text style={styles.elapsedTime}>
                {formatElapsedTime(elapsedTime)} elapsed
              </Text>
              <Text style={styles.estimateText}>
                Usually takes {estimatedMinutes}-{estimatedMinutes + 1} minutes
              </Text>
            </View>
          )}


          {isTrainingComplete && (
            <Animatable.Text 
              animation="fadeInUp" 
              delay={500}
              style={styles.successText}
            >
              Your face model is ready! You can now generate amazing transformations.
            </Animatable.Text>
          )}

          {isTrainingFailed && (
            <Text style={styles.errorText}>
              Training failed. This can happen sometimes with challenging photos.
              Please try again with well-lit, clear face photos.
            </Text>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          {isTrainingInProgress && (
            <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {isTrainingFailed && (
            <View style={styles.failureActions}>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.retakeButton} 
                onPress={() => navigation.navigate('Camera')}
              >
                <Text style={styles.retakeButtonText}>📷 Retake Photos</Text>
              </TouchableOpacity>
            </View>
          )}

          {isTrainingComplete && (
            <Animatable.View animation="fadeInUp" delay={1000}>
              <TouchableOpacity
                style={styles.continueButtonWrapper}
                onPress={() => navigation.navigate('Editor')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF4D6D', '#FF758C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.continueButtonGradient}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animatable.View>
          )}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  photoPreviewSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  photoPreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  photoPreviewScrollView: {
    maxHeight: 100,
  },
  photoPreviewContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  photoPreviewContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  photoPreviewGlow: {
    shadowColor: '#FF4D6D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  photoPreview: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'rgba(255, 77, 109, 0.3)',
  },
  photoIndex: {
    position: 'absolute',
    bottom: -18,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  deletePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF4D6D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  deletePhotoIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  stageContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stageMessage: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brainIcon: {
    fontSize: 48,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  loadingContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 64,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillWrapper: {
    height: '100%',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    borderRadius: 4,
  },
  uploadInfo: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
  },
  trainingInfo: {
    alignItems: 'center',
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.3)',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF4D6D',
    marginBottom: 8,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Courier',
    lineHeight: 14,
    marginTop: 16,
  },
  elapsedTime: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  estimateText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  successText: {
    fontSize: 15,
    color: '#4CAF50',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#FF6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelLinkText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  failureActions: {
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#FF4D6D',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  continueButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
