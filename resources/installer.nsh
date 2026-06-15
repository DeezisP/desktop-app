; Called from the installer's .onInit via !insertmacro customInit.
;
; When the user's registry still holds an uninstall entry from a previous
; installation whose files were already removed (manually deleted, antivirus
; quarantine, failed prior update, etc.), electron-builder's NSIS template
; tries to run the old uninstaller and fails with:
;
;   "Failed to uninstall old application files.
;    Please try running the installer again.: 2"
;
; Win32 error 2 = ERROR_FILE_NOT_FOUND — the uninstaller .exe is gone.
;
; Fix: if the recorded InstallLocation directory no longer exists on disk,
; remove the stale key so the installer skips the uninstall step and
; writes fresh files to the default location instead.
!macro customInit
  ClearErrors
  ReadRegStr $R0 HKCU \
    "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.perfectelt.warehouse" \
    "InstallLocation"
  ${If} $R0 != ""
    ${IfNot} ${FileExists} "$R0\*"
      DeleteRegKey HKCU \
        "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.perfectelt.warehouse"
    ${EndIf}
  ${EndIf}
!macroend
