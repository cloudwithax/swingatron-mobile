# Swingatron Mobile

Swingatron is a modern mobile music and audio application built with React Native and Expo. It features a robust audio playback system, lyrics display, and comprehensive library management.

## Features

- **Advanced Audio Playback**: Seamless audio streaming and playback with background support.
- **Now Playing Interface**: Rich player interface with cover art, controls, and visualizations.
- **Lyrics Integration**: Real-time lyrics display for supported tracks.
- **Queue Management**: Easy management of upcoming tracks.
- **Library Organization**: Organize music with Folders and Favorites.
- **Stats & Insights**: View listening statistics.
- **Modern UI/UX**: Built with smooth animations (Reanimated) and blur effects.
- **Authentication**: User account management.

## Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/) (SDK 54)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Networking**: Axios
- **Audio**: react-native-track-player (lock screen controls, notification player)
- **Storage**: expo-secure-store, @react-native-async-storage/async-storage
- **Animations**: react-native-reanimated
- **Styling**: expo-linear-gradient, expo-blur, expo-font

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Bun](https://bun.sh/) (Preferred package manager)
- [Expo Go](https://expo.dev/client) app on your mobile device (for testing)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd swingatron/mobile
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

### Running the App

Start the development server:

```bash
bun start
```

- **Scan the QR code** with the Expo Go app (Android) or Camera app (iOS).
- Press `a` to open in Android Emulator.
- Press `i` to open in iOS Simulator.
- Press `w` to open in web browser.

## Scripts

- `bun start`: Start the project with cache cleared.
- `bun run android`: Run on Android device/emulator.
- `bun run ios`: Run on iOS simulator.
- `bun run web`: Run in web browser.
- `bun run lint`: Run ESLint to check for code quality issues.

## Project Structure

```
mobile/
├── app/                 # Expo Router pages and navigation
│   ├── (auth)/          # Authentication routes
│   ├── (tabs)/          # Main tab navigation
│   ├── nowplaying.tsx   # Player screen
│   └── ...
├── assets/              # Images, fonts, and other static assets
├── components/          # Reusable UI components
├── constants/           # App-wide constants (colors, theme)
├── hooks/               # Custom React hooks
├── src/                 # Core logic and services
└── ...
```
