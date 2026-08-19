import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

async function build() {
  console.log('[BUILD] 1/5 Generating multi-resolution icon.ico (16-256px) from SVG...');

  const svgPath = path.join(rootDir, 'public/icons/icon_1.svg');
  const tempDir = path.join(__dirname, 'temp_icons');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = [];

  for (const size of sizes) {
    const pngPath = path.join(tempDir, `icon_${size}.png`);
    await sharp(svgPath).resize(size, size).png().toFile(pngPath);
    pngPaths.push(pngPath);
  }

  const icoBuffer = await pngToIco(pngPaths);
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const iconPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(iconPath, icoBuffer);
  console.log(`[BUILD] Generated multi-resolution Windows ICO (${sizes.join(', ')}px) at ${iconPath}`);

  // Clean up temp PNGs
  for (const p of pngPaths) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

  console.log('[BUILD] 2/5 Bundling Desktop Tray application with esbuild...');

  const outputDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const bundlePath = path.join(outputDir, 'tray-bundle.cjs');

  // Bundle all backend JavaScript modules into a single CommonJS bundle
  execSync(`npx esbuild apps/desktop/tray.js --bundle --platform=node --target=node20 --format=cjs --outfile="${bundlePath}" --banner:js="const import_meta = { url: typeof __filename !== 'undefined' ? 'file:///' + __filename.replace(/\\\\/g, '/') : '' };" --define:import.meta=import_meta`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  console.log('[BUILD] 3/5 Copying embedded engine runtime (node.exe)...');

  const engineDir = path.join(outputDir, 'engine');
  if (!fs.existsSync(engineDir)) {
    fs.mkdirSync(engineDir, { recursive: true });
  }
  fs.copyFileSync(process.execPath, path.join(engineDir, 'node.exe'));

  console.log('[BUILD] 4/5 Compiling native Windows GUI Launchers (LFS.exe and LocalFastShares.exe) with embedded official icon...');

  const lfsExeOutput = path.join(outputDir, 'LFS.exe').replace(/\\/g, '/');
  const fullExeOutput = path.join(outputDir, 'LocalFastShares.exe').replace(/\\/g, '/');
  const iconPathUnix = iconPath.replace(/\\/g, '/');

  const psScript = `
$source = @"
using System;
using System.Diagnostics;
using System.IO;

namespace LocalFastShares
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string nodeExe = Path.Combine(baseDir, "engine", "node.exe");
                if (!File.Exists(nodeExe)) {
                    nodeExe = Path.Combine(baseDir, "node.exe");
                }
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "tray-bundle.cjs";
                psi.WorkingDirectory = baseDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                Process.Start(psi);
            }
            catch (Exception)
            {
            }
        }
    }
}
"@

$iconFile = '${iconPathUnix}'

$cp = New-Object System.CodeDom.Compiler.CompilerParameters
$cp.GenerateExecutable = $true
$cp.OutputAssembly = '${lfsExeOutput}'
$cp.CompilerOptions = "/target:winexe /win32icon:\`"$iconFile\`""
$cp.ReferencedAssemblies.Add("System.dll") | Out-Null

$provider = New-Object Microsoft.CSharp.CSharpCodeProvider
$results = $provider.CompileAssemblyFromSource($cp, $source)

if ($results.Errors.Count -gt 0) {
    foreach ($err in $results.Errors) {
        Write-Error $err.ToString()
    }
    exit 1
}

# Also produce LocalFastShares.exe
Copy-Item '${lfsExeOutput}' '${fullExeOutput}' -Force
Write-Host "SUCCESS: Native Windows GUI Executables (LFS.exe and LocalFastShares.exe) compiled with official icon!"
`;

  const psScriptPath = path.join(rootDir, 'compile_gui.ps1');
  fs.writeFileSync(psScriptPath, psScript);
  execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });
  if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

  console.log('[BUILD] 5/5 Copying public assets, tray assets, installer scripts, and packaging ZIP...');

  // Copy public directory to dist/public
  const distPublic = path.join(outputDir, 'public');
  if (fs.existsSync(distPublic)) {
    fs.rmSync(distPublic, { recursive: true, force: true });
  }
  fs.cpSync(path.join(rootDir, 'public'), distPublic, { recursive: true });

  // Copy assets to dist/assets
  const distAssets = path.join(outputDir, 'assets');
  if (fs.existsSync(distAssets)) {
    fs.rmSync(distAssets, { recursive: true, force: true });
  }
  fs.cpSync(assetsDir, distAssets, { recursive: true });

  // Copy systray binary to dist/traybin
  const systrayBin = path.join(rootDir, 'node_modules/systray2/traybin');
  if (fs.existsSync(systrayBin)) {
    const distTrayBin = path.join(outputDir, 'traybin');
    if (fs.existsSync(distTrayBin)) {
      fs.rmSync(distTrayBin, { recursive: true, force: true });
    }
    fs.cpSync(systrayBin, distTrayBin, { recursive: true });
  }

  // Copy 1-click installer and uninstaller to dist
  const installerDir = path.join(__dirname, 'installer');
  if (fs.existsSync(path.join(installerDir, 'install.bat'))) {
    fs.copyFileSync(path.join(installerDir, 'install.bat'), path.join(outputDir, 'install.bat'));
  }
  if (fs.existsSync(path.join(installerDir, 'uninstall.bat'))) {
    fs.copyFileSync(path.join(installerDir, 'uninstall.bat'), path.join(outputDir, 'uninstall.bat'));
  }

  // Clean old leftover debug files
  const cleanupFiles = ['launcher.log', 'launcher-error.log', 'lfs-debug.log', 'test_subsystem.js', 'test_perfect_build.js', 'test_compile_gui.js', 'setup_test_engine.js', 'inspect_node_res.js'];
  for (const f of cleanupFiles) {
    if (fs.existsSync(path.join(outputDir, f))) fs.unlinkSync(path.join(outputDir, f));
    if (fs.existsSync(path.join(rootDir, f))) fs.unlinkSync(path.join(rootDir, f));
  }

  // Create Portable Release ZIP Package
  const zipOutput = path.join(outputDir, 'LocalFastShares-v1.0.0-windows-x64.zip');
  try {
    if (fs.existsSync(zipOutput)) {
      fs.unlinkSync(zipOutput);
    }
    execSync(`powershell "Compress-Archive -Path @('dist/LFS.exe', 'dist/LocalFastShares.exe', 'dist/install.bat', 'dist/uninstall.bat', 'dist/public', 'dist/assets', 'dist/traybin', 'dist/engine', 'dist/tray-bundle.cjs') -DestinationPath '${zipOutput}' -Force"`, {
      cwd: rootDir,
      stdio: 'inherit'
    });
    console.log(`[BUILD] Release ZIP Archive created: ${zipOutput}`);
  } catch (e) {
    console.warn('[BUILD WARNING] Could not generate ZIP package:', e.message);
  }

  console.log('\n==================================================');
  console.log('BUILD SUCCESS: LFS.exe Native GUI & Installer Ready!');
  console.log('--------------------------------------------------');
  console.log(`Primary Executable: ${lfsExeOutput}`);
  console.log(`Release ZIP:        ${zipOutput}`);
  console.log(`Folder Output:      ${outputDir}`);
  console.log('==================================================\n');
}

build().catch((err) => {
  console.error('[BUILD FATAL ERROR]:', err);
  process.exit(1);
});
