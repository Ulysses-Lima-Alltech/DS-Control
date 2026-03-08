# Welcome to DS Control app 👋

## Get started

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Start the app

   ```bash
   pnpm run android
   # or
   pnpm run ios
   ```

## Location Permissions

The app automatically requests location permissions when it starts. The permission system:

- Checks if location services are enabled
- Requests foreground location permission if not already granted
- Shows appropriate alerts if permission is denied
- Displays a loading indicator while checking permissions

### Configuration

Location permissions are configured in `app.config.ts` with the following settings:

- `locationWhenInUsePermission`: Permission message for foreground location access
- `locationAlwaysAndWhenInUsePermission`: Permission message for background location access
- `isIosBackgroundLocationEnabled`: Enables background location on iOS
- `isAndroidBackgroundLocationEnabled`: Enables background location on Android

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
