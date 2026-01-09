"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Monitor,
  Tv,
  Tablet,
  Gamepad2,
  Globe,
  Apple,
  Chrome,
  RefreshCw,
  Trash2,
  Wifi,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Play,
  Settings,
  AlertTriangle,
  CheckCircle,
  Zap,
} from "lucide-react";

type DeviceType = 
  | "ios"
  | "android"
  | "windows"
  | "macos"
  | "firetv"
  | "androidtv"
  | "roku"
  | "appletv"
  | "webos"
  | "tizen"
  | "xbox"
  | "playstation"
  | "web"
  | null;

type Platform = "emby" | "plex" | "both";

interface DeviceInfo {
  id: DeviceType;
  name: string;
  icon: React.ReactNode;
  category: string;
}

interface TipSection {
  title: string;
  icon: React.ReactNode;
  tips: string[];
  platform?: Platform;
}

const devices: DeviceInfo[] = [
  // Mobile
  { id: "ios", name: "iPhone / iPad", icon: <Apple className="h-8 w-8" />, category: "Mobile" },
  { id: "android", name: "Android Phone / Tablet", icon: <Smartphone className="h-8 w-8" />, category: "Mobile" },
  // Desktop
  { id: "windows", name: "Windows PC", icon: <Monitor className="h-8 w-8" />, category: "Desktop" },
  { id: "macos", name: "Mac", icon: <Apple className="h-8 w-8" />, category: "Desktop" },
  // Smart TV / Streaming
  { id: "firetv", name: "Amazon Fire TV", icon: <Tv className="h-8 w-8" />, category: "Smart TV / Streaming" },
  { id: "androidtv", name: "Android TV / Google TV", icon: <Tv className="h-8 w-8" />, category: "Smart TV / Streaming" },
  { id: "roku", name: "Roku", icon: <Tv className="h-8 w-8" />, category: "Smart TV / Streaming" },
  { id: "appletv", name: "Apple TV", icon: <Apple className="h-8 w-8" />, category: "Smart TV / Streaming" },
  { id: "webos", name: "LG TV (webOS)", icon: <Tv className="h-8 w-8" />, category: "Smart TV / Streaming" },
  { id: "tizen", name: "Samsung TV (Tizen)", icon: <Tv className="h-8 w-8" />, category: "Smart TV / Streaming" },
  // Gaming
  { id: "xbox", name: "Xbox", icon: <Gamepad2 className="h-8 w-8" />, category: "Gaming Console" },
  { id: "playstation", name: "PlayStation", icon: <Gamepad2 className="h-8 w-8" />, category: "Gaming Console" },
  // Web
  { id: "web", name: "Web Browser", icon: <Globe className="h-8 w-8" />, category: "Web" },
];

