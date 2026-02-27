import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HistoryItem {
  id: string;
  imageUrl: string;
  originalImageUri?: string;
  type: string;
  customPrompt?: string;
  timestamp: number;
  prompt?: string;
  modelVersion?: string;
  triggerWord?: string;
}

const HISTORY_KEY = 'bodyMorph_history';

export class HistoryService {
  static async getHistory(): Promise<HistoryItem[]> {
    try {
      const historyData = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyData) {
        return JSON.parse(historyData);
      }
      return [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  static async addToHistory(item: HistoryItem): Promise<void> {
    try {
      const currentHistory = await this.getHistory();
      const newHistory = [item, ...currentHistory].slice(0, 100); // Keep last 100 items
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error adding to history:', error);
    }
  }

  static async deleteHistoryItem(id: string): Promise<void> {
    try {
      const currentHistory = await this.getHistory();
      const updatedHistory = currentHistory.filter(item => item.id !== id);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error deleting history item:', error);
    }
  }

  static async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  static async updateHistoryItem(id: string, updates: Partial<HistoryItem>): Promise<void> {
    try {
      const currentHistory = await this.getHistory();
      const itemIndex = currentHistory.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        currentHistory[itemIndex] = { ...currentHistory[itemIndex], ...updates };
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(currentHistory));
      }
    } catch (error) {
      console.error('Error updating history item:', error);
    }
  }
}