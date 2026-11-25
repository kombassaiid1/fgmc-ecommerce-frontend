import type { AgentThemeId } from "../../../lib/agent-theme";

export const IMAGE_MOTION_THEMES = {
  photon: 0, quantum: 1, plasma: 2, fusion: 3, proton: 4, pulsar: 5, quasar: 6,
} as const satisfies Record<AgentThemeId, number>;

export const IMAGE_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * .5 + .5, .5 - a_position.y * .5);
  gl_Position = vec4(a_position, 0., 1.);
}`;

// Each field transports the existing texture, including its alpha and filaments.
// No particles, colored strokes or geometry are composited over the photograph.
export const IMAGE_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_image;
uniform float u_time;
uniform float u_theme;
uniform float u_intensity;
varying vec2 v_uv;

mat2 rotate(float a) {
  return mat2(cos(a), -sin(a), sin(a), cos(a));
}
float region(vec2 p, vec2 center, float radius) {
  vec2 d = (p - center) / radius;
  return exp(-dot(d, d) * 2.);
}
vec2 vortex(vec2 p, vec2 center, float angle, float radius) {
  vec2 d = p - center;
  float weight = region(p, center, radius);
  return center + rotate(angle * weight) * d;
}
vec4 source(vec2 uv) {
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
  return texture2D(u_image, uv);
}
void main() {
  vec2 p = (v_uv - .5) / .93 + .5;
  vec2 q = p;
  vec2 d = p - .5;
  float r = length(d);
  float t = u_time;
  float strength = u_intensity;
  float light = 1.;

  if (u_theme < .5) {
    // Photon: the photographed tracks carry a traveling radial wave.
    float transport = sin(r * 25. - t * 3.) * .035 * smoothstep(.08, .35, r);
    q = .5 + rotate(.06 * sin(t * .6)) * d * (1. + transport * strength);
    light += .08 * sin(r * 22. - t * 3.);
  } else if (u_theme < 1.5) {
    // Quantum: independent nuclei exchange energy along the original bridge.
    vec2 left = vec2(.21, .44);
    vec2 right = vec2(.80, .59);
    float exchange = sin(t * 1.3);
    q.x += .065 * exchange * (region(p, left, .32) - region(p, right, .32)) * strength;
    q.y += .025 * cos(t * 1.3) * (region(p, left, .3) - region(p, right, .3));
    q = vortex(q, left, .35 * sin(t), .29);
    q = vortex(q, right, -.35 * sin(t), .29);
    q.y += .009 * sin(p.x * 28. - t * 2.) * region(p, vec2(.5), .4);
  } else if (u_theme < 2.5) {
    // Plasma: continuously bending the photographed electric filaments.
    float angle = atan(d.y, d.x);
    float coreLock = smoothstep(.07, .2, r);
    float bend = (sin(r * 24. - t * 1.8) + .45 * sin(angle * 5. + t * .9)) * .14;
    q = .5 + rotate(bend * coreLock * strength) * d;
    q += normalize(d + vec2(.0001)) * .009 * sin(angle * 7. + t * 1.5) * coreLock;
  } else if (u_theme < 3.5) {
    // Fusion: photographed lobes approach the core; their filaments counterflow.
    float converge = .045 * sin(t * 1.15) * strength;
    q.x += converge * (region(p, vec2(.32, .51), .26) - region(p, vec2(.68, .51), .26));
    q = vortex(q, vec2(.32, .51), .4 * sin(t * .85), .25);
    q = vortex(q, vec2(.68, .51), -.4 * sin(t * .85), .25);
    float stream = exp(-pow((p.y - .52) * 26., 2.));
    q.y += .012 * sin(p.x * 28. - t * 2.) * stream;
    light += .1 * (sin(t * 1.15) * .5 + .5) * region(p, vec2(.5, .52), .15);
  } else if (u_theme < 4.5) {
    // Proton: move the actual three quarks while the outer field stays stable.
    vec2 a = vec2(.34, .41);
    vec2 b = vec2(.64, .41);
    vec2 c = vec2(.50, .70);
    q -= .035 * strength * vec2(cos(t), sin(t)) * region(p, a, .2);
    q -= .035 * strength * vec2(cos(t + 2.094), sin(t + 2.094)) * region(p, b, .2);
    q -= .035 * strength * vec2(cos(t + 4.188), sin(t + 4.188)) * region(p, c, .2);
  } else if (u_theme < 5.5) {
    // Pulsar: sweep the photographed beam around its nucleus, propagate the field.
    vec2 center = vec2(.5, .51);
    vec2 beam = rotate(t * .23) * (p - center);
    float wave = .018 * sin(length(beam) * 24. - t * 2.) * smoothstep(.08, .3, length(beam));
    q = center + beam * (1. + wave * strength);
  } else {
    // Quasar: accretion flow inside the disk; the jets keep their source axis.
    vec2 center = vec2(.46, .56);
    vec2 disk = p - center;
    float diskMask = region(p, center, .55);
    float flow = .28 * sin(t * .65 + length(disk) * 12.) * diskMask;
    q = center + rotate(flow * strength) * disk;
    vec2 axis = normalize(vec2(.55, -.83));
    float across = abs(dot(disk, vec2(-axis.y, axis.x)));
    float jet = (1. - smoothstep(.025, .09, across)) * smoothstep(.12, .25, length(disk));
    q += axis * .018 * sin(dot(disk, axis) * 25. - t * 2.) * jet;
  }
  vec4 color = source(q);
  gl_FragColor = vec4(color.rgb * light, color.a);
}`;
