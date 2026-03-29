precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_brightness;

varying vec2 v_texCoord;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);

  // Exposure adjustment: multiply linear color then apply gamma correction.
  // u_brightness range: 0.0 (dark) to 2.0 (bright), 1.0 = no change.
  vec3 adjusted = color.rgb * u_brightness;

  // Gamma correction (sRGB-ish curve) to keep midtones natural
  float gamma = 1.0 / (0.6 + 0.4 * u_brightness);
  adjusted = pow(clamp(adjusted, 0.0, 1.0), vec3(gamma));

  gl_FragColor = vec4(adjusted, color.a);
}
