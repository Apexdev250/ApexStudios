!macro customInit
  ; Override default installation directory to be directly in LocalAppData
StrCpy $INSTDIR "$LOCALAPPDATA\ApexStudios"

  nsExec::ExecToStack 'taskkill /F /IM "ApexStudios.exe"'
!macroend
