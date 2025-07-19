import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export function createReprocessing(app) {
  const params = {
    exposure: 1,
    bloomStrength: 1.5,
    bloomThreshold: 0,
    bloomRadius: 0
  };

  const renderScene = new RenderPass(app.scene, app.camera);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  const composer = new EffectComposer(app.renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  const gui = app.gui;

  gui.add(params, 'exposure', 0.1, 2).onChange(function(value) {
    app.renderer.toneMappingExposure = Math.pow(value, 4.0);
  });

  gui.add(params, 'bloomThreshold', 0.0, 1.0).onChange(function(value) {
    bloomPass.threshold = Number(value);
  });

  gui.add(params, 'bloomStrength', 0.0, 3.0).onChange(function(value) {
    bloomPass.strength = Number(value);
  });

  gui
    .add(params, 'bloomRadius', 0.0, 1.0)
    .step(0.01)
    .onChange(function(value) {
      bloomPass.radius = Number(value);
    });

  return composer;
}
