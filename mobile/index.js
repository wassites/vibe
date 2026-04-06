import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent garante que o app funciona
// tanto no Expo Go quanto em builds standalone (APK/IPA)
registerRootComponent(App);