const deviceTips: Record<NonNullable<DeviceType>, TipSection[]> = {
  ios: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Open Settings > General > iPhone Storage",
        "Find Emby or Plex app and tap it",
        "Tap 'Offload App' to clear cache while keeping data",
        "Or delete and reinstall the app for a fresh start",
        "In Plex app: Settings > Advanced > Clear Cache",
        "In Emby app: Settings > Client Settings > Clear Cache",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Force close the app and reopen it",
        "Check your internet connection speed",
        "Try lowering the streaming quality in app settings",
        "Disable 'Direct Play' if having compatibility issues",
        "Make sure the app is updated to the latest version",
      ],
    },
    {
      title: "Connection Problems",
      icon: <Wifi className="h-5 w-5" />,
      tips: [
        "Toggle WiFi off and on",
        "Try switching between WiFi and cellular data",
        "Check if the server is online",
        "Sign out and sign back in to the app",
        "Verify the server address is correct in app settings",
      ],
    },
  ],
  android: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Open Settings > Apps > Emby or Plex",
        "Tap 'Storage' or 'Storage & cache'",
        "Tap 'Clear Cache' (keeps your login)",
        "Tap 'Clear Data' for a complete reset (will need to sign in again)",
        "In app: Settings > Advanced > Clear Cache",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Force stop the app from Settings > Apps",
        "Try changing the video player in app settings",
        "Lower streaming quality if buffering occurs",
        "Enable 'Use External Player' for problematic files",
        "Check for app updates in the Play Store",
      ],
    },
    {
      title: "Battery & Performance",
      icon: <Zap className="h-5 w-5" />,
      tips: [
        "Disable battery optimization for the app",
        "Settings > Apps > Emby/Plex > Battery > Unrestricted",
        "This prevents the app from being killed in background",
        "Enable 'Background Play' if you want audio when screen is off",
      ],
    },
  ],
  windows: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Plex: %LOCALAPPDATA%\\Plex Media Player\\cache - delete contents",
        "Emby Theater: %APPDATA%\\Emby-Theater\\cache - delete contents",
        "Web browser: Clear browser cache and cookies",
        "Or uninstall and reinstall the app for a clean start",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Update your graphics drivers",
        "Try disabling hardware acceleration in app settings",
        "Check Windows Defender isn't blocking the app",
        "Run the app as administrator if having permission issues",
        "Try the web version if the desktop app has issues",
      ],
    },
    {
      title: "Network Troubleshooting",
      icon: <Wifi className="h-5 w-5" />,
      tips: [
        "Flush DNS: Open CMD as admin, run 'ipconfig /flushdns'",
        "Check Windows Firewall allows the app",
        "Try disabling VPN if using one",
        "Reset network settings if connection is unstable",
      ],
    },
  ],
  macos: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Plex: ~/Library/Caches/tv.plex.* - delete these folders",
        "Emby: ~/Library/Application Support/Emby Theater/cache",
        "To access Library: Finder > Go > Hold Option > Library",
        "Or reinstall the app from the App Store",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Check for macOS and app updates",
        "Try disabling hardware transcoding",
        "Grant necessary permissions in System Preferences > Privacy",
        "Use Safari for web playback (native HLS support)",
      ],
    },
    {
      title: "Performance Tips",
      icon: <Zap className="h-5 w-5" />,
      tips: [
        "Close other resource-heavy applications",
        "Check Activity Monitor for high CPU usage",
        "Ensure enough free disk space for cache",
        "Restart the app if it becomes sluggish",
      ],
    },
  ],
  firetv: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Settings > Applications > Manage Installed Applications",
        "Select Emby or Plex",
        "Click 'Clear cache'",
        "Click 'Clear data' for complete reset (will need to sign in again)",
        "Restart Fire TV after clearing cache",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Force stop the app and reopen",
        "Check your Fire TV is connected to internet",
        "Lower video quality: In app settings, reduce streaming quality",
        "Disable 'Match frame rate' if video stutters",
        "Try using Ethernet instead of WiFi for stability",
      ],
    },
    {
      title: "Remote Access Issues",
      icon: <Wifi className="h-5 w-5" />,
      tips: [
        "Make sure remote access is enabled on your server",
        "Check if port forwarding is configured correctly",
        "Try signing out and back in to refresh connection",
        "Verify your Plex Pass or Emby Premiere is active",
      ],
    },
  ],
  androidtv: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Settings > Apps > See all apps > Emby or Plex",
        "Select 'Clear cache'",
        "Select 'Clear data' for complete reset",
        "Restart your TV after clearing",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Check for app updates in Play Store",
        "Try changing the video decoder in app settings",
        "Reduce streaming quality if buffering",
        "Use 'Refresh' option in library to update metadata",
      ],
    },
    {
      title: "Audio Issues",
      icon: <Settings className="h-5 w-5" />,
      tips: [
        "Check audio output settings on your TV",
        "In app, try changing audio passthrough settings",
        "Disable Dolby Atmos if your system doesn't support it",
        "Set audio to stereo if surround sound isn't working",
      ],
    },
  ],
  roku: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Roku doesn't have a direct cache clear option",
        "Remove and re-add the channel from Channel Store",
        "System restart: Settings > System > System restart",
        "Factory reset as last resort (Settings > System > Advanced > Factory reset)",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Check for Roku software updates",
        "Reduce video quality in app or Roku settings",
        "Use wired ethernet if available",
        "Check Roku's bandwidth: Settings > Network > Check connection",
      ],
    },
    {
      title: "App Not Working",
      icon: <AlertTriangle className="h-5 w-5" />,
      tips: [
        "Remove the channel and reinstall it",
        "Check if the app needs to be updated",
        "Restart your Roku device",
        "Ensure your Roku OS is up to date",
      ],
    },
  ],
  appletv: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Apple TV doesn't have a cache clear option",
        "Delete and reinstall the app from App Store",
        "In app settings, look for 'Clear Cache' or 'Reset' option",
        "Restart Apple TV: Settings > System > Restart",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Force close app: Double-press TV button, swipe up on app",
        "Check for tvOS updates",
        "Try different video quality settings",
        "Ensure 'Match Content' settings are correct for your TV",
      ],
    },
    {
      title: "Siri Remote Tips",
      icon: <Settings className="h-5 w-5" />,
      tips: [
        "Swipe on trackpad to scrub through video",
        "Press and hold to access playback options",
        "Click trackpad edges for quick skip forward/back",
        "Use Siri to search: 'Play [movie name] on Plex'",
      ],
    },
  ],
  webos: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Settings > Apps > Running Apps > Close all",
        "Long-press app icon > Show App Info > Clear Cache",
        "Or delete and reinstall from LG Content Store",
        "Power cycle TV: Unplug for 30 seconds",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Check LG Content Store for app updates",
        "Reduce streaming quality in app settings",
        "Check TV firmware is up to date",
        "Try using the web app via TV's browser as alternative",
      ],
    },
    {
      title: "Connection Issues",
      icon: <Wifi className="h-5 w-5" />,
      tips: [
        "Settings > Network > WiFi Connection > Advanced",
        "Restart your router and TV",
        "Check signal strength in network settings",
        "Use wired connection if available",
      ],
    },
  ],
  tizen: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Settings > Apps > System apps > Show",
        "Find Emby/Plex > View Details > Clear Cache",
        "Or delete and reinstall from Samsung Apps",
        "Reset Smart Hub: Settings > Support > Self Diagnosis > Reset Smart Hub",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Update app from Samsung Apps store",
        "Check TV firmware: Settings > Support > Software Update",
        "Lower video quality settings in the app",
        "Restart TV by holding power button for 5 seconds",
      ],
    },
    {
      title: "App Crashes",
      icon: <AlertTriangle className="h-5 w-5" />,
      tips: [
        "Clear cache and restart TV",
        "Check if TV has enough storage space",
        "Reset Smart Hub if app keeps crashing",
        "Check internet connection stability",
      ],
    },
  ],
  xbox: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "My games & apps > Apps > Emby or Plex",
        "Press Menu button > Manage app > Clear saved data",
        "Or uninstall and reinstall from Microsoft Store",
        "Power cycle: Hold Xbox button 10 sec, unplug 30 sec",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Check for app updates in Microsoft Store",
        "Ensure Xbox Live services are running",
        "Lower streaming quality in app settings",
        "Check network connection in Xbox settings",
      ],
    },
    {
      title: "Audio/Video Sync",
      icon: <Settings className="h-5 w-5" />,
      tips: [
        "Settings > General > TV & display options",
        "Adjust refresh rate to match content",
        "Check HDMI cable is high-speed rated",
        "Try different audio output formats",
      ],
    },
  ],
  playstation: [
    {
      title: "Clear App Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Settings > Storage > System Storage > Saved Data",
        "Find and delete Plex/Emby saved data",
        "Or delete app: Press Options on app > Delete",
        "Rebuild database: Safe Mode > Option 5 (PS4/PS5)",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Check PlayStation Store for app updates",
        "Ensure PSN services are online",
        "Lower video quality in app settings",
        "Test internet connection in PS settings",
      ],
    },
    {
      title: "Connection Problems",
      icon: <Wifi className="h-5 w-5" />,
      tips: [
        "Settings > Network > Test Internet Connection",
        "Try wired connection for better stability",
        "Check NAT type - Type 2 is ideal",
        "Restart router and PlayStation",
      ],
    },
  ],
  web: [
    {
      title: "Clear Browser Cache",
      icon: <Trash2 className="h-5 w-5" />,
      tips: [
        "Chrome: Ctrl+Shift+Delete > Clear browsing data",
        "Firefox: Ctrl+Shift+Delete > Clear recent history",
        "Safari: Develop > Empty Caches (enable Develop menu first)",
        "Edge: Ctrl+Shift+Delete > Clear browsing data",
        "Try incognito/private mode to test without cache",
      ],
    },
    {
      title: "Playback Issues",
      icon: <Play className="h-5 w-5" />,
      tips: [
        "Try a different browser (Chrome usually works best)",
        "Disable browser extensions that might interfere",
        "Enable hardware acceleration in browser settings",
        "Update your browser to the latest version",
        "Check if JavaScript and cookies are enabled",
      ],
    },
    {
      title: "Video Not Loading",
      icon: <AlertTriangle className="h-5 w-5" />,
      tips: [
        "Check if the server requires transcoding",
        "Try forcing transcoding in playback settings",
        "Verify your browser supports the video codec",
        "Disable ad blockers for the streaming site",
        "Check browser console (F12) for error messages",
      ],
    },
  ],
};

