import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { fontFamilies } from '@/constants/theme';

const SCREEN_BG = '#0E0E10';

export default function SavingsGoalsScreen() {
  return (
    <PageTransition>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Text style={styles.title}>Objectifs d'épargne</Text>
        <View style={styles.placeholderWrap}>
          <Text style={styles.placeholder}>Tes objectifs arrivent bientôt</Text>
        </View>
      </SafeAreaView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    color: '#FFFFFF',
    padding: 24,
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholder: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
});
