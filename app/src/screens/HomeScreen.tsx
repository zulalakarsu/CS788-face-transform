import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useAppStore from '../stores/appStore';
import apiService from '../services/api';

type TransformType = 'muscular' | 'elderly' | 'slim';

interface TransformOption {
  id: TransformType;
  emoji: string;
  label: string;
}

const TRANSFORM_OPTIONS: TransformOption[] = [
  { id: 'muscular', emoji: '💪', label: 'Muscular' },
  { id: 'elderly', emoji: '👴', label: 'Elderly' },
  { id: 'slim', emoji: '✂️', label: 'Slim' },
];

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
  };
}

export default function HomeScreen({ navigation }: Props) {
  const { 
    hasTrainedModel, 
    isTrainingInProgress, 
    trainingStatus,
    trainingJobId,
    setTrainedModel,
    setTrainingStatus 
  } = useAppStore();
  
  const [isRecovering, setIsRecovering] = useState(false);

  // Recovery logic for stuck training state
  useEffect(() => {
    const checkStuckTraining = async () => {
      // Only recover if showing training but no active job ID (genuinely stuck)
      if (trainingStatus === 'training' && !trainingJobId) {
        console.log('🔄 Attempting to recover stuck training state (no active job ID)...');
        setIsRecovering(true);
        
        try {
          const latestModel = await apiService.getLatestModel();
          
          if (latestModel?.success && latestModel.model_version) {
            console.log('✅ Found trained model, recovering state');
            setTrainedModel(latestModel.model_version, new Date().toISOString());
            setTrainingStatus('ready');
            
            Alert.alert(
              'Training Recovered! 🎉',
              'Your AI model was found and is ready to use.',
              [{ text: 'Continue', onPress: () => navigation.navigate('Editor') }]
            );
          } else {
            console.log('❌ No trained model found, resetting state');
            setTrainingStatus('idle');
          }
        } catch (error) {
          console.error('Recovery failed:', error);
          setTrainingStatus('idle');
        } finally {
          setIsRecovering(false);
        }
      }
    };

    // Run recovery check on mount if stuck (only if no active training job)
    if (trainingStatus === 'training' && !trainingJobId) {
      setTimeout(checkStuckTraining, 1000);
    }
  }, [trainingStatus, trainingJobId]);

  const handleMainAction = () => {
    if (hasTrainedModel()) {
      // User has a trained model - go to transformation selection
      navigation.navigate('Editor');
    } else {
      // No trained model - go to camera to capture face photos
      navigation.navigate('Camera');
    }
  };

  const handleSecondaryAction = () => {
    if (hasTrainedModel()) {
      // User has model but wants to retrain
      navigation.navigate('Camera');
    } else {
      // No model, let them browse transformations anyway
      navigation.navigate('Editor');
    }
  };

  const getMainButtonText = () => {
    if (isTrainingInProgress()) {
      return 'Training in Progress...';
    }
    return hasTrainedModel() ? 'Transform' : 'Take a Photo';
  };

  const getSecondaryButtonText = () => {
    return hasTrainedModel() ? 'Retrain My Face' : 'Browse Transformations';
  };

  const getSubtitleText = () => {
    if (isTrainingInProgress()) {
      return 'Please wait while we learn your face...';
    }
    if (hasTrainedModel()) {
      return 'Your face model is ready! Choose how you want to transform.';
    }
    return 'Take a selfie and see yourself with a completely different body type using AI.';
  };

  const handleViewProgress = () => {
    if (isTrainingInProgress()) {
      navigation.navigate('Training');
    }
  };

  const handleManualRecovery = async () => {
    if (isRecovering) return;
    
    console.log('🛠️ Manual recovery requested');
    setIsRecovering(true);
    
    try {
      const latestModel = await apiService.getLatestModel();
      
      if (latestModel?.success && latestModel.model_version) {
        console.log('✅ Manual recovery found model:', latestModel.model_version);
        setTrainedModel(latestModel.model_version, new Date().toISOString());
        setTrainingStatus('ready');
        
        Alert.alert(
          'Model Found! 🎉', 
          'Your trained model is ready to generate transformations.',
          [{ text: 'Generate Now!', onPress: () => navigation.navigate('Editor') }]
        );
      } else {
        Alert.alert(
          'No Model Found', 
          'No trained models were found. You may need to retrain your face.',
          [
            { text: 'Retake Photos', onPress: () => {
              setTrainingStatus('idle');
              navigation.navigate('Camera');
            }},
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Manual recovery failed:', error);
      Alert.alert('Recovery Failed', 'Could not check for trained models. Please try again.');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Decorative background circles */}
      <View style={styles.circleTopRight} />
      <View style={styles.circleBottomLeft} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logoIcon}>✦</Text>
              <Text style={styles.logoText}>AI BODY TRANSFORMER</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Transform{'\n'}Your Body</Text>
          <Text style={styles.subtitle}>{getSubtitleText()}</Text>

          {/* Body type cards */}
          <View style={styles.cardsRow}>
            {TRANSFORM_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.card}
                activeOpacity={0.7}
              >
                <Text style={styles.cardEmoji}>{option.emoji}</Text>
                <Text style={styles.cardLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.spacer} />

          {/* Main CTA Button */}
          <TouchableOpacity
            style={[styles.ctaWrapper, isTrainingInProgress() && styles.ctaWrapperDisabled]}
            onPress={handleMainAction}
            activeOpacity={0.8}
            disabled={isTrainingInProgress()}
          >
            <LinearGradient
              colors={isTrainingInProgress() ? ['#666', '#666'] : ['#FF4D6D', '#FF758C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              {isTrainingInProgress() && (
                <TouchableOpacity onPress={handleViewProgress}>
                  <Text style={styles.ctaIcon}>⏳</Text>
                </TouchableOpacity>
              )}
              {!isTrainingInProgress() && <Text style={styles.ctaIcon}>📷</Text>}
              <Text style={styles.ctaText}>{getMainButtonText()}</Text>
              {!isTrainingInProgress() && <Text style={styles.ctaArrow}>→</Text>}
            </LinearGradient>
          </TouchableOpacity>

          {/* Recovery Button for Stuck Training */}
          {isTrainingInProgress() && !trainingJobId && (
            <TouchableOpacity
              style={styles.recoveryButton}
              onPress={handleManualRecovery}
              activeOpacity={0.7}
              disabled={isRecovering}
            >
              <Text style={styles.recoveryButtonText}>
                {isRecovering ? '🔄 Checking...' : '🛠️ Stuck? Tap here'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Secondary Action */}
          {!isTrainingInProgress() && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSecondaryAction}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>{getSecondaryButtonText()}</Text>
            </TouchableOpacity>
          )}

          {/* Privacy note */}
          <Text style={styles.privacyText}>
            Your photos are processed securely and never stored
          </Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  circleTopRight: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(128, 60, 100, 0.35)',
  },
  circleBottomLeft: {
    position: 'absolute',
    bottom: 60,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(30, 80, 120, 0.3)',
  },
  header: {
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 18,
    color: '#FF4D6D',
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
    width: 36,
    height: 36,
    lineHeight: 36,
    textAlign: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 50,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 22,
    marginBottom: 32,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: 'rgba(255, 77, 109, 0.5)',
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
  },
  cardEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  cardLabelSelected: {
    color: '#FFFFFF',
  },
  spacer: {
    flex: 1,
  },
  ctaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  ctaIcon: {
    fontSize: 18,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  privacyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
  },
  ctaWrapperDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    paddingVertical: 16,
    marginTop: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    textDecorationLine: 'underline',
  },
  recoveryButton: {
    paddingVertical: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  recoveryButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 77, 109, 0.8)',
    textDecorationLine: 'underline',
  },
});
