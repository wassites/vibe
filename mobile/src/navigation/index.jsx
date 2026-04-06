// mobile/src/navigation/index.jsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import WelcomeScreen  from '../screens/WelcomeScreen';
import LoginScreen    from '../screens/LoginScreen';
import HomeScreen     from '../screens/HomeScreen';
import ChatScreen     from '../screens/ChatScreen';
import ContactsScreen from '../screens/ContactsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:             false,
        tabBarStyle:             { backgroundColor: '#13131e', borderTopColor: '#2a2a45' },
        tabBarActiveTintColor:   '#a855f7',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: 'Conversas',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: 'Contatos',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👥</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="Chat"       component={ChatScreen} />
    </Stack.Navigator>
  );
}

export default function Navigation({ isLoggedIn, onLogin }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Welcome"  component={WelcomeScreen} />
            <Stack.Screen name="Login">
              {props => <LoginScreen {...props} onLogin={onLogin} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
