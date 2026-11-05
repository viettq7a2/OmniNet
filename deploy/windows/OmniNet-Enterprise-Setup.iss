; ==============================================================================
; OmniNet Enterprise NCM — Inno Setup Script
; Compiles the entire application into a single "OmniNet-Enterprise-Setup-v3.5.0.exe"
; ==============================================================================

#define MyAppName "OmniNet Enterprise NCM"
#define MyAppVersion "3.5.0"
#define MyAppPublisher "OmniNet Systems"
#define MyAppURL "https://github.com/viettq14407/omninet-enterprise-ncm"
#define MyAppExeName "Start-OmniNet-Windows.bat"

[Setup]
AppId={{9F82C10E-59B1-4A63-8F42-021C77B84920}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\..\dist-installer
OutputBaseFilename=OmniNet-Enterprise-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayIcon={app}\public\favicon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "firewall"; Description: "Configure Windows Firewall (Allow Port 3000 & SNMP/SSH)"; GroupDescription: "Network Security:"

[Files]
Source: "..\..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,dist-installer\*,tests\*,*.git*"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\deploy\windows\{#MyAppExeName}"; IconFilename: "{app}\public\favicon.ico"
Name: "{group}\Update OmniNet via GitHub"; Filename: "{app}\deploy\windows\Update-OmniNet-Windows.bat"; IconFilename: "{app}\public\favicon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\deploy\windows\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\public\favicon.ico"

[Run]
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""OmniNet Enterprise NCM (Port 3000)"" dir=in action=allow protocol=TCP localport=3000"; Flags: runhidden; Tasks: firewall
Filename: "cmd.exe"; Parameters: "/c npm install --legacy-peer-deps"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Configuring OmniNet Enterprise dependencies..."
Filename: "{app}\deploy\windows\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
