# Mask render source

The current film uses the user's `CacheCAD/Design/Hardware/SOLIDWORKS/SleepMask.step` export for the macro PCB geometry. Its axes are seated in the mask frame so the copper, pads, soldermask, and white silkscreen remain aligned with the components. The folded tab shots use one SolidWorks PCB mesh at a time, with a texture exported from the current KiCad copper and silkscreen layers. The fabric shell and lithium cells come from the mask assembly scene; the cells are shown parallel to the board in the exploded shot.

The optical closeup is a concept layout. D20–D22 are currently placed on `D_0805_2012Metric` footprints in `SleepMask.kicad_pcb`, while the selected `XL-6028UWC-FB` has a roughly 3.2 × 2.8 mm body and spans approximately 5.9 mm including its plated leads. The film spaces three package models on a compact amber flex extension without overlap and includes the AFE4404 package. The KiCad footprints and routing still need an engineering update before fabrication. The red and green pulses are illustrative lighting: the selected `XL-6028UWC-FB` is a white LED.

The tiny 0402 passives are left unmarked in the render, consistent with common package options. The ESP32 package marking is included in its closeup.
