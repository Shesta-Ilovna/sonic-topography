import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const wallpaperDir = path.join(rootDir, 'dist-wallpaper');
const projectPath = path.join(wallpaperDir, 'project.json');
const coverPath = path.join(rootDir, 'sonic-topography-douyin-cover-horizontal.png');
const previewPath = path.join(wallpaperDir, 'preview.png');

const project = {
  title: 'Sonic Topography',
  description: 'Audio-reactive Three.js terrain visualizer packaged as a Wallpaper Engine web wallpaper.',
  file: 'index.html',
  preview: 'preview.png',
  type: 'web',
  visibility: 'private',
  general: {
    supportsaudioprocessing: true,
    properties: {
      schemecolor: {
        order: 0,
        text: 'ui_browse_properties_scheme_color',
        type: 'color',
        value: '0 0 0',
      },
    },
  },
};

await fs.mkdir(wallpaperDir, { recursive: true });
await fs.writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');

try {
  await fs.copyFile(coverPath, previewPath);
} catch (error) {
  console.warn('Wallpaper preview image was not copied:', error);
}

console.log(`Wallpaper Engine project prepared at ${wallpaperDir}`);
