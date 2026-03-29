precision mediump float;

uniform sampler2D u_texture;
uniform sampler2D u_faceMask;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform vec2 u_direction;

varying vec2 v_texCoord;

// Detect skin-tone range to avoid smoothing eyes, lips, eyebrows
float isSkinTone(vec3 rgb) {
  // Convert to YCbCr for better skin detection
  float Y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float Cb = -0.169 * rgb.r - 0.331 * rgb.g + 0.500 * rgb.b + 0.5;
  float Cr =  0.500 * rgb.r - 0.419 * rgb.g - 0.081 * rgb.b + 0.5;

  // Skin tone thresholds (works across most skin tones)
  float skin = step(0.1, Y) * step(Y, 0.95)
             * step(0.35, Cb) * step(Cb, 0.55)
             * step(0.45, Cr) * step(Cr, 0.65);

  // Soften the boundary
  return skin;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 centerColor = texture2D(u_texture, v_texCoord);

  float maskValue = texture2D(u_faceMask, v_texCoord).r;

  if (u_intensity < 0.001 || maskValue < 0.01) {
    gl_FragColor = centerColor;
    return;
  }

  // Check if this pixel is skin (skip eyes, lips, eyebrows)
  float skinFactor = isSkinTone(centerColor.rgb);
  float effectiveMask = maskValue * mix(0.3, 1.0, skinFactor);

  // Wider bilateral filter for stronger smoothing
  float spatialSigma = u_intensity * 16.0; // was 12.0
  float rangeSigma = 0.12 + u_intensity * 0.3; // slightly more range tolerance

  vec4 colorSum = vec4(0.0);
  float weightSum = 0.0;

  // Larger kernel window for better smoothing
  for (int i = -24; i <= 24; i++) { // was -20 to 20
    float fi = float(i);
    vec2 offset = texelSize * u_direction * fi;
    vec2 sampleUV = v_texCoord + offset;

    // Clamp to prevent edge bleeding
    sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));

    vec4 sampleColor = texture2D(u_texture, sampleUV);

    float spatialWeight = exp(-(fi * fi) / (2.0 * spatialSigma * spatialSigma));

    vec3 colorDiff = sampleColor.rgb - centerColor.rgb;
    float colorDist = dot(colorDiff, colorDiff);
    float rangeWeight = exp(-colorDist / (2.0 * rangeSigma * rangeSigma));

    float weight = spatialWeight * rangeWeight;
    colorSum += sampleColor * weight;
    weightSum += weight;
  }

  vec4 smoothed = colorSum / weightSum;

  // Preserve skin texture detail — blend less aggressively at high frequency
  float detail = length(centerColor.rgb - smoothed.rgb);
  float detailPreserve = smoothstep(0.0, 0.15, detail);
  float blendAmount = effectiveMask * (1.0 - detailPreserve * 0.3);

  gl_FragColor = mix(centerColor, smoothed, blendAmount);
}