const generalTips: TipSection[] = [
  {
    title: "Emby Tips",
    icon: <Play className="h-5 w-5" />,
    platform: "emby" as Platform,
    tips: [
      "Enable 'Automatically refresh library' in server settings",
      "Use 'Identify' feature if movie metadata is wrong",
      "Set up hardware transcoding for better performance",
      "Create collections to organize related content",
      "Use the 'Sync' feature to download for offline viewing",
      "Set parental controls for family accounts",
    ],
  },
  {
    title: "Plex Tips",
    icon: <Play className="h-5 w-5" />,
    platform: "plex" as Platform,
    tips: [
      "Enable 'Scheduled Tasks' for automatic library updates",
      "Use 'Fix Match' if content is incorrectly identified",
      "Enable Remote Access in Settings for outside access",
      "Create Playlists and Collections to organize content",
      "Use Plex Pass 'Sync' to download for offline viewing",
      "Set up Managed Users for family members",
    ],
  },
  {
    title: "Network Optimization",
    icon: <Wifi className="h-5 w-5" />,
    tips: [
      "Use wired Ethernet connections when possible",
      "Place your router centrally in your home",
      "Use 5GHz WiFi for streaming devices (faster, less interference)",
      "Check if your ISP is throttling streaming traffic",
      "Set Quality to 'Maximum' when on local network",
      "Reduce quality for remote streaming on slow connections",
    ],
  },
  {
    title: "Troubleshooting Steps",
    icon: <CheckCircle className="h-5 w-5" />,
    tips: [
      "1. Restart the app",
      "2. Check your internet connection",
      "3. Clear app cache",
      "4. Check if the server is online",
      "5. Update the app to latest version",
      "6. Restart your device",
      "7. Reinstall the app if nothing else works",
    ],
  },
];

