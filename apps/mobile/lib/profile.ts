import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProfileType = 'student' | 'entrepreneur' | 'homebuyer' | 'retired';

const PROFILE_KEY = 'user_profile';

export async function getProfile(): Promise<ProfileType> {
  const v = await AsyncStorage.getItem(PROFILE_KEY);
  if (v === 'entrepreneur' || v === 'homebuyer' || v === 'retired') return v;
  return 'student';
}

export async function setProfile(profile: ProfileType): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, profile);
}

export const profileBudgets: Record<
  ProfileType,
  { spent: number; budget: number; label: string }
> = {
  student: { spent: 680, budget: 850, label: 'Étudiant' },
  entrepreneur: { spent: 4200, budget: 5000, label: 'Entrepreneur' },
  homebuyer: { spent: 2100, budget: 2800, label: 'Acheteur' },
  retired: { spent: 3200, budget: 4000, label: 'Retraité' },
};
