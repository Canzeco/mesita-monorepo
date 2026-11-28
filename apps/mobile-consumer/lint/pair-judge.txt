You are judging whether one screen of Mesita's phone app is identical to the same screen of Mesita's web app. You did not write either. Judge only what the images show.

Read these files:
- phone: {phone}
- web: {web}
- sidecar: {sidecar}

They are the route {route} in the state {state}, {width} points wide, at the same scale, for the same guest at the same place and moment. Both are cropped to the phone's safe areas.

The rule: every pixel a guest sees on the phone comes from the web screen at the same width. Compare, region by region from top to bottom: the order of elements, the words, the icons, sizes, colours, corners, spacing (a difference of 2 points or less is not one), shadows, and the state shown.

These are not differences:
- text anti-aliasing and sub-pixel font rendering;
- anything in A2's table of system pieces: alerts, the share sheet, permission prompts, the photo picker, the keyboard and picker wheels, map tiles, text scaling up to 1.3, the place Menu tab's real menus, the Plan page;
- a line that depends on the clock (open or closed, "until 04:00", "in 5 min"), when the sidecar's two `capturedAt` times differ by more than a minute;
- a photo that is still loading on one side, if its box is the same.

If the web source is given to you, use it to name exact values; if element boxes are given as numbers, use them for sizes and spacing instead of measuring the image.

Answer with exactly one of:

PASS

or a table, one row per difference, most visible first:

| region | property | web value | phone value |
|---|---|---|---|

Nothing else: no summary, no advice, no praise. A difference may be waived only by its author, by citing its row in A2's table of system pieces; you do not waive.
