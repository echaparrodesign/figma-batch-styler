import { hslToRgb, rgbToHsl } from "./color-helpers.js";

// This plugin will open a modal to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser enviroment (see documentation).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {
  width: 400,
  height: 620,
});

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.

async function sendStyles({ figmaTextStyles = [], figmaColorStyles = [] }) {
  let colorStyles = figmaColorStyles
    .map((s) => {
      if (s.paints.length && s.paints[0].type === "SOLID") {
        const { r, g, b } = s.paints.length && s.paints[0].color;
        const color = {
          r: r * 255,
          g: g * 255,
          b: b * 255,
        };
        const { name, paints, id } = s;
        return { name, paints, id, color };
      }
    })
    .filter((n) => n);
  let textStyles = figmaTextStyles.map((s) => {
    const { name, fontName, fontSize, id } = s;
    let lineHeight;
    if (s.lineHeight.unit === "AUTO") {
      lineHeight = "AUTO";
    } else if (s.lineHeight.unit === "PERCENT") {
      let value = Math.round(s.lineHeight.value * 100) / 100;
      lineHeight = `${value}%`;
    } else {
      lineHeight = Math.round(s.lineHeight.value * 100) / 100;
    }
    let letterSpacing;
    if (s.letterSpacing.unit === "PERCENT") {
      let value = Math.round(s.letterSpacing.value * 100) / 100;
      letterSpacing = `${value}%`;
    } else {
      letterSpacing = Math.round(s.letterSpacing.value * 100) / 100;
    }
    return { name, fontName, fontSize, lineHeight, letterSpacing, id };
  });

  let availableFonts = await figma.listAvailableFontsAsync();
  figma.ui.postMessage({
    type: "postStyles",
    textStyles,
    colorStyles,
    availableFonts,
  });
  trackEvent([{ event_type: "received_styles" }]);
}

function getStyles() {
  const figmaTextStyles = figma.getLocalTextStyles();
  const figmaColorStyles = figma.getLocalPaintStyles();
  if (figmaTextStyles.length || figmaColorStyles.length) {
    sendStyles({ figmaTextStyles, figmaColorStyles });
  } else {
    sendStyles({});
  }
  return;
}

function convertLineHeightToFigma(value) {
  let lineHeight;
  value = value.toString();
  var numbers = /^\d+(\.\d+)?$/;
  if (value.match(numbers)) {
    lineHeight = {
      unit: "PIXELS",
      value: Number(value),
    };
  } else if (
    value.trim().slice(-1) === "%" &&
    value.trim().slice(0, -1).match(numbers)
  ) {
    lineHeight = {
      unit: "PERCENT",
      value: Number(value.slice(0, -1)),
    };
  } else {
    lineHeight = {
      unit: "AUTO",
    };
  }
  return lineHeight;
}

function convertLetterSpacingToFigma(value) {
  let letterSpacing;
  value = value.toString();
  var numbers = /^\d+(\.\d+)?$/;
  if (value.match(numbers)) {
    letterSpacing = {
      unit: "PIXELS",
      value: Number(value),
    };
  } else if (
    value.trim().slice(-1) === "%" &&
    value.trim().slice(0, -1).match(numbers)
  ) {
    letterSpacing = {
      unit: "PERCENT",
      value: Number(value.slice(0, -1)),
    };
  }
  return letterSpacing;
}

function updateTextStyles({
  selectedStyles,
  styleName,
  styleMatch,
  familyName,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  fontMappings,
}) {
  let localStyles = figma.getLocalTextStyles();

  return selectedStyles.map(async (selectedStyle, index) => {
    let newLineHeight;
    let newLetterSpacing;
    let newFontSize;
    if (lineHeight) {
      if (lineHeight.length > 1) {
        if (lineHeight.length === selectedStyles.length) {
          newLineHeight = lineHeight[index];
        }
      } else {
        newLineHeight = lineHeight[0];
      }
    }
    if (letterSpacing) {
      if (letterSpacing.length > 1) {
        if (letterSpacing.length === selectedStyles.length) {
          newLetterSpacing = letterSpacing[index];
        }
      } else {
        newLetterSpacing = letterSpacing[0];
      }
    }

    if (fontSize) {
      if (fontSize.length > 1) {
        if (fontSize.length === selectedStyles.length) {
          newFontSize = fontSize[index];
        }
      } else {
        newFontSize = fontSize[0];
      }
    }
    let style;
    if (fontMappings) {
      let hit = fontMappings.find(
        (mapping) => mapping.currentWeight === selectedStyle.fontName.style
      );
      style = hit.newWeight;
    } else {
      style = fontWeight ? fontWeight : selectedStyle.fontName.style;
    }
    let family = familyName ? familyName : selectedStyle.fontName.family;
    let size = newFontSize ? newFontSize : selectedStyle.fontSize;
    let lh = newLineHeight
      ? newLineHeight
      : convertLineHeightToFigma(selectedStyle.lineHeight);
    let ls = newLetterSpacing
      ? newLetterSpacing
      : convertLetterSpacingToFigma(selectedStyle.letterSpacing);
    let hit = localStyles.find((s) => s.id === selectedStyle.id);

    await figma.loadFontAsync({ family, style });
    if (styleMatch !== null && styleName !== undefined) {
      hit.name = hit.name.replace(styleMatch, styleName);
    } else if (styleName) {
      hit.name = styleName;
    }
    hit.fontName = {
      family,
      style,
    };
    hit.fontSize = size;
    hit.lineHeight = {
      ...lh,
    };
    hit.letterSpacing = {
      ...ls,
    };
    return hit;
  });
}

