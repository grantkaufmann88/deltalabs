# Mask render source

The November 27 film uses the user's `CacheCAD/Design/Hardware/SOLIDWORKS/SleepMask.step` KiCad export for the macro board geometry and its soldermask and copper colors. The folded tab shots use the SolidWorks bend sequence, with one native board shown at a time. The fabric shell and batteries come from the mask assembly scene.

The optical closeup is a concept layout. D20–D22 are currently placed on `D_0805_2012Metric` footprints in `SleepMask.kicad_pcb`, while the selected `XL-6028UWC-FB` LED package is approximately 5.9 × 2.8 mm. The film spaces three package models on a widened flex island; the KiCad footprints and routing still need an engineering update before fabrication. The red and green pulses are illustrative lighting: the selected `XL-6028UWC-FB` is a white LED.

The tiny 0402 passives are left unmarked in the render, consistent with common package options. The ESP32 package marking is included in its closeup.
