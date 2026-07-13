"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function ParticlesBackground() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setInit(true));
  }, []);

  if (!init) return null;

  return (
    <Particles
      id="tsparticles"
      options={{
        fullScreen: { enable: true, zIndex: -1 },
        background: { color: "transparent" },
        particles: {
          number: { value: 40 },
          color: { value: "#19191bff" },
          links: { enable: true, color: "#3b3f45ff", distance: 150, opacity: 0.3 },
          move: { enable: true, speed: 0.6, random: true },
          opacity: { value: 0.4 },
          size: { value: 2 },
        },
        detectRetina: true,
      }}
    />
  );
}
