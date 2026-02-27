import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { HistoryService, HistoryItem } from '../utils/history';

interface Props {
  navigation: any;
}

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const itemWidth = (width - 48 - CARD_GAP) / 2;

export default function HistoryScreen({ navigation }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const historyData = await HistoryService.getHistory();
      setHistory(
        historyData.sort(
          (a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp
        )
      );
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await HistoryService.clearHistory();
              setHistory([]);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history');
            }
          },
        },
      ]
    );
  };

  const deleteItem = (id: string) => {
    Alert.alert('Delete Item', 'Remove this from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await HistoryService.deleteHistoryItem(id);
            setHistory(history.filter((item) => item.id !== id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const viewItem = (item: HistoryItem) => {
    navigation.navigate('Results', {
      originalImage: item.originalImage,
      editedImage: item.editedImage,
      bodyType: item.bodyType,
      ageChange: item.ageChange,
      preserveClothing: item.preserveClothing,
      requestId: item.requestId,
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const getBodyTypeLabel = (value: number) => {
    if (value < -0.3) return 'Slim';
    if (value > 0.3) return 'Muscular';
    return 'Athletic';
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => viewItem(item)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: item.editedImage }} 
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemDate}>{formatDate(item.timestamp)}</Text>
        <Text style={styles.itemDetails}>{getBodyTypeLabel(item.bodyType)}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteItem(item.id)}
      >
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>History</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📸</Text>
            <Text style={styles.emptyTitle}>No History Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your edited photos will appear here
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.8}
            >
              <Text style={styles.createButtonText}>Create Your First Edit</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>History</Text>
          <TouchableOpacity onPress={clearHistory}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={history}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
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
  headerSpacer: {
    width: 40,
  },
  clearText: {
    fontSize: 15,
    color: '#FF4D6D',
    fontWeight: '600',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  clearSearchButton: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noResultsIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  historyItem: {
    width: itemWidth,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  itemInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  itemDate: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  seedText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#FF4D6D',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  createButtonIcon: {
    fontSize: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
