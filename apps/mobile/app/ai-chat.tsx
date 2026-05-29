import { StyleSheet, View } from 'react-native';
import { AppBackgroundGradient } from '@/components/AppBackgroundGradient';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { colors } from '@/constants/theme';

export default function AiChatScreen() {
  return (
    <View style={styles.root}>
      <AppBackgroundGradient />
      <View style={styles.content}>
        <ChatScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
