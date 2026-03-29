precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform vec2 u_direction;

varying vec2 v_texCoord;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 centerColor = texture2D(u_texture, v_texCoord);

  // Bilateral filter: spatial gaussian weighted by color similarity.
  // Smooths skin tones while preserving edges (eyes, lips, hair borders).
  float spatialSigma = u_intensity * 12.0; // spatial spread in texels
  float rangeSigma = 0.15 + u_intensity * 0.25; // color similarity tolerance

  // Early-out when intensity is near zero
  if (u_intensity < 0.001) {
    gl_FragColor = centerColor;
    return;
  }

  vec4 colorSum = vec4(0.0);
  float weightSum = 0.0;

  // Separable bilateral approximation: sample along one direction per pass
  for (int i = -20; i <= 20; i++) {
    float fi = float(i);
    vec2 offset = texelSize * u_direction * fi;
    vec4 sampleColor = texture2D(u_texture, v_texCoord + offset);

    // Spatial weight: gaussian falloff with distance
    float spatialWeight = exp(-(fi * fi) / (2.0 * spatialSigma * spatialSigma));

    // Range weight: penalize samples that differ greatly in color from center
    vec3 colorDiff = sampleColor.rgb - centerColor.rgb;
    float colorDist = dot(colorDiff, colorDiff);
    float rangeWeight = exp(-colorDist / (2.0 * rangeSigma * rangeSigma));

    float weight = spatialWeight * rangeWeight;
    colorSum += sampleColor * weight;
    weightSum += weight;
  }

  gl_FragColor = colorSum / weightSum;
}