function convertToHsl(color) {
  const { r, g, b } = color;
  let rawHsl = rgbToHsl(r * 255, g * 255, b * 255);
  let [h, s, l] = rawHsl;
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  return { h, s, l };
}

function convertToRgb(color) {
  const { h, s, l } = color;
  let rawRgb = hslToRgb(h / 360, s / 100, l / 100);
  let [r, g, b] = rawRgb;
  r = r / 255;
  g = g / 255;
  b = b / 255;
  return { r, g, b };
}

function getColors(style) {
  let paints = style.paints.filter((n) => n.type === "SOLID");
  if (!paints) return;
  return paints[0].color;
}

function getHslFromStyle(style) {
  let color = getColors(style);
  let { h, s, l } = convertToHsl(color);
  return { h, s, l };
}

function updateColorStyles({
  selectedStyles,
  styleName,
  styleMatch,
  hue,
  saturation,
  lightness,
  alpha,
}) {
  let localStyles = figma.getLocalPaintStyles();

  return selectedStyles.map(async (selectedStyle) => {
    let { h, s, l } = getHslFromStyle(selectedStyle);
    let newHue = hue == undefined ? h : hue;
    let newSaturation = saturation == undefined ? s : saturation;
    let newLightness = lightness == undefined ? l : lightness;
    let newColor = convertToRgb({
      h: newHue,
      s: newSaturation,
      l: newLightness,
    });
    let rgbValues = getColors(selectedStyle);
    let originalHsl = convertToHsl(rgbValues);
    let opacity = alpha ? alpha : selectedStyle.paints[0].opacity;
    let hit = localStyles.find((s) => s.id === selectedStyle.id);
    hit.paints = [{ color: newColor, type: "SOLID", opacity }];
    if (styleMatch !== null && styleName !== undefined) {
      hit.name = hit.name.replace(styleMatch, styleName);
    } else if (styleName) {
      hit.name = styleName;
    }
    return hit;
  });
}

function trackEvent(data) {
  figma.ui.postMessage({
    type: "trackEvent",
    data,
  });
}

async function updateStyles({
  selectedStyles,
  styleName,
  styleMatch,
  hue,
  saturation,
  lightness,
  alpha,
  familyName,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
  fontMappings,
  variant,
}) {
  let styleChanges;

  try {
    if (variant === "COLOR") {
      styleChanges = updateColorStyles({
        selectedStyles,
        styleName,
        styleMatch,
        hue,
        saturation,
        lightness,
        alpha,
      });
      figma.notify(
        `Successfully updated ${selectedStyles.length} color styles`
      );
      trackEvent([
        {
          event_type: "changed_color_style",
          event_properties: { size: selectedStyles.length },
        },
      ]);
    } else {
      styleChanges = updateTextStyles({
        selectedStyles,
        styleName,
        styleMatch,
        familyName,
        fontWeight,
        fontSize,
        lineHeight,
        letterSpacing,
        fontMappings,
      });
      figma.notify(`Successfully updated ${selectedStyles.length} text styles`);
      trackEvent([
        {
          event_type: "changed_text_style",
          event_properties: { size: selectedStyles.length },
        },
      ]);
    }

    await Promise.all(styleChanges);
  } catch (e) {
    figma.notify("Encountered an error, full output in console");
    console.error(e);
    trackEvent([{ event_type: "error", message: e }]);
  }
  getStyles();
}

trackEvent([{ event_type: "launched_plugin" }]);

figma.ui.onmessage = (msg) => {
  if (msg.type === "update") {
    const {
      selectedStyles,
      styleName,
      styleMatch,
      familyName,
      fontWeight,
      fontSize,
      lineHeight,
      letterSpacing,
      fontMappings,
      hue,
      saturation,
      lightness,
      alpha,
      variant,
    } = msg;
    updateStyles({
      selectedStyles,
      styleName,
      styleMatch,
      familyName,
      fontWeight,
      fontSize,
      lineHeight,
      letterSpacing,
      fontMappings,
      hue,
      saturation,
      lightness,
      alpha,
      variant,
    });
    return;
  }
  if (msg.type === "refresh") {
    getStyles();

    return;
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin();
};
