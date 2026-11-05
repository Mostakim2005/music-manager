# Set Windows 7 compatibility
ManifestDPIAware true
ManifestSupportedOS all

!macro customInit
  # Check the OS version
  ${If} ${AtLeastWin7}
    # Windows 7 or newer
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "This application requires Windows 7 or newer."
    Abort
  ${EndIf}
!macroend 