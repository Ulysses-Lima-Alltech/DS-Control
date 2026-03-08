import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineApplication, OfflineDataCache } from '@/types/offline-application.type';

const OFFLINE_APPLICATIONS_KEY = '@offline_applications';
const OFFLINE_DATA_CACHE_KEY = '@offline_data_cache';

export const saveOfflineApplication = async (application: OfflineApplication): Promise<void> => {
  try {
    const existing = await getOfflineApplications();
    const updated = [...existing, application];
    await AsyncStorage.setItem(OFFLINE_APPLICATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving offline application:', error);
    throw error;
  }
};

export const getOfflineApplications = async (): Promise<OfflineApplication[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_APPLICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting offline applications:', error);
    return [];
  }
};

export const updateOfflineApplication = async (
  localId: string,
  updates: Partial<OfflineApplication>
): Promise<void> => {
  try {
    const applications = await getOfflineApplications();
    const updated = applications.map((app) =>
      app.localId === localId ? { ...app, ...updates } : app
    );
    await AsyncStorage.setItem(OFFLINE_APPLICATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating offline application:', error);
    throw error;
  }
};

export const deleteOfflineApplication = async (localId: string): Promise<void> => {
  try {
    const applications = await getOfflineApplications();
    const filtered = applications.filter((app) => app.localId !== localId);
    await AsyncStorage.setItem(OFFLINE_APPLICATIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting offline application:', error);
    throw error;
  }
};

export const getPendingOfflineApplications = async (): Promise<OfflineApplication[]> => {
  try {
    const applications = await getOfflineApplications();
    return applications.filter((app) => app.syncStatus === 'pending' || app.syncStatus === 'error');
  } catch (error) {
    console.error('Error getting pending offline applications:', error);
    return [];
  }
};

export const saveOfflineDataCache = async (cache: OfflineDataCache): Promise<void> => {
  try {
    await AsyncStorage.setItem(OFFLINE_DATA_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving offline data cache:', error);
    throw error;
  }
};

export const getOfflineDataCache = async (): Promise<OfflineDataCache | null> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_DATA_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting offline data cache:', error);
    return null;
  }
};

export const clearOfflineDataCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(OFFLINE_DATA_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing offline data cache:', error);
    throw error;
  }
};
