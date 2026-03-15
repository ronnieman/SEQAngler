import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '../context/AuthContext';
import { Colors } from '../constants/Config';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <AuthProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="login" 
          options={{ 
            title: 'Login',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="register" 
          options={{ 
            title: 'Create Account',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="species/[id]" 
          options={{ 
            title: 'Species Details',
          }} 
        />
        <Stack.Screen 
          name="spot/[id]" 
          options={{ 
            title: 'Fishing Spot',
          }} 
        />
      </Stack>
    </AuthProvider>
  );
}
