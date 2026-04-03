import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Screens
import WelcomeScreen  from '../screens/WelcomeScreen';
import PhoneScreen    from '../screens/PhoneScreen';
import VerifyScreen   from '../screens/VerifyScreen';
import ProfileScreen  from '../screens/ProfileScreen';
import HomeScreen     from '../screens/HomeScreen';
import ChatScreen     from '../screens/ChatScreen';
import ContactsScreen from '../screens/ContactsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tabs principais (após login) ──────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:     false,
        tabBarStyle:     { backgroundColor: '#13131e', borderTopColor: '#2a2a45' },
        tabBarActiveTintColor:   '#a855f7',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: 'Conversas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: 'Contatos',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👥</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Stack dentro da aba Home ──────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="Chat"       component={ChatScreen} />
    </Stack.Navigator>
  );
}

// ── Navegação raiz ────────────────────────────────────────────────────────────
// isLoggedIn controla qual stack mostrar
// Por agora começa sempre no fluxo de auth
export default function Navigation({ isLoggedIn }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          // Usuário autenticado → tabs principais
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          // Não autenticado → fluxo de cadastro/login
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Phone"   component={PhoneScreen} />
            <Stack.Screen name="Verify"  component={VerifyScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