export default function HelpPage() {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(null);

  const groupedDevices = devices.reduce((acc, device) => {
    if (!acc[device.category]) {
      acc[device.category] = [];
    }
    acc[device.category].push(device);
    return acc;
  }, {} as Record<string, DeviceInfo[]>);

  const selectedDeviceInfo = devices.find(d => d.id === selectedDevice);

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <HelpCircle className="h-10 w-10" />
            Help Center
          </h1>
          <p className="text-muted-foreground text-lg">
            Troubleshooting tips and guides for Emby and Plex
          </p>
        </div>

        {selectedDevice ? (
          // Device-specific tips
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedDevice(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to device selection
            </Button>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    {selectedDeviceInfo?.icon}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{selectedDeviceInfo?.name}</CardTitle>
                    <CardDescription>Troubleshooting guide</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-6">
              {deviceTips[selectedDevice]?.map((section, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {section.icon}
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.tips.map((tip, tipIndex) => (
                        <li key={tipIndex} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 mt-1 text-primary shrink-0" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          // Device selection
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Select Your Device</CardTitle>
                <CardDescription>
                  Choose your device to see specific troubleshooting tips
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(groupedDevices).map(([category, categoryDevices]) => (
                  <div key={category}>
                    <h3 className="font-medium text-sm text-muted-foreground mb-3">
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {categoryDevices.map((device) => (
                        <Button
                          key={device.id}
                          variant="outline"
                          className="h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary"
                          onClick={() => setSelectedDevice(device.id)}
                        >
                          {device.icon}
                          <span className="text-sm">{device.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* General Tips */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">General Tips</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {generalTips.map((section, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {section.icon}
                        {section.title}
                        {section.platform && section.platform !== "both" && (
                          <Badge variant="secondary" className="ml-2">
                            {section.platform === "emby" ? "Emby" : "Plex"}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.tips.map((tip, tipIndex) => (
                          <li key={tipIndex} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Quick Fixes */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Quick Fixes to Try First
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-background">
                    <span className="text-2xl font-bold text-primary">1</span>
                    <span className="text-sm">Restart the app</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-background">
                    <span className="text-2xl font-bold text-primary">2</span>
                    <span className="text-sm">Check internet connection</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-background">
                    <span className="text-2xl font-bold text-primary">3</span>
                    <span className="text-sm">Clear app cache</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-background">
                    <span className="text-2xl font-bold text-primary">4</span>
                    <span className="text-sm">Update the app</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">
                    Still having issues? Contact your server administrator for help.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
