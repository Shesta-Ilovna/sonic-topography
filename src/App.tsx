import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI/UI';
import { MapScene } from './components/AudioVisualizer/MapScene';
import { useState } from 'react';
import {
  CUSTOM_THEME_ID,
  createCustomThemeColors,
  readActiveCustomThemeStorage,
  readActiveThemeStorage,
  readCustomThemeStorage,
  themes,
  writeActiveCustomThemeStorage,
  writeActiveThemeStorage,
  writeCustomThemeStorage,
  type CustomThemeSettings,
} from './lib/themes';

function readInitialCustomThemeState() {
  const presets = readCustomThemeStorage();
  return {
    presets,
    activeId: readActiveCustomThemeStorage(presets),
  };
}

export default function App() {
  const [theme, setTheme] = useState(readActiveThemeStorage);
  const [customThemeState, setCustomThemeState] = useState(readInitialCustomThemeState);
  const customThemes = customThemeState.presets;
  const activeCustomThemeId = customThemeState.activeId;
  const activeCustomTheme = customThemes.find((preset) => preset.id === activeCustomThemeId) || customThemes[0];
  const resolvedTheme = theme === CUSTOM_THEME_ID ? createCustomThemeColors(activeCustomTheme) : (themes[theme] || themes['nocturnal']);

  const updateTheme = (themeId: string) => {
    setTheme(themeId);
    writeActiveThemeStorage(themeId);
  };

  const updateCustomThemes = (settings: CustomThemeSettings[], activeId = activeCustomThemeId) => {
    setCustomThemeState({ presets: settings, activeId });
    writeCustomThemeStorage(settings);
    writeActiveCustomThemeStorage(activeId);
  };

  // Convert THREE.Color to css strings
  const bgDark = `#${resolvedTheme.uBaseColor1.getHexString()}`;

  return (
    <div className="relative w-screen h-screen overflow-hidden text-[#94a3b8] font-sans selection:bg-blue-500/30 transition-colors duration-1000" style={{ backgroundColor: bgDark }}>
      <UI
        theme={theme}
        resolvedTheme={resolvedTheme}
        customThemes={customThemes}
        activeCustomThemeId={activeCustomThemeId}
        onThemeChange={updateTheme}
        onCustomThemesChange={updateCustomThemes}
      />
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [35, 25, 35], fov: 45 }}>
          <MapScene themeColors={resolvedTheme} />
        </Canvas>
      </div>
    </div>
  );
}
